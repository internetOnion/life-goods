"""Bounded, metadata-free image preparation for the local comparison prototype."""

from __future__ import annotations

import io
import secrets
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from lifegoods.photo_comparison.contracts import ImageEvidence

MAX_PHOTO_BYTES = 10 * 1024 * 1024
MAX_UPLOAD_BYTES = 32 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
SUPPORTED_IMAGE_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png"}


class ImageValidationError(ValueError):
    """Raised when an upload is not a supported, bounded image."""

    def __init__(self, message: str, *, unsupported_format: bool = False) -> None:
        super().__init__(message)
        self.unsupported_format = unsupported_format


@dataclass(frozen=True)
class PreparedImage:
    evidence: ImageEvidence
    content: bytes
    mime_type: str


def _opaque_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_urlsafe(18).replace('=', '')}"


def prepare_image(data: bytes, *, declared_content_type: str | None = None) -> PreparedImage:
    if len(data) > MAX_PHOTO_BYTES:
        raise ImageValidationError("Each photo must be 10 MiB or smaller.")
    if not data:
        raise ImageValidationError("The submitted photo is empty.")

    try:
        with Image.open(io.BytesIO(data)) as opened:
            image_format = (opened.format or "").upper()
            mime_type = SUPPORTED_IMAGE_FORMATS.get(image_format)
            if mime_type is None:
                raise ImageValidationError(
                    "Only JPEG and PNG photos are supported; HEIC and other formats are not "
                    "supported.",
                    unsupported_format=True,
                )
            if (
                declared_content_type
                and declared_content_type not in SUPPORTED_IMAGE_FORMATS.values()
            ):
                raise ImageValidationError(
                    "Only JPEG and PNG photos are supported; HEIC and other formats are not "
                    "supported.",
                    unsupported_format=True,
                )
            width, height = opened.size
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                raise ImageValidationError("Each photo must be 25 megapixels or smaller.")
            opened.verify()

        with Image.open(io.BytesIO(data)) as reopened:
            corrected = ImageOps.exif_transpose(reopened)
            width, height = corrected.size
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                raise ImageValidationError("Each photo must be 25 megapixels or smaller.")
            if image_format == "JPEG":
                prepared = corrected.convert("RGB")
                output = io.BytesIO()
                prepared.save(output, format="JPEG", quality=92, optimize=True)
            else:
                prepared = (
                    corrected.convert("RGBA")
                    if "A" in corrected.getbands()
                    else corrected.convert("RGB")
                )
                output = io.BytesIO()
                prepared.save(output, format="PNG", optimize=True)
            processed_bytes = output.getvalue()
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise ImageValidationError(
            "The submitted file is not a readable JPEG or PNG photo.",
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
