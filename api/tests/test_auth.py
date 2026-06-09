from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from app.middleware.auth import get_current_user_id, initialize_firebase


def test_initialize_firebase_with_credentials_path() -> None:
    """Test initialize_firebase when a credentials path is provided."""
    with (
        patch("app.middleware.auth.firebase_admin._apps", new=[]),
        patch("app.middleware.auth.firebase_admin.initialize_app") as mock_init,
        patch("app.middleware.auth.credentials.Certificate") as mock_cert,
        patch(
            "app.middleware.auth.get_settings",
            return_value=MagicMock(firebase_credentials_path="path/to/key.json"),
        ),
    ):
        initialize_firebase()
        mock_cert.assert_called_once_with("path/to/key.json")
        mock_init.assert_called_once()


def test_initialize_firebase_default() -> None:
    """Test initialize_firebase with Application Default Credentials."""
    with (
        patch("app.middleware.auth.firebase_admin._apps", new=[]),
        patch("app.middleware.auth.firebase_admin.initialize_app") as mock_init,
        patch(
            "app.middleware.auth.get_settings",
            return_value=MagicMock(firebase_credentials_path=""),
        ),
    ):
        initialize_firebase()
        mock_init.assert_called_once()


def test_get_current_user_id_success() -> None:
    """Test get_current_user_id successfully returns user UID."""
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid_token")

    with patch("app.middleware.auth.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {"uid": "user_123"}
        uid = get_current_user_id(credentials)
        assert uid == "user_123"
        mock_verify.assert_called_once_with("valid_token")


def test_get_current_user_id_missing_uid() -> None:
    """Test get_current_user_id raises 401 when token lacks a UID."""
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token_without_uid")

    with patch("app.middleware.auth.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {}  # No UID
        with pytest.raises(HTTPException) as exc_info:
            get_current_user_id(credentials)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "missing uid in token" in exc_info.value.detail


def test_get_current_user_id_invalid_token() -> None:
    """Test get_current_user_id raises 401 on token verification failure."""
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid_token")

    with patch("app.middleware.auth.auth.verify_id_token") as mock_verify:
        mock_verify.side_effect = ValueError("Token signature verification failed")
        with pytest.raises(HTTPException) as exc_info:
            get_current_user_id(credentials)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid or expired authentication credentials" in exc_info.value.detail


def test_get_current_user_id_anonymous_token() -> None:
    """Test get_current_user_id accepts Firebase anonymous auth tokens.

    Anonymous tokens are standard Firebase ID tokens with a uid and
    provider_id 'anonymous'. The middleware should accept them identically.
    """
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials="anon_token"
    )

    with patch("app.middleware.auth.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {
            "uid": "anon_user_abc123",
            "provider_id": "anonymous",
            "firebase": {"sign_in_provider": "anonymous"},
        }
        uid = get_current_user_id(credentials)
        assert uid == "anon_user_abc123"
        mock_verify.assert_called_once_with("anon_token")

