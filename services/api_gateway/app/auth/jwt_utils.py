import logging
import os
import time
from typing import Any, Dict, Optional

import jwt
import redis
from app.config import settings
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

logger = logging.getLogger(__name__)

ACCESS_TOKEN_EXPIRE_SEC = settings.access_token_expire_mins * 60
REFRESH_TOKEN_EXPIRE_SEC = settings.refresh_token_expire_mins * 60

_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.redis_url, decode_responses=True
        )
    return _redis_client


def create_access_token(user_id: str, email: str, roles: list[str]) -> str:
    now = time.time()
    payload = {
        "sub": user_id,
        "email": email,
        "roles": roles,
        "iat": now,
        "exp": now + ACCESS_TOKEN_EXPIRE_SEC,
        "type": "access",
        "jti": os.urandom(16).hex(),
    }
    return jwt.encode(
        payload, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )


def create_refresh_token(user_id: str) -> str:
    now = time.time()
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + REFRESH_TOKEN_EXPIRE_SEC,
        "type": "refresh",
        "jti": os.urandom(16).hex(),
    }
    return jwt.encode(
        payload, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )


def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        return {"valid": True, "payload": payload, "error": None}
    except ExpiredSignatureError:
        return {"valid": False, "payload": None, "error": "Token expired"}
    except InvalidTokenError as e:
        return {
            "valid": False,
            "payload": None,
            "error": f"Invalid token: {str(e)}",
        }


def is_token_blacklisted(jti: str) -> bool:
    if not jti:
        return False
    try:
        redis_client = get_redis_client()
        return redis_client.exists(f"blacklist:{jti}") == 1
    except Exception:
        return False


def blacklist_token(jti: str, exp: float):
    try:
        redis_client = get_redis_client()
        ttl = max(1, int(exp - time.time()))
        redis_client.setex(f"blacklist:{jti}", ttl, "1")
    except Exception as e:
        logger.error("Failed to blacklist token: %s", e)


def get_user_info_from_token(token: str) -> Optional[Dict[str, Any]]:
    result = decode_token(token)
    if not result["valid"]:
        return None

    payload = result["payload"]

    jti = payload.get("jti")
    if is_token_blacklisted(jti):
        return None

    return payload
