from datetime import timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import func

from ..config import (
    OTP_MAX_ATTEMPTS,
    OTP_MAX_REQUESTS,
    OTP_WINDOW_MINUTES,
    PREVIEW_MODE,
)
from ..deps import DB
from ..models import OtpCode, User, UserSettings, utcnow
from ..schemas import PhoneIn, VerifyIn
from ..security import (
    create_token,
    generate_otp,
    hash_otp,
    normalize_phone,
    otp_expiry,
    valid_phone,
)
from ..serialize import settings_out, user_out
from ..sms import send_otp_sms

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/request-code")
def request_code(payload: PhoneIn, db: DB):
    phone = normalize_phone(payload.phone)
    if not valid_phone(phone):
        raise HTTPException(status_code=422, detail="رقم الهاتف غير صحيح")

    window_start = utcnow() - timedelta(minutes=OTP_WINDOW_MINUTES)
    recent = (
        db.query(func.count(OtpCode.id))
        .filter(OtpCode.phone == phone, OtpCode.created_at >= window_start)
        .scalar()
        or 0
    )
    if recent >= OTP_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="طلبات كثيرة على هذا الرقم، حاول بعد قليل",
        )

    code = generate_otp()
    db.add(
        OtpCode(phone=phone, code_hash=hash_otp(phone, code), expires_at=otp_expiry())
    )
    db.commit()

    delivered = send_otp_sms(phone, code)
    user = db.query(User).filter(User.phone == phone).first()

    body = {
        "sent": True,
        "sms_delivered": delivered,
        "registered": user is not None,
    }
    # The preview sandbox has no SMS gateway: hand the code to the screen so
    # the flow is usable. This never happens outside BASE44_PREVIEW_MODE=1.
    if PREVIEW_MODE and not delivered:
        body["dev_code"] = code
    return body


@router.post("/verify")
def verify_code(payload: VerifyIn, db: DB):
    phone = normalize_phone(payload.phone)
    if not valid_phone(phone):
        raise HTTPException(status_code=422, detail="رقم الهاتف غير صحيح")

    record = (
        db.query(OtpCode)
        .filter(OtpCode.phone == phone, OtpCode.consumed.is_(False))
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=400, detail="اطلب رمز تحقق جديدًا")

    if record.expires_at.replace(tzinfo=None) < utcnow().replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="انتهت صلاحية الرمز، اطلب رمزًا جديدًا")
    if record.attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="محاولات خاطئة كثيرة، اطلب رمزًا جديدًا")

    if hash_otp(phone, payload.code.strip()) != record.code_hash:
        record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="رمز التحقق غير صحيح")

    record.consumed = True

    user = db.query(User).filter(User.phone == phone).first()
    is_new = user is None
    if is_new:
        name = (payload.name or "").strip()
        if len(name) < 2:
            db.rollback()
            raise HTTPException(status_code=400, detail="الاسم مطلوب لإنشاء الحساب")
        user = User(phone=phone, name=name[:80])
        db.add(user)
        db.flush()
        db.add(UserSettings(user_id=user.id))
        db.flush()
        db.refresh(user)
    elif payload.name and len(payload.name.strip()) >= 2:
        user.name = payload.name.strip()[:80]

    user.last_seen_at = utcnow()
    db.commit()
    db.refresh(user)

    return {
        "token": create_token(user.id),
        "is_new": is_new,
        "user": user_out(user, user.id),
        "settings": settings_out(user.settings),
    }
