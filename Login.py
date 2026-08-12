

# api/users/logics.py

# api/users/routes.py



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









