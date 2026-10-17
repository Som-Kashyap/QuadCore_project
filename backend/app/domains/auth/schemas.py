from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator


# ==============================================================================
# REQUEST SCHEMAS
# ==============================================================================

class UserRegister(BaseModel):
    """POST /api/auth/register — body."""
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=8, max_length=128, description="Plain-text password (min 8 chars)")
    full_name: str = Field(..., min_length=1, max_length=255, description="Display name")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Full name cannot be blank or whitespace only")
        return cleaned


class UserLogin(BaseModel):
    """POST /api/auth/login — body."""
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v



class RefreshRequest(BaseModel):
    """POST /api/auth/refresh — body."""
    refresh_token: str = Field(..., description="The refresh token issued at login")


# ==============================================================================
# RESPONSE SCHEMAS
# ==============================================================================

class TokenResponse(BaseModel):
    """Returned on successful login / register / refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public user profile."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MeResponse(UserResponse):
    """GET /api/auth/me — includes extra context if needed later."""
    pass
