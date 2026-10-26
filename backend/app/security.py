import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from .config import OTP_TTL_MINUTES, SECRET_KEY, TOKEN_TTL_DAYS


def normalize_phone(raw: str) -> str:
    """Keep a single leading + and digits only."""
    digits = "".join(ch for ch in (raw or "") if ch.isdigit() or ch == "+")
    if digits.startswith("+"):
        digits = "+" + digits[1:].replace("+", "")
    else:
        digits = digits.replace("+", "")
    return digits


def valid_phone(phone: str) -> bool:
    if not phone:
        return False
    digits = phone[1:] if phone.startswith("+") else phone
    return 7 <= len(digits) <= 15 and digits.isdigit()


def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=TOKEN_TTL_DAYS)).timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(phone: str, code: str) -> str:
    return hmac.new(
        SECRET_KEY.encode(), f"{phone}:{code}".encode(), hashlib.sha256
    ).hexdigest()


def otp_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)


def mask_phone(phone: str) -> str:
    if len(phone) < 6:
        return phone
    return f"{phone[:4]}***{phone[-3:]}"
