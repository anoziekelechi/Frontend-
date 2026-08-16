
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



