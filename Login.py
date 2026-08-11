


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
) -> dict:
    """
    Step 2: Verify OTP and issue tokens.
    Returns specific messages for disabled/unverified accounts.
    """
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

    # Clear rate limit
    await r.delete(f"login_rate:{user_id}")

    # ✅ Check account status AFTER OTP verification
    # Return specific status codes so frontend can handle each case

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

    # ✅ Active and verified - issue tokens
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




async def get_current_user(
    request: Request,
    db: AsyncSession,
) -> ReadUser:
    """Get current authenticated user from cookie."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    payload = decode_access_token(token)

    user = await get_user_by_id(db, payload.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # ✅ Disabled users cannot access protected routes
    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended. Please contact admin."
        )

    # ✅ Unverified users cannot access protected routes
    if not user.verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified. Please verify your email."
        )

    return ReadUser.model_validate(user)






# api/home/models.py

class Country(BaseModel, table=True):
    __tablename__ = "countries"
    
    name: str = Field(
        sa_column=Column(String(30), nullable=False, unique=True, index=True)
    )
    currency_code: str = Field(
        sa_column=Column(String(3), nullable=False),
        min_length=3,
        max_length=3,
    )
    whatsapp: int | None = Field(default=None, gt=0)
    
    # ✅ New field - support email per country
    email_support: str | None = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
    )
    
    offices: List["Offices"] = Relationship(back_populates="country")
    users: List["User"] = Relationship(back_populates="country")




# api/home/schemas.py

class CountryRead(BaseModel):
    """Country response schema."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    currency_code: str
    whatsapp: int | None = None
    email_support: str | None = None      # ✅ Add this
    created_at: datetime
    updated_at: datetime



# api/home/schemas.py

