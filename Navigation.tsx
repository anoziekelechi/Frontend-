async def get_users(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
) -> AllUsers:  
    
    # Total Users
    total: int = (
        await db.execute(
            select(func.count()).select_from(User)
        )
    ).scalar() or 0
    
    result = await db.execute(
        select(User)
        .options(selectinload(User.country)) # type:ignore[arg-type]
        .order_by(asc("created_at"))  #(User.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()

    return AllUsers(
        total=total,
        users=[   
            ReadUser(
                id=user.id,  # type: ignore
                email=user.email,
                surname=user.surname,
                othernames=user.othernames,
                country=user.country.name if user.country else None,
                is_admin=user.is_admin,
                verified=user.verified,
                disabled=user.disabled,
                date_verified=user.date_verified,
                created_at=user.created_at,
            )
            for user in users
        ],
    )


class GroupRead(BaseModel):
    """Group response schema."""
    model_config = ConfigDict(from_attributes=True)  # ✅ Pydantic v2
    
    id: int
    name: str
    permission: str
    created_at: datetime
    updated_at: datetime

async def list_groups(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
) -> list[GroupRead]:
    """
    List all permission groups with pagination.
    
    Args:
        skip: Number of records to skip
        limit: Maximum records to return
    """
    result = await db.execute(
        select(Group)
        .order_by(Group.name)
        .offset(skip)
        .limit(limit)
    )
    groups = result.scalars().all()
    return [GroupRead.model_validate(g) for g in groups]




class Offices(BaseModel,table=True): # type: ignore
    __tablename__ = "offices"  # type: ignore
    # FK LINKING TO COUNTRY TABLE
    country_id: int = Field (
        sa_column=Column(
            Integer,
            ForeignKey("countries.id", ondelete="CASCADE"),
            nullable= False
        )
    )
    address:str | None = Field(default=None,sa_column=Column(Text, nullable=True))
    whatsapp:int| None = Field(default=None, gt=0)
    phone_number:str | None = Field(default=None,sa_column=Column(String(20),nullable=True))
    email: EmailStr | None = Field(default=None,sa_column=Column(String(50),index=True,unique=True))
    # Relationship to access country data directly
    country:Optional["Country"] = Relationship(back_populates="offices")



