"""Runtime configuration for the Mersal API.

Everything is read from the environment so the same code runs in the sandbox
preview and in any other deployment.
"""

import os
from pathlib import Path

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://mersal:mersal@db:5432/mersal",
)

# Used to sign session tokens and one-time codes.
SECRET_KEY = os.getenv("SECRET_KEY", "mersal-development-secret")

# "1" only inside the Base44 preview sandbox. When unset, the API never
# returns one-time codes in HTTP responses (they must be delivered by SMS).
PREVIEW_MODE = os.getenv("BASE44_PREVIEW_MODE") == "1"

MEDIA_DIR = Path(os.getenv("MEDIA_DIR", "/data/media"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))

TOKEN_TTL_DAYS = 30
OTP_TTL_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
OTP_WINDOW_MINUTES = 15
OTP_MAX_REQUESTS = 5

# Optional SMS gateway. Without these the API runs in "code on screen" mode,
# which is only allowed while PREVIEW_MODE is on.
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")

SMS_ENABLED = bool(
    TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER
)

# Public origins allowed to call the API directly (the preview proxies the
# frontend through a single origin, so this stays narrow).
_cors_env = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]

STORIES_TTL_HOURS = 24
