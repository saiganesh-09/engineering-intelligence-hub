"""Auth-related schemas."""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    auth_provider: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateRoleRequest(BaseModel):
    role: UserRole


class UpdateUserRequest(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    is_active: bool | None = None
    role: UserRole | None = None
