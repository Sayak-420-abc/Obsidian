"""
backend/auth.py

JWT verification for Clerk Authentication.
"""

import os
import logging
from typing import Any

import jwt                              # pip install PyJWT
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Environment & JWKS Setup
# ---------------------------------------------------------------------------

CLERK_JWKS_URL: str = os.environ.get("CLERK_JWKS_URL", "")

# PyJWKClient caches the keys locally, and lifespan=3600 refreshes them
# every hour to handle Clerk key rotations seamlessly.
# If URL is empty, we will create jwks_client lazily or handle it gracefully.
jwks_client = None
if CLERK_JWKS_URL:
    jwks_client = jwt.PyJWKClient(
        CLERK_JWKS_URL,
        cache_keys=True,
        lifespan=3600,
    )

# ---------------------------------------------------------------------------
# Bearer extractor
# ---------------------------------------------------------------------------

_bearer = HTTPBearer(auto_error=True)

# ---------------------------------------------------------------------------
# Local JWT verification
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict[str, Any]:
    """
    Decode and verify the Clerk JWT locally using JWKS public keys.
    """
    global jwks_client
    token = credentials.credentials
    
    # Lazy load or handle missing environment variable dynamically
    if not jwks_client:
        url = os.environ.get("CLERK_JWKS_URL", "")
        if not url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="CLERK_JWKS_URL is not configured on the backend.",
            )
        jwks_client = jwt.PyJWKClient(
            url,
            cache_keys=True,
            lifespan=3600,
        )

    try:
        # Fetch the signing key from Clerk's JWKS endpoint based on JWT header key ID
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Decode and verify token signature using RS256 algorithm
        payload: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True, "verify_aud": False},
        )
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )
    except jwt.InvalidTokenError as exc:
        logger.warning("Clerk JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )


def get_user_id(user: dict[str, Any]) -> str:
    """
    Extract the string user_id from the decoded Clerk JWT payload.
    The 'sub' claim is always present and equals the Clerk user ID (e.g. user_...).
    """
    try:
        return str(user["sub"])
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not extract user ID from token.",
        ) from exc
