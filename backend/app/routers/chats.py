from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_

from ..access import can_message, participant_ids, require_participant
from ..deps import DB, CurrentUser
from ..models import (
    Conversation,
    Message,
    MessageReceipt,
    Participant,
    User,
    utcnow,
)
from ..schemas import DirectChatIn, MessageIn
from ..serialize import (
    contact_ids_for,
    conversation_out,
    message_out,
    receipts_by_message,
    user_out,
)
from ..ws import HUB

router = APIRouter(prefix="/api/chats", tags=["chats"])

PAGE_SIZE = 60


def _parse_before(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


@router.get("")
def list_chats(user: CurrentUser, db: DB):
    conversations = (
        db.query(Conversation)
        .join(Participant, Participant.conversation_id == Conversation.id)
        .filter(Participant.user_id == user.id)
        .order_by(Conversation.last_message_at.desc())
        .all()
    )
    ids = contact_ids_for(db, user.id)
    online = HUB.online_ids()
    return {
        "chats": [conversation_out(db, conv, user.id, ids, online) for conv in conversations]
    }


@router.post("/direct")
def open_direct_chat(payload: DirectChatIn, user: CurrentUser, db: DB):
    if payload.user_id == user.id:
        raise HTTPException(status_code=400, detail="لا يمكن بدء محادثة مع نفسك")
    target = db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    can_message(db, user, target)

    mine = db.query(Participant.conversation_id).filter(Participant.user_id == user.id)
    theirs = db.query(Participant.conversation_id).filter(Participant.user_id == target.id)
    existing = (
        db.query(Conversation)
        .filter(
            Conversation.kind == "direct",
            Conversation.id.in_(mine),
            Conversation.id.in_(theirs),
        )
        .first()
    )
    if existing:
        conversation = existing
    else:
        conversation = Conversation(kind="direct", created_by=user.id)
        db.add(conversation)
        db.flush()
        db.add(Participant(conversation_id=conversation.id, user_id=user.id))
        db.add(Participant(conversation_id=conversation.id, user_id=target.id))
        db.commit()
        db.refresh(conversation)

    ids = contact_ids_for(db, user.id)
    return {
        "conversation": conversation_out(db, conversation, user.id, ids, HUB.online_ids())
    }


@router.get("/{conversation_id}")
def get_chat(conversation_id: str, user: CurrentUser, db: DB):
    require_participant(db, conversation_id, user.id)
    conversation = db.get(Conversation, conversation_id)
    ids = contact_ids_for(db, user.id)
    online = HUB.online_ids()
    members = (
        db.query(Participant, User)
        .join(User, User.id == Participant.user_id)
        .filter(Participant.conversation_id == conversation_id)
        .all()
    )
    return {
        "conversation": conversation_out(db, conversation, user.id, ids, online),
        "members": [
            {
                "user": user_out(member_user, user.id, ids, online),
                "role": row.role,
                "joined_at": row.joined_at.isoformat(),
            }
            for row, member_user in members
        ],
    }


@router.get("/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    user: CurrentUser,
    db: DB,
    limit: int = Query(default=PAGE_SIZE, ge=1, le=200),
    before: str | None = None,
):
    require_participant(db, conversation_id, user.id)

    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    cursor = _parse_before(before)
    if cursor:
        query = query.filter(Message.created_at < cursor)
    rows = query.order_by(Message.created_at.desc()).limit(limit).all()
    rows.reverse()

    message_ids = [row.id for row in rows]
    # Fetching a conversation means the messages reached this device.
    pending = (
        db.query(MessageReceipt)
        .filter(
            MessageReceipt.message_id.in_(message_ids),
            MessageReceipt.user_id == user.id,
            MessageReceipt.delivered_at.is_(None),
        )
        .all()
        if message_ids
        else []
    )
    if pending:
        now = utcnow()
        senders = defaultdict(list)
        by_id = {row.id: row for row in rows}
        for receipt in pending:
            receipt.delivered_at = now
            senders[by_id[receipt.message_id].sender_id].append(receipt.message_id)
        db.commit()
        for sender_id, ids in senders.items():
            await HUB.send(
                sender_id,
                {
                    "type": "receipt",
                    "conversation_id": conversation_id,
                    "message_ids": ids,
                    "status": "delivered",
                },
            )

    grouped = receipts_by_message(db, message_ids)
    return {
        "messages": [
            message_out(row, user.id, grouped.get(row.id, [])) for row in rows
        ],
        "has_more": len(rows) == limit,
    }


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    payload: MessageIn,
    user: CurrentUser,
    db: DB,
):
    require_participant(db, conversation_id, user.id)
    conversation = db.get(Conversation, conversation_id)
    members = participant_ids(db, conversation_id)
    others = [member for member in members if member != user.id]

    if conversation.kind == "direct" and others:
        target = db.get(User, others[0])
        if target:
            can_message(db, user, target)

    kind = payload.kind
    body = (payload.body or "").strip()
    if kind == "text" and not body:
        raise HTTPException(status_code=422, detail="لا يمكن إرسال رسالة فارغة")
    if kind in {"image", "video", "audio", "file"} and not payload.media_id:
        raise HTTPException(status_code=422, detail="الملف المرفق غير موجود")
    if kind == "location" and not payload.meta:
        raise HTTPException(status_code=422, detail="الموقع غير صحيح")

    now = utcnow()
    message = Message(
        conversation_id=conversation_id,
        sender_id=user.id,
        kind=kind,
        body=body[:8000],
        media_id=payload.media_id,
        meta=payload.meta,
        created_at=now,
    )
    db.add(message)
    conversation.last_message_at = now
    db.flush()

    online = HUB.online_ids()
    receipts = []
    for member in others:
        receipt = MessageReceipt(
            message_id=message.id,
            user_id=member,
            delivered_at=now if member in online else None,
        )
        db.add(receipt)
        receipts.append(receipt)
    db.commit()
    db.refresh(message)

    for member in others:
        await HUB.send(
            member,
            {
                "type": "message:new",
                "conversation_id": conversation_id,
                "message": message_out(message, member, receipts),
            },
        )

    return {"message": message_out(message, user.id, receipts), "sent": True}


