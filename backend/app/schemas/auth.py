"""Schemas (DTO) for authentication."""

from typing import Literal

from pydantic import BaseModel

Role = Literal["admin", "viewer"]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    username: str
    role: Role


class UserInfo(BaseModel):
    username: str
    role: Role
    authenticated: bool