#logics.py
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
    
    - Validates email + password
    - Rate limits login attempts
    - Sends OTP via email
    - Returns login token (anti-replay)
    """
    
    if current_user is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="already logged in"
        )
    # Validate credentials (same error for both cases - prevents enumeration)
    user = await get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Check account status
    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    if not user.verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified. Please check your email."
        )
    
    # Rate limiting
    rate_key = f"login_rate:{user.id}"
    attempts = await redis.incr(rate_key)
    if attempts == 1:
        await redis.expire(
            rate_key,
            int(timedelta(minutes=15).total_seconds())
        )
    if attempts > 8:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again in 15 minutes."
        )
    
    # Create login session token (anti-replay)
    login_token = secrets.token_urlsafe(32)
    await redis.set(
        f"login_attempt:{login_token}",
        str(user.id),
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
    logger.info(f"Login OTP sent to user_id={user.id}")
    
    return {
        "message": "OTP sent to your email",
        "email": user.email,
        "login_token": login_token,
    }


async def complete_login(
    data: VerifyOtpRequest,
    db: AsyncSession,
    redis: Redis,
    response: Response,         # ← Needed to set cookies
) -> dict:
    """
    Step 2: Verify OTP, issue tokens via cookies.
    
    - Validates session token
    - Validates OTP
    - Issues access + refresh + CSRF tokens as cookies
    - Clears login rate limit
    """
    # Get user
    user = await get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Validate session token
    stored_id = await redis.get(f"login_attempt:{data.account_token}")
    if not stored_id or int(stored_id) != user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session expired or invalid"
        )
    await redis.delete(f"login_attempt:{data.account_token}")
    
    # Validate OTP
    otp_key = f"otp:{data.otp_code}:{user.id}:login"
    if not await redis.exists(otp_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired or invalid"
        )
    await redis.delete(otp_key)
    
    # Clear rate limit on successful login
    await redis.delete(f"login_rate:{user.id}")
    
    if user.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User id missing"
        )
    user_id:int = user.id
    
    # Create tokens
    access_token = create_access_token(user_id) #user_id replace user.id with user_id
    refresh_token = await create_refresh_token(user_id, redis)
    csrf_token = await generate_csrf_token(user_id, redis)
    
    # ✅ Set tokens as HttpOnly cookies
    set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
    )
    
    return {"message": "Login successful"}



#routes.py

        
@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    summary="Login step 1 - validate credentials",
    response_description="OTP sent to email",
)
async def login(
    data: LoginRequest,
    redis: RedisDep,
    mailer: MailDep,
    background_tasks: BackgroundTasks,   # ✅ No Depends() needed
    db: DBDep,
    current_user:ReadUser | None = Depends(get_optional_user)
) -> dict:
    """
    Step 1: Validate credentials and send OTP.
    
    - Validates email + password
    - Rate limits attempts (max 8 per 15 minutes)
    - Sends OTP via email
    
    Returns login token for OTP verification step.
    """
    return await initiate_login(
        data=data,
        db=db,
        redis=redis,
        mailer=mailer,
        background_tasks=background_tasks,
        current_user=current_user,
    )


@router.post(
    "/login/verify",
    status_code=status.HTTP_200_OK,
    summary="Login step 2 - verify OTP",
    response_description="Auth cookies set",
)
async def verify_login(
    redis: RedisDep,
    data: VerifyOtpRequest,
    response: Response,                  # ✅ FastAPI injects this
    db: DBDep,
    
) -> dict:
    """
    Step 2: Verify OTP and issue tokens.
    
    - Validates session token (anti-replay)
    - Validates OTP
    - Issues tokens as HttpOnly cookies
    
    ✅ Tokens NEVER in response body - cookies only!
    """
    return await complete_login(
        data=data,
        db=db,
        redis=redis,
        response=response,    # ← Logic sets cookies via response
    )


#logout routes and logics

@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout user",
    dependencies=[Depends(require_csrf)],  # ✅ CSRF protection on logout
)
async def logout(
    request: Request,
    response: Response,
    redis: RedisDep,
    current_user: ReadUser = Depends(get_authenticated_user),
) -> dict:
    """
    Logout current user.
    
    - Validates CSRF token
    - Revokes refresh token
    - Clears all auth cookies
    - Cleans up Redis data
    """
    return await logout_user(
        request=request,
        response=response,
        redis=redis,
        current_user=current_user,
    )





sync def logout_user(
    request: Request,
    response: Response,
    redis: Redis,
    current_user: ReadUser,
) -> dict:
    """
    Logout user.
    
    - Revokes refresh token
    - Clears all auth cookies
    - Clears user OTPs from Redis
    """
    # Revoke refresh token
    refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if refresh_token:
        await revoke_refresh_token(refresh_token, redis)
    
    # Clean up OTPs
    otp_keys = await redis.keys(f"otp:*:{current_user.id}:*")
    if otp_keys:
        await redis.delete(*otp_keys)
    
    # ✅ Clear all cookies
    clear_auth_cookies(response)
    
    return {"message": "Logged out successfully"}

