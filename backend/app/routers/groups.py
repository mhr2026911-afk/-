from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from ..access import participant_ids, require_participant
from ..deps import DB, CurrentUser, is_contact
from ..models import Conversation, Message, MessageReceipt, Participant, User, utcnow
from ..schemas import GroupIn, GroupUpdateIn, MemberIn
from ..serialize import contact_ids_for, conversation_out, user_out
from ..ws import HUB

router = APIRouter(prefix="/api/groups", tags=["groups"])


async def notify_members(members: list[str], conversation_id: str) -> None:
    await HUB.broadcast(
        members,
        {"type": "conversation:updated", "conversation_id": conversation_id},
    )


def _add_system_message(db: Session, conversation_id: str, actor_id: str, body: str) -> None:
    now = utcnow()
    db.add(
        Message(
            conversation_id=conversation_id,
            sender_id=actor_id,
            kind="system",
            body=body,
            created_at=now,
        )
    )
    conversation = db.get(Conversation, conversation_id)
    conversation.last_message_at = now


def _require_admin(db: Session, conversation_id: str, user_id: str) -> Participant:
    row = require_participant(db, conversation_id, user_id)
    if row.role != "admin":
        raise HTTPException(status_code=403, detail="هذا الإجراء متاح لمشرفي المجموعة فقط")
    return row


def _group(db: Session, conversation_id: str) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if not conversation or conversation.kind != "group":
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")
    return conversation


@router.get("")
def list_groups(user: CurrentUser, db: DB):
    conversations = (
        db.query(Conversation)
        .join(Participant, Participant.conversation_id == Conversation.id)
        .filter(Participant.user_id == user.id, Conversation.kind == "group")
        .order_by(Conversation.last_message_at.desc())
        .all()
    )
    ids = contact_ids_for(db, user.id)
    online = HUB.online_ids()
    return {
        "groups": [conversation_out(db, conv, user.id, ids, online) for conv in conversations]
    }


@router.post("")
async def create_group(payload: GroupIn, user: CurrentUser, db: DB):
    requested = [uid for uid in dict.fromkeys(payload.member_ids) if uid != user.id]
    members: list[str] = [user.id]
    skipped: list[str] = []
    for uid in requested:
        target = db.get(User, uid)
        if not target:
            continue
        privacy = target.settings.groups_privacy if target.settings else "everyone"
        if privacy == "nobody" or (privacy == "contacts" and not is_contact(db, target.id, user.id)):
            skipped.append(target.name or target.phone)
            continue
        members.append(uid)

    if len(members) < 2:
        raise HTTPException(
            status_code=422,
            detail="أضف عضوًا واحدًا على الأقل إلى المجموعة",
        )

    conversation = Conversation(
        kind="group",
        title=payload.title.strip()[:120],
        about=payload.about.strip()[:240],
        created_by=user.id,
        last_message_at=utcnow(),
    )
    db.add(conversation)
    db.flush()
    for member_id in members:
        db.add(
            Participant(
                conversation_id=conversation.id,
                user_id=member_id,
                role="admin" if member_id == user.id else "member",
            )
        )
    _add_system_message(db, conversation.id, user.id, "أنشأ هذه المجموعة")
    db.commit()
    db.refresh(conversation)

    await notify_members(members, conversation.id)
    ids = contact_ids_for(db, user.id)
    return {
        "group": conversation_out(db, conversation, user.id, ids, HUB.online_ids()),
        "skipped": skipped,
    }


@router.get("/{conversation_id}")
def group_info(conversation_id: str, user: CurrentUser, db: DB):
    require_participant(db, conversation_id, user.id)
    conversation = _group(db, conversation_id)
    rows = (
        db.query(Participant, User)
        .join(User, User.id == Participant.user_id)
        .filter(Participant.conversation_id == conversation_id)
        .all()
    )
    ids = contact_ids_for(db, user.id)
    online = HUB.online_ids()
    return {
        "group": conversation_out(db, conversation, user.id, ids, online),
        "about": conversation.about,
        "members": [
            {
                "user": user_out(member_user, user.id, ids, online),
                "role": row.role,
            }
            for row, member_user in rows
        ],
    }


@router.patch("/{conversation_id}")
async def update_group(
    conversation_id: str, payload: GroupUpdateIn, user: CurrentUser, db: DB
):
    _require_admin(db, conversation_id, user.id)
    conversation = _group(db, conversation_id)
    if payload.title is not None:
        conversation.title = payload.title.strip()[:120]
    if payload.about is not None:
        conversation.about = payload.about.strip()[:240]
    if payload.avatar_media_id is not None:
        conversation.avatar_media_id = payload.avatar_media_id or None
    _add_system_message(db, conversation_id, user.id, "حدّث المشرف معلومات المجموعة")
    db.commit()
    members = participant_ids(db, conversation_id)
    await notify_members(members, conversation_id)
    ids = contact_ids_for(db, user.id)
    return {"group": conversation_out(db, conversation, user.id, ids, HUB.online_ids())}


