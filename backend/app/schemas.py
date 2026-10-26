from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Privacy = Literal["everyone", "contacts", "nobody"]
MessageKind = Literal["text", "image", "video", "audio", "file", "location"]


class PhoneIn(BaseModel):
    phone: str = Field(min_length=6, max_length=24)


class VerifyIn(BaseModel):
    phone: str = Field(min_length=6, max_length=24)
    code: str = Field(min_length=4, max_length=8)
    name: str | None = Field(default=None, max_length=80)


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    about: str | None = Field(default=None, max_length=160)
    avatar_media_id: str | None = None


class ContactIn(BaseModel):
    phone: str = Field(min_length=6, max_length=24)


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    show_online: bool | None = None
    show_last_seen: bool | None = None
    read_receipts: bool | None = None
    profile_photo_privacy: Privacy | None = None
    messages_privacy: Privacy | None = None
    calls_privacy: Privacy | None = None
    groups_privacy: Privacy | None = None
    app_lock: bool | None = None
    notify_messages: bool | None = None
    notify_groups: bool | None = None
    notify_calls: bool | None = None
    notify_stories: bool | None = None
    notify_sound: bool | None = None
    notify_vibration: bool | None = None
    notify_preview: bool | None = None
    auto_backup: bool | None = None
    backup_network: Literal["wifi", "any"] | None = None


class DirectChatIn(BaseModel):
    user_id: str


class MessageIn(BaseModel):
    kind: MessageKind = "text"
    body: str = Field(default="", max_length=8000)
    media_id: str | None = None
    meta: dict | None = None


class GroupIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    member_ids: list[str] = Field(default_factory=list)
    about: str = Field(default="", max_length=240)


class GroupUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    about: str | None = Field(default=None, max_length=240)
    avatar_media_id: str | None = None


class MemberIn(BaseModel):
    user_id: str


class StoryIn(BaseModel):
    text: str = Field(default="", max_length=500)
    media_id: str | None = None
    background: str = Field(default="#0f6b57", max_length=24)


class CallIn(BaseModel):
    callee_id: str
    kind: Literal["audio", "video"] = "audio"


class CallUpdateIn(BaseModel):
    status: Literal["answered", "declined", "missed", "ended", "ringing"]
    duration: int = 0
