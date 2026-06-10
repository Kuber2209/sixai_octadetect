"""Session-cookie auth using only the standard library (offline server,
no extra deps): PBKDF2 password hashes + HMAC-signed session tokens."""
import base64
import hashlib
import hmac
import os
import time

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from . import config
from .database import get_db
from .models import User

COOKIE_NAME = "rfid_session"
_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"pbkdf2${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def make_token(user_id: int) -> str:
    expires = int(time.time()) + config.SESSION_TTL_HOURS * 3600
    payload = f"{user_id}.{expires}"
    sig = hmac.new(config.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).digest()
    return f"{payload}.{base64.urlsafe_b64encode(sig).decode()}"


def parse_token(token: str) -> int | None:
    try:
        user_id, expires, sig_b64 = token.split(".")
        payload = f"{user_id}.{expires}"
        expected = hmac.new(config.SECRET_KEY.encode(), payload.encode(),
                            hashlib.sha256).digest()
        if not hmac.compare_digest(base64.urlsafe_b64decode(sig_b64), expected):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except (ValueError, TypeError):
        return None


def current_user(
    rfid_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    user_id = parse_token(rfid_session) if rfid_session else None
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def manager_required(user: User = Depends(current_user)) -> User:
    if user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager role required")
    return user