@router.post("/{conversation_id}/read")
async def mark_read(conversation_id: str, user: CurrentUser, db: DB):
    row = require_participant(db, conversation_id, user.id)
    pending = (
        db.query(MessageReceipt, Message)
        .join(Message, Message.id == MessageReceipt.message_id)
        .filter(
            MessageReceipt.user_id == user.id,
            MessageReceipt.read_at.is_(None),
            Message.conversation_id == conversation_id,
            Message.sender_id != user.id,
        )
        .all()
    )
    if not pending:
        return {"updated": 0}

    now = utcnow()
    receipts_enabled = user.settings.read_receipts if user.settings else True
    by_sender: dict[str, list[str]] = defaultdict(list)
    for receipt, message in pending:
        if receipt.delivered_at is None:
            receipt.delivered_at = now
        if receipts_enabled:
            receipt.read_at = now
        by_sender[message.sender_id].append(message.id)
    row.last_read_at = now
    db.commit()

    for sender_id, ids in by_sender.items():
        await HUB.send(
            sender_id,
            {
                "type": "receipt",
                "conversation_id": conversation_id,
                "message_ids": ids,
                "status": "read" if receipts_enabled else "delivered",
            },
        )
    return {"updated": len(pending)}


@router.get("/{conversation_id}/media")
def conversation_media(conversation_id: str, user: CurrentUser, db: DB):
    require_participant(db, conversation_id, user.id)
    rows = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.media_id.isnot(None),
        )
        .order_by(Message.created_at.desc())
        .all()
    )
    return {
        "media": [
            {
                "message_id": row.id,
                "kind": row.kind,
                "media_id": row.media_id,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]
    }
