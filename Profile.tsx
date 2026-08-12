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
