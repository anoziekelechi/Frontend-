
from sqlmodel import select, func, asc
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.users import Group  # adjust path
from api.users.schemas import GroupRead, GroupListResponse


async def get_all_groups(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
) -> GroupListResponse:
    """
    Return total count + paginated list of groups.
    """
    total = (
        await db.execute(
            select(func.count()).select_from(Group)
        )
    ).scalar_one()

    result = await db.execute(
        select(Group)
        .order_by(asc(Group.name))  # type: ignore[arg-type]
        .offset(skip)
        .limit(limit)
    )
    groups = result.scalars().all()

    return GroupListResponse(
        total=total,
        groups=[GroupRead.model_validate(g) for g in groups],
    )







@router.get(
    "/",
    response_model=GroupListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get all groups",
)
async def list_groups(
    skip: int = Query(default=0, ge=0, description="Records to skip"),
    limit: int = Query(default=100, ge=1, le=500, description="Max records"),
    db: AsyncSession = Depends(get_session),
    # current_user = Depends(require_permission("can_manage_groups")),
) -> GroupListResponse:
    return await get_all_groups(db=db, skip=skip, limit=limit)
