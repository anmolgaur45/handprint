from typing import Annotated

import firebase_admin  # type: ignore[import-untyped]
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials

from app.core.config import get_settings

security = HTTPBearer()


def initialize_firebase() -> None:
    """Initialize the Firebase Admin SDK."""
    if not firebase_admin._apps:
        settings = get_settings()
        if settings.firebase_credentials_path:
            cred = credentials.Certificate(settings.firebase_credentials_path)
            firebase_admin.initialize_app(cred)
        else:
            # Fallback to Application Default Credentials (ADC)
            firebase_admin.initialize_app()


def get_current_user_id(
    cred_opt: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> str:
    """Verify the Firebase ID Token (Bearer Token) and return the authenticated user's UID.

    Raises:
        HTTPException: 401 Unauthorized if verification fails.
    """
    token = cred_opt.credentials
    try:
        # Verify Firebase ID token
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token.get("uid")
        if not uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed: missing uid in token",
            )
        return str(uid)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication credentials: {e}",
        ) from e
