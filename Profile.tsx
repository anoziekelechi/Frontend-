async def get_current_user(
    request: Request,
    db: DBDep,
) -> ReadUser:
    """
    Get current authenticated user from cookie.

    Used as a dependency in routes.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required!"
        )

    try:
        payload = decode_access_token(token)
    except Exception:
        # Covers expired signatures, malformed tokens, bad signatures, etc.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session"
        )

    user = await get_user_by_id(db, payload.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    if user.disabled:
        # Session was valid at login but account has since been disabled.
        # Treat as an invalid session, not a distinct permission error.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled"
        )
    if not user.verified:
        # Same reasoning: login already gates on verified status, so this
        # only triggers if verification was revoked after the token issued.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not verified"
        )

    return ReadUser.model_validate(user)


async def get_authenticated_user(
    request: Request,
    db: DBDep,
) -> ReadUser:
    """
    Dependency: Get current authenticated user.

    Usage:
        @router.get("/profile")
        async def profile(user: ReadUser = Depends(get_authenticated_user)):
            ...
    """
    return await get_current_user(request=request, db=db)


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
    response_model=ReadUser,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
async def get_profile(
    current_user: ReadUser = Depends(get_authenticated_user),
) -> ReadUser:
    """Get authenticated user's profile."""
    return current_user

#old code

async def get_current_user(
    request: Request,
    db: DBDep,
) -> ReadUser:
    """
    Get current authenticated user from cookie.
    
    Used as a dependency in routes.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required!"
        )
    
    payload = decode_access_token(token)
    
    user = await get_user_by_id(db, payload.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    if not user.verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified"
        )
    
    return ReadUser.model_validate(user)




async def get_authenticated_user(
    request: Request,
    db: DBDep,
) -> ReadUser:
    """
    Dependency: Get current authenticated user.
    
    Usage:
        @router.get("/profile")
        async def profile(user: ReadUser = Depends(get_authenticated_user)):
            ...
    """
    return await get_current_user(request=request, db=db)



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


// src/pages/Profile.tsx — FULL FINAL VERSION
async def get_current_user(
    request: Request,
    db: DBDep,
) -> ReadUser:
    """
    Get current authenticated user from cookie.

    Used as a dependency in routes.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required!"
        )

    try:
        payload = decode_access_token(token)
    except Exception:
        # Covers expired signatures, malformed tokens, bad signatures, etc.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session"
        )

    user = await get_user_by_id(db, payload.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    if not user.verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified"
        )

    return ReadUser.model_validate(user)


async def get_authenticated_user(
    request: Request,
    db: DBDep,
) -> ReadUser:
    """
    Dependency: Get current authenticated user.

    Usage:
        @router.get("/profile")
        async def profile(user: ReadUser = Depends(get_authenticated_user)):
            ...
    """
    return await get_current_user(request=request, db=db)


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
