@router.get(
    "/profile",
    response_model=ReadUser,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
async def get_profile(
    current_user: ReadUser = Depends(get_authenticated_user),
) -> ReadUser:
    """Get authenticated user's profile."""
    return current_user



@router.get(
    "/profile",
    response_model=UserProfile,
    response_model_exclude_none=True,
)
async def get_profile(
    current_user: User = Depends(get_authenticated_user),
):
    # Start with everything the schema can take from the User object
    data = UserProfile.model_validate(current_user).model_dump()

    # Override / add the computed fields
    data["country"] = current_user.country.name if current_user.country else None

    if current_user.is_admin:
        data["is_admin"] = True
        data["permission"] = current_user.group.permission if current_user.group else None
        data["name"] = current_user.group.name if current_user.group else None
    else:
        # Never show is_admin for normal users
        data.pop("is_admin", None)

        if current_user.group:
            data["permission"] = current_user.group.permission
            data["name"] = current_user.group.name
        else:
            data.pop("permission", None)
            data.pop("name", None)

    return data
