
class Group(BaseModel,table=True):# type: ignore
    __tablename__ = "groups" # type: ignore
    name: str = Field(
        sa_column=Column(String(30),unique=True,nullable=False,index=True)
        )
    permission: str = Field(
        sa_column=Column(String(30),unique=True,nullable=False,index=True)
    )
    
    # one group many users one to many relationship
    users: List["User"] = Relationship(back_populates="group", sa_relationship_kwargs={"passive_deletes":True})


class User(BaseModel,table=True)
      __tablename__ = "groups"

      -------

      #many users can belong to one group
    group:Optional ["Group"] = Relationship(back_populates="users")
####
      def require_admin():
    """Dependency: require admin user."""
    async def dependency(
        request: Request,
        db: DBDep,
    ) -> ReadUser:
        user = await get_current_user(request, db)
        if not user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied,Contact Admin"
            )
        return user
    return dependency




async def has_permission(user: ReadUser, required_perm: str) -> bool:
    """Check if user has required permission."""
    if user.is_admin:
        return True
    # Permission check requires loading group - do in route if needed
    return False


