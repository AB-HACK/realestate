import hashlib
import hmac
import io
import os
import time
import uuid
from typing import Dict, Optional, Tuple

from PIL import Image
import numpy as np

from app.config import settings


def compute_sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compute_perceptual_hash(data: bytes) -> str:
    """
    B6: Compute a 64-bit perceptual hash (pHash / dHash) of an image using Pillow + NumPy.
    Resizes grayscale image to 9x8 and encodes horizontal gradient bits into a 16-char hex string.
    Falls back to a deterministic 16-hex digest if raw test bytes are not a raster image.
    """
    try:
        with Image.open(io.BytesIO(data)) as img:
            gray = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
            pixels = np.asarray(gray, dtype=np.float32)
            diff = pixels[:, 1:] > pixels[:, :-1]
            bit_string = "".join("1" if b else "0" for b in diff.flatten())
            return f"{int(bit_string, 2):016x}"
    except Exception:
        return hashlib.sha256(data).hexdigest()[:16]


def phash_hamming_distance(hash1_hex: str, hash2_hex: str) -> int:
    """Compute bit-level Hamming distance between two 16-char hex perceptual hashes."""
    try:
        h1 = int(hash1_hex, 16)
        h2 = int(hash2_hex, 16)
        return bin(h1 ^ h2).count("1")
    except ValueError:
        return 64


def save_to_private_vault(data: bytes, prefix: str, ext: str = ".bin") -> str:
    """
    Part A #6: Store uploaded documents and photos in a private vault outside any static web root.
    Returns the storage key.
    """
    safe_ext = ext if ext.startswith(".") else f".{ext}"
    storage_key = f"{prefix}_{uuid.uuid4().hex}{safe_ext}"
    full_path = os.path.join(settings.PRIVATE_VAULT_DIR, storage_key)
    with open(full_path, "wb") as f:
        f.write(data)
    return storage_key


def read_from_private_vault(storage_key: str) -> bytes:
    safe_key = os.path.basename(storage_key)
    full_path = os.path.join(settings.PRIVATE_VAULT_DIR, safe_key)
    if not os.path.isfile(full_path):
        raise FileNotFoundError(f"Private vault item not found: {safe_key}")
    with open(full_path, "rb") as f:
        return f.read()


def create_signed_access_token(
    resource_type: str,
    resource_id: str,
    actor_id: str,
    ttl_seconds: int = 300,
) -> Dict[str, str | int]:
    """
    Part A #6: Generate a short-lived HMAC-SHA256 signed token to access private documents/photos.
    """
    expires_at = int(time.time()) + ttl_seconds
    payload = f"{resource_type}:{resource_id}:{actor_id}:{expires_at}"
    signature = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        "token": f"{expires_at}.{actor_id}.{signature}",
        "expires_at": expires_at,
    }


def verify_signed_access_token(
    resource_type: str,
    resource_id: str,
    token: str,
) -> Tuple[bool, Optional[str]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False, "Malformed token"
        expires_str, actor_id, signature = parts
        expires_at = int(expires_str)
        if time.time() > expires_at:
            return False, "Signed access token has expired"
        payload = f"{resource_type}:{resource_id}:{actor_id}:{expires_at}"
        expected_sig = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return False, "Invalid token signature"
        return True, actor_id
    except Exception as exc:
        return False, str(exc)
