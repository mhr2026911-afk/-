from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import (
    CallLog,
    Contact,
    Conversation,
    MediaFile,
    Message,
    MessageReceipt,
    Participant,
    Story,
    StoryView,
    User,
)
from .ws import HUB


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def contact_ids_for(db: Session, owner_id: str) -> set[str]:
    rows = db.query(Contact.user_id).filter(Contact.owner_id == owner_id).all()
    return {r[0] for r in rows}


def user_out(
    user: User,
    viewer_id: str | None,
    contact_ids: set[str] | None = None,
    online_ids: set[str] | None = None,
) -> dict:
    settings = user.settings
    contacts = contact_ids or set()
    online = (online_ids if online_ids is not None else HUB.online_ids())
    is_self = user.id == viewer_id
    is_contact = user.id in contacts

    avatar = user.avatar_media_id
    photo_privacy = settings.profile_photo_privacy if settings else "everyone"
    if avatar and not is_self:
        if photo_privacy == "nobody":
            avatar = None
        elif photo_privacy == "contacts" and not is_contact:
            avatar = None

    show_online = settings.show_online if settings else True
    show_last_seen = settings.show_last_seen if settings else True

    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "about": user.about,
        "avatar_media_id": avatar,
        "online": bool(user.id in online) if (show_online or is_self) else None,
        "last_seen_at": iso(user.last_seen_at) if (show_last_seen or is_self) else None,
        "is_contact": is_contact,
        "is_self": is_self,
    }


def message_status(receipts: list[MessageReceipt]) -> tuple[str, int]:
    """Delivery state of an outgoing message, based on every other member."""
    if not receipts:
        return "sent", 0
    read_count = sum(1 for r in receipts if r.read_at)
    if read_count == len(receipts):
        return "read", read_count
    if all(r.delivered_at for r in receipts):
        return "delivered", read_count
    return "sent", read_count


def receipts_by_message(db: Session, message_ids: list[str]) -> dict[str, list[MessageReceipt]]:
    if not message_ids:
        return {}
    rows = (
        db.query(MessageReceipt)
        .filter(MessageReceipt.message_id.in_(message_ids))
        .all()
    )
    grouped: dict[str, list[MessageReceipt]] = {}
    for row in rows:
        grouped.setdefault(row.message_id, []).append(row)
    return grouped


def message_out(
    message: Message,
    viewer_id: str,
    receipts: list[MessageReceipt] | None = None,
) -> dict:
    others = [r for r in (receipts or []) if r.user_id != message.sender_id]
    if message.sender_id == viewer_id:
        state, read_count = message_status(others)
    else:
        state, read_count = "read", 0
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "kind": message.kind,
        "body": message.body,
        "media_id": message.media_id,
        "meta": message.meta or {},
        "created_at": iso(message.created_at),
        "status": state,
        "read_count": read_count,
    }


def conversation_out(
    db: Session,
    conversation: Conversation,
    viewer_id: str,
    contact_ids: set[str] | None = None,
    online_ids: set[str] | None = None,
) -> dict:
    members = (
        db.query(Participant, User)
        .join(User, User.id == Participant.user_id)
        .filter(Participant.conversation_id == conversation.id)
        .all()
    )
    my_role = "member"
    others: list[User] = []
    for participant, user in members:
        if participant.user_id == viewer_id:
            my_role = participant.role
        else:
            others.append(user)

    unread = (
        db.query(func.count(MessageReceipt.message_id))
        .join(Message, Message.id == MessageReceipt.message_id)
        .filter(
            MessageReceipt.user_id == viewer_id,
            MessageReceipt.read_at.is_(None),
            Message.conversation_id == conversation.id,
        )
        .scalar()
        or 0
    )

    last = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .first()
    )
    last_receipts = receipts_by_message(db, [last.id]).get(last.id, []) if last else []

    if conversation.kind == "group":
        title = conversation.title or "مجموعة مرسال"
        avatar = conversation.avatar_media_id
        peer = None
    else:
        peer = others[0] if others else None
        title = peer.name if peer and peer.name else (peer.phone if peer else "محادثة")
        avatar = peer.avatar_media_id if peer else None

    return {
        "id": conversation.id,
        "kind": conversation.kind,
        "title": title,
        "about": conversation.about,
        "avatar_media_id": avatar,
        "peer": user_out(peer, viewer_id, contact_ids, online_ids) if peer else None,
        "member_count": len(members),
        "my_role": my_role,
        "unread": int(unread),
        "last_message_at": iso(conversation.last_message_at),
        "last_message": message_out(last, viewer_id, last_receipts) if last else None,
    }


def story_out(
    story: Story,
    user: User,
    viewer_id: str,
    viewed: bool,
    contact_ids: set[str] | None = None,
    online_ids: set[str] | None = None,
) -> dict:
    return {
        "id": story.id,
        "user": user_out(user, viewer_id, contact_ids, online_ids),
        "media_id": story.media_id,
        "text": story.text,
        "background": story.background,
        "created_at": iso(story.created_at),
        "expires_at": iso(story.expires_at),
        "viewed": viewed,
    }


def story_viewers(db: Session, story_id: str, viewer_id: str) -> list[dict]:
    rows = (
        db.query(StoryView, User)
        .join(User, User.id == StoryView.viewer_id)
        .filter(StoryView.story_id == story_id)
        .order_by(StoryView.viewed_at.desc())
        .all()
    )
    return [
        {**user_out(user, viewer_id), "viewed_at": iso(view.viewed_at)}
        for view, user in rows
    ]


def call_out(call: CallLog, viewer_id: str) -> dict:
    return {
        "id": call.id,
        "caller_id": call.caller_id,
        "callee_id": call.callee_id,
        "kind": call.kind,
        "status": call.status,
        "direction": "outgoing" if call.caller_id == viewer_id else "incoming",
        "created_at": iso(call.created_at),
        "duration": call.duration,
        "seen": call.seen,
    }


def media_out(media: MediaFile, token: str | None = None) -> dict:
    url = f"/api/media/{media.id}"
    if token:
        url = f"{url}?token={token}"
    return {
        "id": media.id,
        "kind": media.kind,
        "filename": media.filename,
        "mime": media.mime,
        "size": media.size,
        "url": url,
        "created_at": iso(media.created_at),
    }


def settings_out(settings) -> dict:
    return {
        "show_online": settings.show_online,
        "show_last_seen": settings.show_last_seen,
        "read_receipts": settings.read_receipts,
        "profile_photo_privacy": settings.profile_photo_privacy,
        "messages_privacy": settings.messages_privacy,
        "calls_privacy": settings.calls_privacy,
        "groups_privacy": settings.groups_privacy,
        "app_lock": settings.app_lock,
        "notify_messages": settings.notify_messages,
        "notify_groups": settings.notify_groups,
        "notify_calls": settings.notify_calls,
        "notify_stories": settings.notify_stories,
        "notify_sound": settings.notify_sound,
        "notify_vibration": settings.notify_vibration,
        "notify_preview": settings.notify_preview,
        "auto_backup": settings.auto_backup,
        "backup_network": settings.backup_network,
        "last_backup_at": iso(settings.last_backup_at),
    }
