from fastapi import HTTPException
from sqlalchemy.orm import Session

from .deps import is_blocked, is_contact
from .models import Conversation, Participant, User


def participant(db: Session, conversation_id: str, user_id: str) -> Participant | None:
    return (
        db.query(Participant)
        .filter(
            Participant.conversation_id == conversation_id,
            Participant.user_id == user_id,
        )
        .first()
    )


def require_participant(db: Session, conversation_id: str, user_id: str) -> Participant:
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="المحادثة غير موجودة")
    row = participant(db, conversation_id, user_id)
    if not row:
        raise HTTPException(status_code=403, detail="لا تملك صلاحية الوصول لهذه المحادثة")
    return row


def participant_ids(db: Session, conversation_id: str) -> list[str]:
    rows = (
        db.query(Participant.user_id)
        .filter(Participant.conversation_id == conversation_id)
        .all()
    )
    return [row[0] for row in rows]


def _privacy_allows(db: Session, target: User, actor_id: str, mode: str) -> bool:
    if mode == "everyone":
        return True
    if mode == "nobody":
        return False
    return is_contact(db, target.id, actor_id)


def can_message(db: Session, sender: User, target: User) -> None:
    if is_blocked(db, sender.id, target.id):
        raise HTTPException(status_code=403, detail="لا يمكن إرسال رسائل إلى هذا المستخدم")
    allowed = _privacy_allows(
        db, target, sender.id, target.settings.messages_privacy if target.settings else "everyone"
    )
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="هذا المستخدم لا يسمح باستقبال الرسائل منك حسب إعدادات الخصوصية",
        )


def can_call(db: Session, caller: User, target: User) -> None:
    if is_blocked(db, caller.id, target.id):
        raise HTTPException(status_code=403, detail="لا يمكن إجراء مكالمة مع هذا المستخدم")
    allowed = _privacy_allows(
        db, target, caller.id, target.settings.calls_privacy if target.settings else "everyone"
    )
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="هذا المستخدم لا يسمح باستقبال المكالمات منك حسب إعدادات الخصوصية",
        )
