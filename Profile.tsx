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


    
