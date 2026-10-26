from datetime import timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import func

from ..config import STORIES_TTL_HOURS
from ..deps import DB, CurrentUser
from ..models import Contact, Story, StoryView, User, utcnow
from ..schemas import StoryIn
from ..serialize import contact_ids_for, story_out, story_viewers, user_out
from ..ws import HUB

router = APIRouter(prefix="/api/stories", tags=["stories"])


def _active(db):
    return db.query(Story).filter(Story.expires_at > utcnow())


@router.post("")
async def create_story(payload: StoryIn, user: CurrentUser, db: DB):
    text = payload.text.strip()
    if not text and not payload.media_id:
        raise HTTPException(status_code=422, detail="أضف نصًا أو صورة إلى الحالة")
    now = utcnow()
    story = Story(
        user_id=user.id,
        media_id=payload.media_id,
        text=text[:500],
        background=payload.background[:24],
        created_at=now,
        expires_at=now + timedelta(hours=STORIES_TTL_HOURS),
    )
    db.add(story)
    db.commit()
    db.refresh(story)

    # Notify people who saved me as a contact.
    followers = [
        row[0]
        for row in db.query(Contact.owner_id).filter(Contact.user_id == user.id).all()
    ]
    await HUB.broadcast(
        followers,
        {"type": "story:new", "user_id": user.id},
    )
    return {"story": story_out(story, user, user.id, False)}


@router.get("")
def stories_feed(user: CurrentUser, db: DB):
    ids = contact_ids_for(db, user.id)
    visible_user_ids = list(ids | {user.id})

    rows = (
        _active(db)
        .filter(Story.user_id.in_(visible_user_ids))
        .order_by(Story.created_at.asc())
        .all()
    )
    viewed_ids = {
        row[0]
        for row in db.query(StoryView.story_id)
        .filter(StoryView.viewer_id == user.id)
        .all()
    }
    grouped: dict[str, list[dict]] = {}
    users: dict[str, User] = {}
    for story in rows:
        if story.user_id not in users:
            owner = db.get(User, story.user_id)
            if not owner:
                continue
            users[owner.id] = owner
        grouped.setdefault(story.user_id, []).append(
            story_out(
                story,
                users[story.user_id],
                user.id,
                story.id in viewed_ids,
                ids,
                HUB.online_ids(),
            )
        )

    online = HUB.online_ids()
    feed = []
    for owner_id, items in grouped.items():
        feed.append(
            {
                "user": user_out(users[owner_id], user.id, ids, online),
                "stories": items,
                "unseen": sum(1 for item in items if not item["viewed"]),
                "is_me": owner_id == user.id,
            }
        )
    feed.sort(key=lambda entry: (entry["is_me"], -entry["unseen"], entry["user"]["name"]))
    return {"feed": feed}


@router.post("/{story_id}/view")
def view_story(story_id: str, user: CurrentUser, db: DB):
    story = db.get(Story, story_id)
    if not story or story.expires_at.replace(tzinfo=None) < utcnow().replace(tzinfo=None):
        raise HTTPException(status_code=404, detail="الحالة غير متاحة")
    if story.user_id == user.id:
        return {"ok": True, "views": _view_count(db, story_id)}
    exists = (
        db.query(StoryView)
        .filter(StoryView.story_id == story_id, StoryView.viewer_id == user.id)
        .first()
    )
    if not exists:
        db.add(StoryView(story_id=story_id, viewer_id=user.id))
        db.commit()
    return {"ok": True, "views": _view_count(db, story_id)}


def _view_count(db, story_id: str) -> int:
    return (
        db.query(func.count(StoryView.viewer_id))
        .filter(StoryView.story_id == story_id)
        .scalar()
        or 0
    )


@router.get("/{story_id}/viewers")
def viewers(story_id: str, user: CurrentUser, db: DB):
    story = db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="الحالة غير موجودة")
    if story.user_id != user.id:
        raise HTTPException(status_code=403, detail="قائمة المشاهدين تظهر لصاحب الحالة فقط")
    return {"viewers": story_viewers(db, story_id, user.id)}


@router.delete("/{story_id}")
def delete_story(story_id: str, user: CurrentUser, db: DB):
    story = db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="الحالة غير موجودة")
    if story.user_id != user.id:
        raise HTTPException(status_code=403, detail="لا يمكنك حذف حالة غيرك")
    db.query(StoryView).filter(StoryView.story_id == story_id).delete()
    db.delete(story)
    db.commit()
    return {"ok": True}
