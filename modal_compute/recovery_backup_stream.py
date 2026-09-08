"""Shared LBBA1 streaming AES-256-GCM envelope for the recovery pipeline.

Scope boundary (restore source child of #3460 / #3894; backup lineage #3828 / #4137):
this module is the single source of truth for the LBBA1 encrypted-artifact envelope
format used by both the Modal scheduled backup app and the operator-only restore app.
It is source-only and import-hermetic: importing this module performs no network,
secret, database, subprocess, filesystem, or deployment side effect, and it never
imports Modal, requests, psycopg, or any provider library. The cryptography import is
lazy (inside the encrypt/decrypt functions) so pure policy/contract scenarios can
import this module without the optional dependency present.

Envelope framing (unchanged from the backup pipeline):
    LBBA1 = 5-byte version + 12-byte random nonce + streamed ciphertext + one final
    16-byte AES-GCM authentication tag. The single final tag makes chunk boundaries
    irrelevant to decryptability; any framing or authentication failure raises
    ValueError and never yields plaintext.

No exact key, nonce, tag, size, path, or identifier value is ever logged or returned.
"""

from __future__ import annotations

import os

# Fixed envelope framing (identical to the backup pipeline constants).
STREAM_AEAD_VERSION = b"LBBA1"
STREAM_AEAD_NONCE_BYTES = 12
STREAM_AEAD_TAG_BYTES = 16
STREAM_AEAD_HEADER_BYTES = len(STREAM_AEAD_VERSION) + STREAM_AEAD_NONCE_BYTES
STREAM_CHUNK_BYTES = 1024 * 1024


def streaming_encrypt(plain_path: str, enc_path: str, key: bytes, nonce: bytes) -> None:
    """Stream one parseable AEAD envelope: version + nonce + ciphertext + one tag.

    The whole plaintext is never loaded into memory; chunk boundaries do not affect
    decryptability because the envelope carries a single final authentication tag.
    Raises ValueError on empty plaintext or empty output.
    """
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    wrote_any = False
    with open(plain_path, "rb") as src, open(enc_path, "wb") as dst:
        dst.write(STREAM_AEAD_VERSION)
        dst.write(nonce)
        while True:
            chunk = src.read(STREAM_CHUNK_BYTES)
            if not chunk:
                break
            wrote_any = True
            dst.write(encryptor.update(chunk))
        if not wrote_any:
            raise ValueError("empty plaintext rejected")
        dst.write(encryptor.finalize())
        dst.write(encryptor.tag)  # single 16-byte authentication tag
    if _is_non_empty(enc_path) is False:
        raise ValueError("encrypted output empty")


def streaming_decrypt(enc_path: str, out_path: str, key: bytes) -> None:
    """Decrypt a single AEAD envelope; raises on framing or authentication errors.

    The plaintext is produced only at `out_path`, never returned in memory. The
    authentication tag is verified by AES-GCM before any plaintext is considered
    usable; a failed tag finalization raises and leaves no valid plaintext artifact.
    """
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    with open(enc_path, "rb") as src:
        header = src.read(STREAM_AEAD_HEADER_BYTES)
        if len(header) != STREAM_AEAD_HEADER_BYTES or header[: len(STREAM_AEAD_VERSION)] != STREAM_AEAD_VERSION:
            raise ValueError("invalid envelope header")
        nonce = header[len(STREAM_AEAD_VERSION):]
        payload = src.read()
        if len(payload) <= STREAM_AEAD_TAG_BYTES:
            raise ValueError("invalid envelope payload")
        ciphertext = payload[:-STREAM_AEAD_TAG_BYTES]
        tag = payload[-STREAM_AEAD_TAG_BYTES:]
    decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
    with open(out_path, "wb") as dst:
        if ciphertext:
            dst.write(decryptor.update(ciphertext))
        decryptor.finalize()  # raises InvalidTag on authentication failure


def _is_non_empty(path: str) -> bool:
    try:
        return os.path.getsize(path) > 0
    except OSError:
        return False