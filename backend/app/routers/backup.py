import json
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from ..deps import DB, CurrentUser, user_from_query_token
from ..models import (
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
    utcnow,
)
from ..serialize import settings_out, user_out

router = APIRouter(prefix="/api/backup", tags=["backup"])


def build_backup(db, user: User) -> dict:
    conversations = (
        db.query(Conversation)
        .join(Participant, Participant.conversation_id == Conversation.id)
        .filter(Participant.user_id == user.id)
        .all()
    )
    data = {
        "app": "مرسال",
        "version": 1,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "profile": {
            "name": user.name,
            "phone": user.phone,
            "about": user.about,
            "avatar_media_id": user.avatar_media_id,
            "created_at": user.created_at.isoformat(),
        },
        "settings": settings_out(user.settings),
        "contacts": [
            {
                "phone": contact.phone,
                "name": contact.name,
            }
            for contact in db.query(User)
            .join(Contact, Contact.user_id == User.id)
            .filter(Contact.owner_id == user.id)
            .all()
        ],
        "conversations": [],
        "stories": [],
        "calls": [],
        "media": [],
    }

    for conversation in conversations:
        messages = (
            db.query(Message)
            .filter(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.asc())
            .all()
        )
        receipts = {
            receipt.message_id: receipt
            for receipt in db.query(MessageReceipt)
            .filter(MessageReceipt.user_id == user.id)
            .all()
        }
        data["conversations"].append(
            {
                "id": conversation.id,
                "kind": conversation.kind,
                "title": conversation.title,
                "created_at": conversation.created_at.isoformat(),
                "messages": [
                    {
                        "id": message.id,
                        "sender_id": message.sender_id,
                        "kind": message.kind,
                        "body": message.body,
                        "media_id": message.media_id,
                        "meta": message.meta,
                        "created_at": message.created_at.isoformat(),
                        "read_at": (
                            receipts[message.id].read_at.isoformat()
                            if message.id in receipts and receipts[message.id].read_at
                            else None
                        ),
                    }
                    for message in messages
                ],
            }
        )

    stories = db.query(Story).filter(Story.user_id == user.id).all()
    data["stories"] = [
        {
            "id": story.id,
            "text": story.text,
            "media_id": story.media_id,
            "created_at": story.created_at.isoformat(),
            "expires_at": story.expires_at.isoformat(),
            "views": db.query(StoryView)
            .filter(StoryView.story_id == story.id)
            .count(),
        }
        for story in stories
    ]

    calls = (
        db.query(CallLog)
        .filter((CallLog.caller_id == user.id) | (CallLog.callee_id == user.id))
        .order_by(CallLog.created_at.desc())
        .all()
    )
    data["calls"] = [
        {
            "id": call.id,
            "direction": "outgoing" if call.caller_id == user.id else "incoming",
            "kind": call.kind,
            "status": call.status,
            "duration": call.duration,
            "created_at": call.created_at.isoformat(),
        }
        for call in calls
    ]

    data["media"] = [
        {
            "id": media.id,
            "kind": media.kind,
            "filename": media.filename,
            "size": media.size,
            "created_at": media.created_at.isoformat(),
        }
        for media in db.query(MediaFile).filter(MediaFile.owner_id == user.id).all()
    ]
    return data


@router.get("/export")
def export_backup(db: DB, user: User = Depends(user_from_query_token)):
    data = build_backup(db, user)
    payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"mersal-backup-{datetime.utcnow().strftime('%Y%m%d')}.json"
    return Response(
        content=payload,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/run")
def run_backup(user: CurrentUser, db: DB):
    data = build_backup(db, user)
    size = len(json.dumps(data, ensure_ascii=False).encode("utf-8"))
    user.settings.last_backup_at = utcnow()
    db.commit()
    db.refresh(user.settings)
    return {
        "ok": True,
        "size": size,
        "messages": sum(len(c["messages"]) for c in data["conversations"]),
        "last_backup_at": user.settings.last_backup_at.isoformat(),
    }
