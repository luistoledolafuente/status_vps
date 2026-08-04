"""Authentication endpoint (JWT, opt-in).

POST /api/auth/token with OAuth2 form fields (username, password) returns a
short-lived JWT. Users come from configuration: SYSSTATUS_ADMIN_USERNAME /
SYSSTATUS_ADMIN_PASSWORD (role admin) and SYSSTATUS_VIEWER_USERNAME /
SYSSTATUS_VIEWER_PASSWORD (role viewer).
"""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ...core import security
from ...core.config import settings
from ...core.logging import get_logger
from ...schemas.auth import TokenResponse

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _users() -> dict[str, tuple[str, str]]:
    return {
        settings.admin_username: (settings.admin_password, "admin"),
        settings.viewer_username: (settings.viewer_password, "viewer"),
    }


@router.post("/token", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    """Emite un token JWT para usuarios configurados (admin/viewer)."""
    users = _users()
    user = users.get(form.username)
    if user is None or not secrets.compare_digest(form.password, user[0]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos.",
        )
    role = user[1]
    token = security.create_access_token(form.username, role)
    logger.info("user logged in", extra={"event": "auth.login", "user": form.username, "role": role})
    return TokenResponse(
        access_token=token,
        expires_in=settings.token_expire_minutes * 60,
        username=form.username,
        role=role,
    )