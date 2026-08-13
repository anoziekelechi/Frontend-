
class UserProfile(BaseModel):
    """
    User profile response schema.

    Fields shown conditionally:
        country    → None if no country assigned
        is_admin   → Only shown for admin users
        name       → Group name, only if in a group
        permission → Group permission, only if in a group
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    surname: str
    othernames: str
    country: str | None = None
    verified: bool
    disabled: bool
    date_verified: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Conditionally included
    is_admin: bool | None = None        # Only admins
    name: str | None = None             # Group name (if in group)
    permission: str | None = None   

#login
async def initiate_login(
    data: LoginRequest,
    db: AsyncSession,
    redis: Redis,
    mailer: FastMail,
    background_tasks: BackgroundTasks,
    current_user: ReadUser | None = None,
) -> dict:
    """
    Step 1: Validate credentials, send OTP.
    Allows disabled and unverified users through to give specific messages.
    """
    if current_user is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Already logged in"
        )

    # Validate credentials only (same error - prevents enumeration)
    user = await get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # ✅ Removed: disabled and verified checks
    # They now get specific messages via complete_login
    # which checks status AFTER OTP verification

    user_id = get_user_id(user)

    # Rate limiting
    rate_key = f"login_rate:{user_id}"
    r: Any = redis
    attempts = await r.incr(rate_key)
    if attempts == 1:
        await r.expire(
            rate_key,
            int(timedelta(minutes=15).total_seconds())
        )
    if attempts > 8:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again in 15 minutes."
        )

    # Anti-replay token
    login_token = secrets.token_urlsafe(32)
    await r.set(
        f"login_attempt:{login_token}",
        str(user_id),
        ex=int(timedelta(minutes=OTP_EXPIRE_MINUTES).total_seconds()),
    )

    # Send OTP
    await generate_and_send_otp(
        user=user,
        otp_type="login",
        subject="Your login OTP",
        redis=redis,
        mailer=mailer,
        background_tasks=background_tasks,
    )

    logger.info(f"Login OTP sent to user_id={user_id}")

    return {
        "message": "OTP sent to your email",
        "email": user.email,
        "login_token": login_token,
    }



async def complete_login(
    data: VerifyOtpRequest,
    db: AsyncSession,
    redis: Redis,
    response: Response,
    current_user: ReadUser | None = None,   # ✅ Added
) -> dict:
    """
    Step 2: Verify OTP and issue tokens.

    Blocks already authenticated users.
    Returns specific messages for disabled/unverified accounts.
    """
    # ✅ Block already logged in users
    if current_user is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Already logged in. Please logout first."
        )

    user = await get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    user_id = get_user_id(user)
    r: Any = redis

    # Validate session token
    stored_id = await r.get(f"login_attempt:{data.account_token}")
    if not stored_id or int(stored_id) != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session expired or invalid"
        )
    await r.delete(f"login_attempt:{data.account_token}")

    # Validate OTP
    otp_key = f"otp:{data.otp_code}:{user_id}:login"
    if not await r.exists(otp_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired or invalid"
        )
    await r.delete(otp_key)

    # Clear rate limit on success
    await r.delete(f"login_rate:{user_id}")

    # Check account status after OTP verification
    if user.disabled:
        logger.warning(f"Disabled user login attempt: user_id={user_id}")
        return {
            "status": "disabled",
            "message": "Account suspended. Please contact admin.",
            "email": user.email,
        }

    if not user.verified:
        logger.info(f"Unverified user login attempt: user_id={user_id}")
        return {
            "status": "unverified",
            "message": "Account not verified. Please check your email.",
            "email": user.email,
        }

    # Issue tokens
    access_token = create_access_token(user_id)
    refresh_token = await create_refresh_token(user_id, redis)
    csrf_token = await generate_csrf_token(user_id, redis)

    set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
    )

    logger.info(f"Login successful for user_id={user_id}")

    return {
        "status": "success",
        "message": "Login successful",
    }

#login routes

@router.post(
    "/login/verify",
    status_code=status.HTTP_200_OK,
    summary="Login step 2 - verify OTP",
)
async def verify_login(
    data: VerifyOtpRequest,
    response: Response,
    db: DBDep,
    redis: RedisDep,
    current_user: ReadUser | None = Depends(get_optional_user),  # ✅ Added
) -> dict:
    """
    Verify OTP and set auth cookies.
    Blocked if already authenticated.
    """
    return await complete_login(
        data=data,
        db=db,
        redis=redis,
        response=response,
        current_user=current_user,          # ✅ Pass through
    )
    
#register 
async def register_user(
    data: CreateUser,
    db: AsyncSession,
    redis: Redis,
    mailer: FastMail,
    background_tasks: BackgroundTasks,
    current_user: ReadUser | None = None,
) -> dict:
    """
    Step 1: Register new user.
    - block user if already logged in
    - Validates email uniqueness
    - Validates country exists
    - Creates user (unverified)
    - Sends OTP via email
    - Returns registration token (anti-replay)
    """
    if current_user is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Logged in user cannot create account"
        )
    # Check email uniqueness
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    # Validate country exists
    country = await db.get(Country, data.country_id)  # ✅ await
    if not country:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Country not found"
        )
        
    # Enforce user select a country
    if data.country_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Country is required")
    # Create user
    new_user = User(
        surname=data.surname,
        othernames=data.othernames,
        email=data.email,
        hashed_password=hash_password(data.password),
        country_id=data.country_id,
        is_admin=False,
        disabled=False,
        verified=False,
        one_click=False,
        payment_id=None,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Create registration session token (anti-replay)
    reg_token = secrets.token_urlsafe(32)
    await redis.set(
        f"reg_attempt:{reg_token}",
        str(new_user.id),
        ex=int(timedelta(minutes=OTP_EXPIRE_MINUTES).total_seconds()),
    )
    
    # Send OTP
    await generate_and_send_otp(
        user=new_user,
        otp_type="registration",  # ✅ Fixed typo: otp_yype → otp_type
        subject="Verify your account",
        redis=redis,
        mailer=mailer,
        background_tasks=background_tasks,
    )
    logger.info(f"New registration started for {new_user.email} (user_id={new_user.id})")
    
    return {
        "message": "OTP sent to your email",
        "email": new_user.email,
        "reg_token": reg_token,
    }


async def verify_registration_otp(
    data: VerifyOtpRequest,
    db: AsyncSession,
    redis: Redis,
) -> ReadUser:
    """
    Step 2: Verify registration OTP.
    
    - Validates session token (anti-replay)
    - Validates OTP
    - Marks user as verified
    """
    # Get user
    user = await get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if user.verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account already verified"
        )
    
    # Validate session token
    stored_id = await redis.get(f"reg_attempt:{data.account_token}")
    if not stored_id or int(stored_id) != user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session expired or invalid"
        )
    await redis.delete(f"reg_attempt:{data.account_token}")
    
    # Validate OTP
    otp_key = f"otp:{data.otp_code}:{user.id}:registration"
    if not await redis.exists(otp_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired or invalid"
        )
    await redis.delete(otp_key)
    
    # Mark user as verified
    user.verified = True
    user.date_verified = datetime.now(timezone.utc)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return ReadUser.model_validate(user)



async def complete_login(
    data: VerifyOtpRequest,
    db: AsyncSession,
    redis: Redis,
    response: Response,
    current_user: ReadUser | None = None,   # ✅ Added
) -> dict:
    """
    Step 2: Verify OTP and issue tokens.

    Blocks already authenticated users.
    Returns specific messages for disabled/unverified accounts.
    """
    # ✅ Block already logged in users
    if current_user is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Already logged in. Please logout first."
        )

    user = await get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    user_id = get_user_id(user)
    r: Any = redis

    # Validate session token
    stored_id = await r.get(f"login_attempt:{data.account_token}")
    if not stored_id or int(stored_id) != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session expired or invalid"
        )
    await r.delete(f"login_attempt:{data.account_token}")

    # Validate OTP
    otp_key = f"otp:{data.otp_code}:{user_id}:login"
    if not await r.exists(otp_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired or invalid"
        )
    await r.delete(otp_key)

    # Clear rate limit on success
    await r.delete(f"login_rate:{user_id}")

    # Check account status after OTP verification
    if user.disabled:
        logger.warning(f"Disabled user login attempt: user_id={user_id}")
        return {
            "status": "disabled",
            "message": "Account suspended. Please contact admin.",
            "email": user.email,
        }

    if not user.verified:
        logger.info(f"Unverified user login attempt: user_id={user_id}")
        return {
            "status": "unverified",
            "message": "Account not verified. Please check your email.",
            "email": user.email,
        }

    # Issue tokens
    access_token = create_access_token(user_id)
    refresh_token = await create_refresh_token(user_id, redis)
    csrf_token = await generate_csrf_token(user_id, redis)

    set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
    )

    logger.info(f"Login successful for user_id={user_id}")

    return {
        "status": "success",
        "message": "Login successful",
        }



#routes


    @router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register new user account",
    response_description="OTP sent to email",
)
async def register(
    data: CreateUser,
    redis: RedisDep,
    mailer: MailDep,
    background_tasks: BackgroundTasks,   # ✅ No Depends() needed
    db: DBDep,
    current_user:ReadUser | None = Depends(get_optional_user),
) -> dict:
    """
    Step 1: Register a new user.
    
    - Validates email uniqueness
    - Validates country exists
    - Creates unverified account
    - Sends OTP to email
    
    Returns registration token for OTP verification step.
    """
    return await register_user(
        data=data,
        db=db,
        redis=redis,
        mailer=mailer,
        background_tasks=background_tasks,
        current_user=current_user
    )


@router.post(
    "/register/verify",
    status_code=status.HTTP_200_OK,
    response_model=ReadUser,
    summary="Verify registration OTP",
)
async def verify_registration(
    data: VerifyOtpRequest,
    redis: RedisDep,
    db: DBDep,

) -> ReadUser:
    """
    Step 2: Verify registration OTP.
    
    - Validates session token (anti-replay)
    - Validates OTP
    - Activates account
    
    Returns activated user profile.
    """
    return await verify_registration_otp(
        data=data,
        db=db,
        redis=redis,
    )


    
