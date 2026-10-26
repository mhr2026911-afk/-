from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def uid() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    phone: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80), default="")
    about: Mapped[str] = mapped_column(String(160), default="")
    avatar_media_id: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    settings: Mapped[UserSettings | None] = relationship(
        back_populates="user", uselist=False, lazy="joined"
    )


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    phone: Mapped[str] = mapped_column(String(24), index=True)
    code_hash: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # presence
    show_online: Mapped[bool] = mapped_column(Boolean, default=True)
    show_last_seen: Mapped[bool] = mapped_column(Boolean, default=True)
    # privacy
    read_receipts: Mapped[bool] = mapped_column(Boolean, default=True)
    profile_photo_privacy: Mapped[str] = mapped_column(String(16), default="everyone")
    messages_privacy: Mapped[str] = mapped_column(String(16), default="everyone")
    calls_privacy: Mapped[str] = mapped_column(String(16), default="everyone")
    groups_privacy: Mapped[str] = mapped_column(String(16), default="everyone")
    # security
    app_lock: Mapped[bool] = mapped_column(Boolean, default=False)
    # notifications
    notify_messages: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_groups: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_calls: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_stories: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_sound: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_vibration: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_preview: Mapped[bool] = mapped_column(Boolean, default=True)
    # backup & storage
    auto_backup: Mapped[bool] = mapped_column(Boolean, default=True)
    backup_network: Mapped[str] = mapped_column(String(16), default="wifi")
    last_backup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="settings")


class Contact(Base):
    __tablename__ = "contacts"

    owner_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class BlockedUser(Base):
    __tablename__ = "blocked_users"

    blocker_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    blocked_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    kind: Mapped[str] = mapped_column(String(16), default="direct")  # direct | group
    title: Mapped[str] = mapped_column(String(120), default="")
    about: Mapped[str] = mapped_column(String(240), default="")
    avatar_media_id: Mapped[str | None] = mapped_column(String(32))
    created_by: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )


class Participant(Base):
    __tablename__ = "participants"

    conversation_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(16), default="member")  # member | admin
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    conversation_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(16), default="text")
    body: Mapped[str] = mapped_column(Text, default="")
    media_id: Mapped[str | None] = mapped_column(String(32))
    meta: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )


class MessageReceipt(Base):
    __tablename__ = "message_receipts"

    message_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MediaFile(Base):
    __tablename__ = "media_files"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16), default="file")
    filename: Mapped[str] = mapped_column(String(200), default="")
    mime: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    size: Mapped[int] = mapped_column(BigInteger, default=0)
    path: Mapped[str] = mapped_column(String(400))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class Story(Base):
    __tablename__ = "stories"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    media_id: Mapped[str | None] = mapped_column(String(32))
    text: Mapped[str] = mapped_column(Text, default="")
    background: Mapped[str] = mapped_column(String(24), default="#0f6b57")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class StoryView(Base):
    __tablename__ = "story_views"

    story_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("stories.id", ondelete="CASCADE"), primary_key=True
    )
    viewer_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class CallLog(Base):
    __tablename__ = "calls"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    caller_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    callee_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(8), default="audio")  # audio | video
    status: Mapped[str] = mapped_column(String(16), default="ringing")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration: Mapped[int] = mapped_column(Integer, default=0)
    seen: Mapped[bool] = mapped_column(Boolean, default=False)
