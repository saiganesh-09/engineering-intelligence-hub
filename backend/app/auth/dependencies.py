"""FastAPI dependencies for authentication and role-based access control."""
from typing import Iterable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.core.database import get_db
from app.models.user import User, UserRole

bearer = HTTPBearer(auto_error=False)

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired authentication token",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise _CREDENTIALS_ERROR
    user = db.get(User, payload.get("sub", ""))
    if user is None or not user.is_active:
        raise _CREDENTIALS_ERROR
    return user


def require_roles(*roles: UserRole):
    """Dependency factory enforcing that the user has one of ``roles``."""

    allowed: Iterable[UserRole] = roles or tuple(UserRole)

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return checker
