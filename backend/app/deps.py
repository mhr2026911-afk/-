from typing import Annotated

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from .db import get_db
from .models import BlockedUser, Contact, User
from .security import decode_token

DB = Annotated[Session, Depends(get_db)]


def _user_from_token(db: Session, token: str | None) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="الجلسة غير صالحة، سجّل الدخول من جديد",
        )
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="انتهت صلاحية الجلسة، سجّل الدخول من جديد",
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="الحساب غير موجود")
    return user


def current_user(
    db: DB,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    return _user_from_token(db, token)


def user_from_query_token(db: DB, token: str | None = Query(default=None)) -> User:
    """Media and backup downloads are opened by the browser directly, so the
    token travels as a query parameter there."""
    return _user_from_token(db, token)


CurrentUser = Annotated[User, Depends(current_user)]


def is_blocked(db: Session, a: str, b: str) -> bool:
    return (
        db.query(BlockedUser)
        .filter(
            ((BlockedUser.blocker_id == a) & (BlockedUser.blocked_id == b))
            | ((BlockedUser.blocker_id == b) & (BlockedUser.blocked_id == a))
        )
        .first()
        is not None
    )


def is_contact(db: Session, owner_id: str, user_id: str) -> bool:
    return (
        db.query(Contact)
        .filter(Contact.owner_id == owner_id, Contact.user_id == user_id)
        .first()
        is not None
    )