class CountryUpdate(BaseModel):
    """Schema for updating a country."""
    model_config = ConfigDict(extra="forbid")
    
    name: str | None = None
    currency_code: str | None = None
    whatsapp: int | None = Field(default=None, gt=0)
    email_support: str | None = None      # ✅ Add this
    
    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return validate_country_name(v)
    
    @field_validator("currency_code", mode="before")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return validate_currency_code(v)
    
    @field_validator("email_support", mode="before")
    @classmethod
    def validate_email_support(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v



# api/users/logics.py

async def handle_disabled_account(
    data: ContactAdminMessage,
    db: AsyncSession,
    redis: Redis,
    mailer: FastMail,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Handle contact form from disabled users.

    Flow:
        1. Verify user exists and IS disabled
        2. Rate limit (max 3 per hour)
        3. Resolve support email:
           - Try user's country.email_support first
           - Fall back to settings.mail_username
        4. Send message to support email
        5. Return confirmation

    Args:
        data: Email + message from user
        db: Database session
        redis: Redis client
        mailer: FastMail instance
        background_tasks: FastAPI background tasks

    Returns:
        dict: Confirmation message
    """
    r: Any = redis

    # Verify user exists and is disabled
    user = await get_user_by_email(db, data.email)
    if not user or not user.disabled:
        # Generic response - don't reveal account status
        return {
            "message": "If your account exists, "
                       "your message has been sent to our support team."
        }

    user_id = get_user_id(user)

    # Rate limit - max 3 per hour
    rate_key = f"contact_admin_rate:{user_id}"
    count = await r.incr(rate_key)
    if count == 1:
        await r.expire(rate_key, 3600)
    if count > 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again in 1 hour."
        )

    # ✅ Resolve support email
    # Priority: country.email_support → settings.mail_username
    support_email = settings.mail_username  # fallback

    if user.country_id:
        country = await db.get(Country, user.country_id)
        if country and country.email_support:
            support_email = country.email_support
            logger.info(
                f"Using country support email: {support_email} "
                f"for country_id={user.country_id}"
            )
        else:
            logger.info(
                f"No country support email found. "
                f"Using default: {support_email}"
            )
    else:
        logger.info(
            f"User has no country. Using default: {support_email}"
        )

    # ✅ Send message to support email in background
    background_tasks.add_task(
        send_support_message,
        support_email=support_email,
        user_email=data.email,
        message=data.message,
        mailer=mailer,
    )

    logger.info(
        f"Disabled user {data.email} (id={user_id}) "
        f"sent contact message to {support_email}"
    )

    return {
        "message": "Your message has been sent to our support team. "
                   "We will review your account and get back to you."
          }






# api/users/email.py

async def send_support_message(
    support_email: str,
    user_email: str,
    message: str,
    mailer: FastMail,
) -> None:
    """
    Send disabled user's contact message to support email.

    Args:
        support_email: Destination (country.email_support or settings.mail_username)
        user_email: The user who sent the message
        message: The user's message
        mailer: FastMail instance
    """
    body = (
        f"A disabled user has contacted support.\n\n"
        f"From: {user_email}\n"
        f"Message:\n{message}\n\n"
        f"Please review this account and take appropriate action."
    )

    try:
        await send_email(
            recipient=support_email,
            subject=f"Disabled Account Contact: {user_email}",
            body=body,
            mailer=mailer,
        )
        logger.info(
            f"Support message from {user_email} "
            f"sent to {support_email}"
        )
    except Exception as exc:
        logger.critical(
            f"CRITICAL: Failed to send support message "
            f"from {user_email} to {support_email}. Error: {exc}"
        )





# api/users/logics.py

async def resend_verification(
    data: ResendOtpRequest,         # ✅ Reuse existing schema
    db: AsyncSession,
    redis: Redis,
    mailer: FastMail,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Resend verification OTP to unverified user.
    Wraps existing resend_otp logic with unverified-specific checks.
    """
    # Verify user exists and is actually unverified
    user = await get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if user.verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is already verified. Please login."
        )
    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact admin."
        )

    # ✅ Delegate to existing resend_otp - no code duplication!
    return await resend_otp(
        data=ResendOtpRequest(
            email=data.email,
            account_token=data.account_token,
            otp_type="registration",        # ← Always registration for unverified
        ),
        db=db,
        redis=redis,
        mailer=mailer,
        background_tasks=background_tasks,
    )




# api/users/routes.py

@router.post(
    "/contact-admin",
    status_code=status.HTTP_200_OK,
    summary="Contact support (disabled accounts only)",
)
async def contact_admin_route(
    data: ContactAdminMessage,
    background_tasks: BackgroundTasks,
    db: DBDep,
    redis: RedisDep,
    mailer: MailDep,
) -> dict:
    """
    Disabled users can send a message to support.
    Message goes to country.email_support or settings.mail_username.
    Rate limited to 3 requests per hour.
    """
    return await handle_disabled_account(
        data=data,
        db=db,
        redis=redis,
        mailer=mailer,
        background_tasks=background_tasks,
    )


@router.post(
    "/resend-verification",
    status_code=status.HTTP_200_OK,
    summary="Resend verification OTP (unverified accounts)",
)
async def resend_verification_route(
    data: ResendOtpRequest,         # ✅ Reuse existing schema
    background_tasks: BackgroundTasks,
    db: DBDep,
    redis: RedisDep,
    mailer: MailDep,
) -> dict:
    """
    Resend verification OTP to unverified users.
    Requires account_token from login response.
    """
    return await resend_verification(
        data=data,
        db=db,
        redis=redis,
        mailer=mailer,
        background_tasks=background_tasks,
    )



# api/users/schemas.py

class ContactAdminMessage(BaseModel):
    """Schema for disabled user contacting admin."""
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    message: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Message to send to admin"
    )

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()

    @field_validator("message", mode="before")
    @classmethod
    def clean_message(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Message cannot be empty")
        return v.strip()


class ResendVerificationRequest(BaseModel):
    """Schema for resending verification OTP."""
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    account_token: str = Field(..., min_length=32)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()






