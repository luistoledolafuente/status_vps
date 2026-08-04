"""JWT authentication helpers (prepared, opt-in via configuration).

The application starts with auth disabled for WSL practice; enable it with
SYSSTATUS_AUTH_ENABLED=true and a strong SYSSTATUS_JWT_SECRET in production.
Roles are ready: `admin` (full access) and `viewer` (read-only).
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from .config import settings


def create_access_token(username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """Decodes a token or raises jwt.PyJWTError if invalid/expired."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])