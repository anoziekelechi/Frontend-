# api/users/routes.py

@router.get(
    "/profile",
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
    response_model=UserProfile,
    response_model_exclude_none=True,   # ✅ Hides None fields from response
)
async def get_profile(
    db: DBDep,
    current_user: ReadUser = Depends(get_authenticated_user),  # ✅ ReadUser not User
) -> dict:
    """
    Get authenticated user profile.

    Response varies by role:
        Regular user: base fields + group info if assigned
        Admin: base fields + group info + is_admin: true
    """
    return await get_user_profile(
        db=db,
        current_user=current_user,
    )

# api/users/schemas.py

from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime


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
    permission: str | None = None       # Group permission (if in group)

# profile 
from sqlmodel import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from api.models.users import User
from api.users.schemas import UserProfile, ReadUser  # or whatever your auth schema is called


async def get_user_profile(
    db: AsyncSession,
    current_user: ReadUser,
) -> dict:
    """
    Load full user + relationships, then build profile dict
    with role-based fields.
    """
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.country),  # type: ignore[arg-type]
            selectinload(User.group),    # type: ignore[arg-type]
        )
        .where(User.id == current_user.id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    profile: dict = {
        "id": user.id,
        "email": user.email,
        "surname": user.surname,
        "othernames": user.othernames,
        "country": user.country.name if user.country else None,
        "verified": user.verified,
        "disabled": user.disabled,
        "date_verified": user.date_verified,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }

    # Group info (only if user belongs to a group)
    if user.group:
        profile["name"] = user.group.name
        profile["permission"] = user.group.permission

    # Admin-only field
    if user.is_admin:
        profile["is_admin"] = True

    return profile
#end
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
