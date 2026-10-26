import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from .access import participant, participant_ids
from .config import CORS_ORIGINS, MEDIA_DIR
from .db import SessionLocal, engine
from .models import Base, CallLog, User, utcnow
from .routers import (
    auth,
    backup,
    calls,
    chats,
    groups,
    media,
    settings_api,
    stories,
    users,
)
from .security import decode_token
from .serialize import call_out
from .ws import HUB

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("mersal")


def wait_for_database() -> None:
    for attempt in range(45):
        try:
            with engine.connect():
                return
        except OperationalError:
            if attempt == 44:
                raise
            time.sleep(1)


@asynccontextmanager
async def lifespan(_: FastAPI):
    wait_for_database()
    Base.metadata.create_all(engine)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    log.info("Mersal API ready")
    yield


app = FastAPI(title="Mersal API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, users, settings_api, chats, groups, stories, calls, media, backup):
    app.include_router(module.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "مرسال"}


async def broadcast_presence(user_id: str, online: bool) -> None:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user:
            return
        visible = user.settings.show_online if user.settings else True
    finally:
        db.close()
    if visible:
        await HUB.broadcast_all({"type": "presence", "user_id": user_id, "online": online})


async def handle_event(user_id: str, data: dict) -> None:
    kind = (data or {}).get("type") or ""
    if kind in {"ping", ""}:
        return

    db = SessionLocal()
    try:
        if kind == "typing":
            conversation_id = data.get("conversation_id")
            if conversation_id and participant(db, conversation_id, user_id):
                others = [
                    member
                    for member in participant_ids(db, conversation_id)
                    if member != user_id
                ]
                await HUB.broadcast(
                    others,
                    {
                        "type": "typing",
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                    },
                )
            return

        if not kind.startswith("call:"):
            return

        call = db.get(CallLog, data.get("call_id"))
        if not call or user_id not in (call.caller_id, call.callee_id):
            return
        peer_id = call.callee_id if user_id == call.caller_id else call.caller_id

        if kind == "call:accept":
            call.status = "answered"
            call.answered_at = utcnow()
        elif kind == "call:decline":
            call.status = "declined"
            call.ended_at = utcnow()
        elif kind == "call:end":
            call.status = data.get("status") or "ended"
            if call.status not in {"ended", "missed"}:
                call.status = "ended"
            call.ended_at = utcnow()
            call.duration = max(0, int(data.get("duration") or 0))
        elif kind == "call:missed":
            call.status = "missed"
            call.ended_at = utcnow()

        db.commit()
        db.refresh(call)

        payload = {
            "type": kind,
            "call_id": call.id,
            "from": user_id,
            "call": call_out(call, peer_id),
        }
        if "sdp" in data:
            payload["sdp"] = data["sdp"]
        if "candidate" in data:
            payload["candidate"] = data["candidate"]
        await HUB.send(peer_id, payload)
    except Exception:  # pragma: no cover - defensive
        log.exception("websocket event failed: %s", kind)
    finally:
        db.close()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str | None = Query(default=None)):
    user_id = decode_token(token or "")
    if not user_id:
        await ws.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = db.get(User, user_id)
    finally:
        db.close()
    if not user:
        await ws.close(code=4401)
        return

    await ws.accept()
    await HUB.connect(user_id, ws)
    await broadcast_presence(user_id, True)

    try:
        while True:
            data = await ws.receive_json()
            await handle_event(user_id, data)
    except WebSocketDisconnect:
        pass
    except Exception:  # pragma: no cover - malformed frame
        log.warning("websocket closed unexpectedly for %s", user_id)
    finally:
        await HUB.disconnect(user_id, ws)
        if not HUB.is_online(user_id):
            db = SessionLocal()
            try:
                stored = db.get(User, user_id)
                if stored:
                    stored.last_seen_at = utcnow()
                    db.commit()
            finally:
                db.close()
            await broadcast_presence(user_id, False)
