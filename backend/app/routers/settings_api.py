from fastapi import APIRouter

from ..deps import DB, CurrentUser
from ..schemas import SettingsIn
from ..serialize import settings_out

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def read_settings(user: CurrentUser):
    return {"settings": settings_out(user.settings)}


@router.patch("")
def update_settings(payload: SettingsIn, user: CurrentUser, db: DB):
    changes = payload.model_dump(exclude_none=True)
    for key, value in changes.items():
        setattr(user.settings, key, value)
    db.commit()
    db.refresh(user.settings)
    return {"settings": settings_out(user.settings)}
