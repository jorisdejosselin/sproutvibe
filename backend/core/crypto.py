import base64
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def _get_fernet() -> Fernet:
    key_b64 = os.getenv("SETTINGS_ENCRYPTION_KEY")
    if key_b64:
        raw = base64.urlsafe_b64decode(key_b64)
    else:
        # Derive a 32-byte key from JWT_SECRET so existing deployments need no new env var.
        jwt_secret = os.getenv("JWT_SECRET", "dev-insecure-secret")
        raw = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"sproutvibe-settings-v1",
        ).derive(jwt_secret.encode())
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string and return a Fernet token."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_value(token: str) -> str:
    """Decrypt a Fernet token. Returns the input as-is if decryption fails,
    which covers plaintext values written before encryption was introduced."""
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except (InvalidToken, Exception):
        return token
