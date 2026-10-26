from datetime import timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import and_, or_

from ..access import can_call
from ..deps import DB, CurrentUser
from ..models import CallLog, User, utcnow
from ..schemas import CallIn, CallUpdateIn
from ..serialize import call_out, user_out
from ..ws import HUB

router = APIRouter(prefix="/api/calls", tags=["calls"])


@router.get("")
def call_history(user: CurrentUser, db: DB, limit: int = 100):
    rows = (
        db.query(CallLog)
        .filter((CallLog.caller_id == user.id) | (CallLog.callee_id == user.id))
        .order_by(CallLog.created_at.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )
    entries = []
    for row in rows:
        peer_id = row.callee_id if row.caller_id == user.id else row.caller_id
        peer = db.get(User, peer_id)
        entries.append(
            {
                **call_out(row, user.id),
                "peer": user_out(peer, user.id) if peer else None,
            }
        )
    missed = (
        db.query(CallLog)
        .filter(
            CallLog.callee_id == user.id,
            CallLog.seen.is_(False),
            CallLog.status.in_(["missed", "declined", "ringing"]),
        )
        .count()
    )
    return {"calls": entries, "missed": missed}


@router.post("")
async def start_call(payload: CallIn, user: CurrentUser, db: DB):
    target = db.get(User, payload.callee_id)
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="لا يمكنك الاتصال بنفسك")
    can_call(db, user, target)

    if HUB.is_online(target.id):
        ringing_window = utcnow() - timedelta(seconds=90)
        busy = (
            db.query(CallLog)
            .filter((CallLog.caller_id == target.id) | (CallLog.callee_id == target.id))
            .filter(
                or_(
                    CallLog.status == "answered",
                    and_(CallLog.status == "ringing", CallLog.created_at > ringing_window),
                )
            )
            .first()
        )
        if busy:
            raise HTTPException(status_code=409, detail="المستخدم مشغول في مكالمة أخرى")

    call = CallLog(caller_id=user.id, callee_id=target.id, kind=payload.kind)
    db.add(call)
    db.commit()
    db.refresh(call)

    await HUB.send(
        target.id,
        {
            "type": "call:invite",
            "call": call_out(call, target.id),
            "peer": user_out(user, target.id),
        },
    )
    return {
        "call": call_out(call, user.id),
        "peer": user_out(target, user.id),
    }


@router.patch("/{call_id}")
async def update_call(call_id: str, payload: CallUpdateIn, user: CurrentUser, db: DB):
    call = db.get(CallLog, call_id)
    if not call or user.id not in (call.caller_id, call.callee_id):
        raise HTTPException(status_code=404, detail="المكالمة غير موجودة")
    call.status = payload.status
    if payload.status == "answered" and not call.answered_at:
        call.answered_at = utcnow()
    if payload.status in {"ended", "declined", "missed"}:
        call.ended_at = utcnow()
    if payload.duration:
        call.duration = payload.duration
    if payload.status == "ringing":
        call.seen = True
    db.commit()
    db.refresh(call)
    peer_id = call.callee_id if user.id == call.caller_id else call.caller_id
    await HUB.send(
        peer_id,
        {"type": "call:update", "call": call_out(call, peer_id)},
    )
    return {"call": call_out(call, user.id)}


@router.post("/seen")
def mark_calls_seen(user: CurrentUser, db: DB):
    db.query(CallLog).filter(
        CallLog.callee_id == user.id, CallLog.seen.is_(False)
    ).update({CallLog.seen: True}, synchronize_session=False)
    db.commit()
    return {"ok": True}
