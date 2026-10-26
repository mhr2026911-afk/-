import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func

from ..access import participant
from ..config import MAX_UPLOAD_BYTES, MEDIA_DIR
from ..deps import DB, CurrentUser, user_from_query_token
from ..models import Conversation, MediaFile, Message, Story, User, utcnow

router = APIRouter(prefix="/api", tags=["media"])


def _kind_for(mime: str) -> str:
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    return "file"


@router.post("/media")
def upload_media(user: CurrentUser, db: DB, file: UploadFile = File(...)):
    mime = file.content_type or "application/octet-stream"
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="حجم الملف أكبر من الحد المسموح")
    if not data:
        raise HTTPException(status_code=422, detail="الملف فارغ")

    kind = _kind_for(mime)
    media = MediaFile(
        owner_id=user.id,
        kind=kind,
        filename=(file.filename or "attachment")[:200],
        mime=mime[:120],
        size=len(data),
    )
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix[:10] or mimetypes.guess_extension(mime) or ""
    path = MEDIA_DIR / f"{media.id}{suffix}"
    path.write_bytes(data)
    media.path = str(path)
    db.add(media)
    db.commit()
    db.refresh(media)

    return {
        "media": {
            "id": media.id,
            "kind": media.kind,
            "filename": media.filename,
            "mime": media.mime,
            "size": media.size,
        }
    }


def _can_view(db, media: MediaFile, user_id: str) -> bool:
    if media.owner_id == user_id:
        return True
    message = db.query(Message).filter(Message.media_id == media.id).first()
    if message and participant(db, message.conversation_id, user_id):
        return True
    story = (
        db.query(Story)
        .filter(Story.media_id == media.id, Story.expires_at > utcnow())
        .first()
    )
    if story:
        return True
    if db.query(User).filter(User.avatar_media_id == media.id).first():
        return True
    conversation = (
        db.query(Conversation).filter(Conversation.avatar_media_id == media.id).first()
    )
    if conversation and participant(db, conversation.id, user_id):
        return True
    return False


@router.get("/media/{media_id}")
def download_media(
    media_id: str,
    db: DB,
    user: User = Depends(user_from_query_token),
):
    media = db.get(MediaFile, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    if not _can_view(db, media, user.id):
        raise HTTPException(status_code=403, detail="لا تملك صلاحية الوصول لهذا الملف")
    path = Path(media.path)
    if not path.exists():
        raise HTTPException(status_code=410, detail="الملف غير متوفر")
    return FileResponse(
        path,
        media_type=media.mime,
        filename=media.filename,
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.get("/storage")
def storage_usage(user: CurrentUser, db: DB):
    rows = (
        db.query(MediaFile.kind, func.count(MediaFile.id), func.coalesce(func.sum(MediaFile.size), 0))
        .filter(MediaFile.owner_id == user.id)
        .group_by(MediaFile.kind)
        .all()
    )
    breakdown = [
        {"kind": kind, "count": int(count), "bytes": int(total)} for kind, count, total in rows
    ]
    total = sum(item["bytes"] for item in breakdown)
    return {"total": total, "items": breakdown}


@router.get("/media")
def list_my_media(user: CurrentUser, db: DB, limit: int = Query(default=60, le=200)):
    rows = (
        db.query(MediaFile)
        .filter(MediaFile.owner_id == user.id)
        .order_by(MediaFile.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "media": [
            {
                "id": row.id,
                "kind": row.kind,
                "filename": row.filename,
                "mime": row.mime,
                "size": row.size,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]
    }