@router.post("/{conversation_id}/members")
async def add_member(
    conversation_id: str, payload: MemberIn, user: CurrentUser, db: DB
):
    _require_admin(db, conversation_id, user.id)
    target = db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if target.id in participant_ids(db, conversation_id):
        raise HTTPException(status_code=409, detail="العضو موجود في المجموعة")
    privacy = target.settings.groups_privacy if target.settings else "everyone"
    if privacy == "nobody" or (privacy == "contacts" and not is_contact(db, target.id, user.id)):
        raise HTTPException(
            status_code=403,
            detail="إعدادات خصوصية هذا المستخدم تمنع إضافته إلى المجموعات",
        )
    db.add(
        Participant(conversation_id=conversation_id, user_id=target.id, role="member")
    )
    _add_system_message(
        db, conversation_id, user.id, f"أضاف {target.name or target.phone} إلى المجموعة"
    )
    db.commit()
    members = participant_ids(db, conversation_id)
    await notify_members(members, conversation_id)
    return {"ok": True}


@router.delete("/{conversation_id}/members/{member_id}")
async def remove_member(
    conversation_id: str, member_id: str, user: CurrentUser, db: DB
):
    me = require_participant(db, conversation_id, user.id)
    _group(db, conversation_id)
    if me.role != "admin" and member_id != user.id:
        raise HTTPException(status_code=403, detail="هذا الإجراء متاح للمشرفين فقط")
    target = db.get(User, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    row = (
        db.query(Participant)
        .filter(
            Participant.conversation_id == conversation_id,
            Participant.user_id == member_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="العضو غير موجود في المجموعة")

    other_admins = (
        db.query(Participant)
        .filter(
            Participant.conversation_id == conversation_id,
            Participant.role == "admin",
            Participant.user_id != member_id,
        )
        .count()
    )
    if row.role == "admin" and other_admins == 0:
        raise HTTPException(
            status_code=409,
            detail="عيّن مشرفًا آخر قبل مغادرة المجموعة",
        )

    db.delete(row)
    _add_system_message(
        db,
        conversation_id,
        user.id,
        "غادر المجموعة"
        if member_id == user.id
        else f"أزال {target.name or target.phone} من المجموعة",
    )
    db.commit()
    members = participant_ids(db, conversation_id) + [member_id]
    await notify_members(members, conversation_id)
    return {"ok": True}


@router.post("/{conversation_id}/admins/{member_id}")
async def promote_admin(
    conversation_id: str, member_id: str, user: CurrentUser, db: DB
):
    _require_admin(db, conversation_id, user.id)
    _group(db, conversation_id)
    row = (
        db.query(Participant)
        .filter(
            Participant.conversation_id == conversation_id,
            Participant.user_id == member_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="العضو غير موجود في المجموعة")
    row.role = "admin"
    target = db.get(User, member_id)
    _add_system_message(
        db,
        conversation_id,
        user.id,
        f"جعل {target.name or target.phone} مشرفًا",
    )
    db.commit()
    members = participant_ids(db, conversation_id)
    await notify_members(members, conversation_id)
    return {"ok": True}


@router.delete("/{conversation_id}/admins/{member_id}")
async def demote_admin(
    conversation_id: str, member_id: str, user: CurrentUser, db: DB
):
    _require_admin(db, conversation_id, user.id)
    _group(db, conversation_id)
    row = (
        db.query(Participant)
        .filter(
            Participant.conversation_id == conversation_id,
            Participant.user_id == member_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="العضو غير موجود في المجموعة")
    admins = (
        db.query(Participant)
        .filter(
            Participant.conversation_id == conversation_id,
            Participant.role == "admin",
        )
        .count()
    )
    if admins <= 1:
        raise HTTPException(
            status_code=409,
            detail="يجب أن يبقى مشرف واحد على الأقل في المجموعة",
        )
    row.role = "member"
    target = db.get(User, member_id)
    _add_system_message(
        db,
        conversation_id,
        user.id,
        f"أعاد {target.name or target.phone} عضوًا عاديًا",
    )
    db.commit()
    members = participant_ids(db, conversation_id)
    await notify_members(members, conversation_id)
    return {"ok": True}


@router.delete("/{conversation_id}")
async def delete_group(conversation_id: str, user: CurrentUser, db: DB):
    _require_admin(db, conversation_id, user.id)
    _group(db, conversation_id)
    members = participant_ids(db, conversation_id)
    message_ids = [
        row[0]
        for row in db.query(Message.id)
        .filter(Message.conversation_id == conversation_id)
        .all()
    ]
    if message_ids:
        db.query(MessageReceipt).filter(
            MessageReceipt.message_id.in_(message_ids)
        ).delete(synchronize_session=False)
        db.query(Message).filter(Message.conversation_id == conversation_id).delete(
            synchronize_session=False
        )
    db.query(Participant).filter(
        Participant.conversation_id == conversation_id
    ).delete(synchronize_session=False)
    db.query(Conversation).filter(Conversation.id == conversation_id).delete(
        synchronize_session=False
    )
    db.commit()
    await HUB.broadcast(
        members, {"type": "conversation:deleted", "conversation_id": conversation_id}
    )
    return {"ok": True}
