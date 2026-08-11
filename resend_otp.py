

async def resend_otp(
    data: ResendOtpRequest,
    db: AsyncSession,
    redis: Redis,
    mailer: FastMail,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Resend OTP for an in-progress registration or login flow.
    
    Requires a valid (unexpired) account_token from the original
    register/login request - prevents resending OTPs to arbitrary
    emails without first passing credential validation.
    
    Subject to the same OTP_RATE_LIMIT as the original send.
    """
    user = await get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate the session token is still active
    token_prefix = "reg_attempt" if data.otp_type == "registration" else "login_attempt"
    stored_id = await redis.get(f"{token_prefix}:{data.account_token}")
    if not stored_id or int(stored_id) != user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session expired - please start over"
        )
    
    subject = (
        "Verify your account" if data.otp_type == "registration"
        else "Your login OTP"
    )
    
    # ✅ Same function - rate limited, stores in Redis before queuing email
    await generate_and_send_otp(
        user=user,
        otp_type=data.otp_type,
        subject=subject,
        redis=redis,
        mailer=mailer,
        background_tasks=background_tasks,
    )
    
    return {"message": "A new OTP has been sent to your email"}
