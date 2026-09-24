"""Bounded, metadata-free image preparation for the local comparison prototype."""

from __future__ import annotations

import io
import logging
import math
import secrets
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif.as_plugin import register_heif_opener

from lifegoods.photo_comparison.contracts import ImageEvidence

# iPhone camera-roll photos are HEIC/HEIF; teach Pillow to decode them so they can be
# transcoded to JPEG before anything leaves this process.
register_heif_opener()

logger = logging.getLogger(__name__)

MAX_PHOTO_BYTES = 10 * 1024 * 1024
MAX_UPLOAD_BYTES = 32 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
# Pillow format name -> MIME type of the *prepared* output. HEIF input is re-encoded as JPEG.
SUPPORTED_IMAGE_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "HEIF": "image/jpeg"}
ACCEPTED_DECLARED_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/jpg",
        "image/pjpeg",
        "image/png",
        "image/heic",
        "image/heif",
        "image/heic-sequence",
        "image/heif-sequence",
    }
)
# Pickers/browsers that cannot identify a file declare one of these; rely on content sniffing.
UNKNOWN_DECLARED_CONTENT_TYPES = frozenset({"", "application/octet-stream"})
UNSUPPORTED_FORMAT_MESSAGE = (
    "Only JPEG, PNG and HEIC photos are supported; other formats are not supported."
)


class ImageValidationError(ValueError):
    """Raised when an upload is not a supported, bounded image."""

    def __init__(
        self,
        message: str,
        *,
        unsupported_format: bool = False,
        size_limit: bool = False,
    ) -> None:
        super().__init__(message)
        self.unsupported_format = unsupported_format
        self.size_limit = size_limit


@dataclass(frozen=True)
class PreparedImage:
    evidence: ImageEvidence
    content: bytes
    mime_type: str


def _opaque_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_urlsafe(18).replace('=', '')}"


def _fit_within_pixel_bound(image: Image.Image) -> Image.Image:
    """Downscale oversized photos (e.g. 48 MP phone captures) instead of rejecting them."""
    width, height = image.size
    if width <= 0 or height <= 0:
        raise ImageValidationError("The submitted photo has no visible pixels.")
    if width * height <= MAX_IMAGE_PIXELS:
        return image
    scale = math.sqrt(MAX_IMAGE_PIXELS / (width * height))
    target = (max(1, int(width * scale)), max(1, int(height * scale)))
    image.thumbnail(target, Image.Resampling.LANCZOS)
    return image


def _container_brand(data: bytes) -> str:
    """ISO-BMFF major brand (e.g. ``heic``, ``mif1``) when present; format metadata only."""
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return data[8:12].decode("ascii", errors="replace")
    return data[:4].hex()


def _log_rejection(data: bytes, declared: str, detected: str, reason: str) -> None:
    # Format metadata only: never image content, Barcodes, or Shopper identifiers.
    logger.warning(
        "photo rejected: reason=%s declared=%r detected=%r brand=%r bytes=%d",
        reason,
        declared,
        detected,
        _container_brand(data),
        len(data),
    )


def prepare_image(data: bytes, *, declared_content_type: str | None = None) -> PreparedImage:
    if len(data) > MAX_PHOTO_BYTES:
        raise ImageValidationError("Each photo must be 10 MiB or smaller.", size_limit=True)
    if not data:
        raise ImageValidationError("The submitted photo is empty.")

    declared = (declared_content_type or "").split(";", 1)[0].strip().lower()
    if declared not in UNKNOWN_DECLARED_CONTENT_TYPES and declared not in (
        ACCEPTED_DECLARED_CONTENT_TYPES
    ):
        _log_rejection(data, declared, "", "declared_type")
        raise ImageValidationError(UNSUPPORTED_FORMAT_MESSAGE, unsupported_format=True)

    try:
        with Image.open(io.BytesIO(data)) as opened:
            image_format = (opened.format or "").upper()
            mime_type = SUPPORTED_IMAGE_FORMATS.get(image_format)
            if mime_type is None:
                _log_rejection(data, declared, image_format, "detected_format")
                raise ImageValidationError(UNSUPPORTED_FORMAT_MESSAGE, unsupported_format=True)
            width, height = opened.size
            if width <= 0 or height <= 0:
                raise ImageValidationError("The submitted photo has no visible pixels.")
            opened.verify()

        with Image.open(io.BytesIO(data)) as reopened:
            corrected = ImageOps.exif_transpose(reopened)
            if corrected is None:
                corrected = reopened.copy()
            corrected = _fit_within_pixel_bound(corrected)
            width, height = corrected.size
            output = io.BytesIO()
            if image_format == "PNG":
                prepared = (
                    corrected.convert("RGBA")
                    if "A" in corrected.getbands()
                    else corrected.convert("RGB")
                )
                prepared.save(output, format="PNG", optimize=True)
            else:
                prepared = corrected.convert("RGB")
                prepared.save(output, format="JPEG", quality=92, optimize=True)
            processed_bytes = output.getvalue()
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as error:
        _log_rejection(data, declared, "", f"decode_failed:{type(error).__name__}")
        raise ImageValidationError(
            "The submitted file is not a readable JPEG, PNG or HEIC photo.",
            unsupported_format=True,
        ) from error

    image_id = _opaque_id("img")
    evidence = ImageEvidence(
        image_id=image_id,
        original_image_id=_opaque_id("original"),
        processed_image_id=_opaque_id("processed"),
        role="submitted_photo",
        width=width,
        height=height,
    )
    return PreparedImage(evidence=evidence, content=processed_bytes, mime_type=mime_type)
