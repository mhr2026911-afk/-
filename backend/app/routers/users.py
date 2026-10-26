from fastapi import APIRouter, HTTPException, Query

from ..deps import DB, CurrentUser, is_blocked
from ..models import BlockedUser, Contact, User
from ..schemas import ContactIn, ProfileIn
from ..security import normalize_phone
from ..serialize import contact_ids_for as contacts_for
from ..serialize import settings_out, user_out

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users/me")
def get_me(user: CurrentUser, db: DB):
    return {
        "user": user_out(user, user.id),
        "settings": settings_out(user.settings),
    }


@router.patch("/users/me")
def update_me(payload: ProfileIn, user: CurrentUser, db: DB):
    if payload.name is not None:
        user.name = payload.name.strip()[:80]
    if payload.about is not None:
        user.about = payload.about.strip()[:160]
    if payload.avatar_media_id is not None:
        user.avatar_media_id = payload.avatar_media_id or None
    db.commit()
    db.refresh(user)
    return {"user": user_out(user, user.id)}


@router.get("/users/search")
def search_user(user: CurrentUser, db: DB, phone: str = Query(min_length=6)):
    normalized = normalize_phone(phone)
    found = db.query(User).filter(User.phone == normalized).first()
    if not found:
        raise HTTPException(status_code=404, detail="لا يوجد حساب مسجّل بهذا الرقم")
    if found.id == user.id:
        raise HTTPException(status_code=400, detail="هذا رقمك أنت")
    ids = contacts_for(db, user.id)
    return {"user": user_out(found, user.id, ids)}


@router.get("/users/{user_id}")
def get_user(user_id: str, user: CurrentUser, db: DB):
    found = db.get(User, user_id)
    if not found:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    ids = contacts_for(db, user.id)
    return {"user": user_out(found, user.id, ids), "blocked": is_blocked(db, user.id, user_id)}


@router.get("/contacts")
def list_contacts(user: CurrentUser, db: DB):
    rows = (
        db.query(User)
        .join(Contact, Contact.user_id == User.id)
        .filter(Contact.owner_id == user.id)
        .order_by(User.name.asc())
        .all()
    )
    ids = {row.id for row in rows}
    return {"contacts": [user_out(row, user.id, ids) for row in rows]}


@router.post("/contacts")
def add_contact(payload: ContactIn, user: CurrentUser, db: DB):
    phone = normalize_phone(payload.phone)
    target = db.query(User).filter(User.phone == phone).first()
    if not target:
        raise HTTPException(status_code=404, detail="لا يوجد حساب مسجّل بهذا الرقم")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="هذا رقمك أنت")
    exists = (
        db.query(Contact)
        .filter(Contact.owner_id == user.id, Contact.user_id == target.id)
        .first()
    )
    if not exists:
        db.add(Contact(owner_id=user.id, user_id=target.id))
        db.commit()
    ids = contacts_for(db, user.id)
    return {"user": user_out(target, user.id, ids)}


@router.delete("/contacts/{user_id}")
def remove_contact(user_id: str, user: CurrentUser, db: DB):
    db.query(Contact).filter(
        Contact.owner_id == user.id, Contact.user_id == user_id
    ).delete()
    db.commit()
    return {"ok": True}


@router.get("/blocks")
def list_blocks(user: CurrentUser, db: DB):
    rows = (
        db.query(User)
        .join(BlockedUser, BlockedUser.blocked_id == User.id)
        .filter(BlockedUser.blocker_id == user.id)
        .all()
    )
    return {"blocked": [user_out(row, user.id) for row in rows]}


@router.post("/blocks/{user_id}")
def block_user(user_id: str, user: CurrentUser, db: DB):
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="لا يمكنك حظر نفسك")
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    exists = (
        db.query(BlockedUser)
        .filter(BlockedUser.blocker_id == user.id, BlockedUser.blocked_id == user_id)
        .first()
    )
    if not exists:
        db.add(BlockedUser(blocker_id=user.id, blocked_id=user_id))
        db.commit()
    return {"ok": True}


@router.delete("/blocks/{user_id}")
def unblock_user(user_id: str, user: CurrentUser, db: DB):
    db.query(BlockedUser).filter(
        BlockedUser.blocker_id == user.id, BlockedUser.blocked_id == user_id
    ).delete()
    db.commit()
    return {"ok": True}
