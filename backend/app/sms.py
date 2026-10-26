"""Optional SMS delivery for one-time codes.

The gateway credentials belong to the app owner and arrive through the
platform-managed environment file. When they are missing the API keeps
working and, inside the preview sandbox only, returns the code in the
response so the flow can be tested.
"""

import logging

import httpx

from .config import (
    SMS_ENABLED,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
)

log = logging.getLogger("mersal.sms")


def send_otp_sms(phone: str, code: str) -> bool:
    if not SMS_ENABLED:
        log.info("SMS gateway not configured; code generated locally")
        return False

    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/"
        f"{TWILIO_ACCOUNT_SID}/Messages.json"
    )
    try:
        response = httpx.post(
            url,
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            data={
                "To": phone,
                "From": TWILIO_FROM_NUMBER,
                "Body": f"رمز التحقق في مرسال: {code}",
            },
            timeout=10.0,
        )
        response.raise_for_status()
        return True
    except httpx.HTTPError as exc:  # pragma: no cover - network dependent
        log.warning("SMS delivery failed: %s", type(exc).__name__)
        return False
