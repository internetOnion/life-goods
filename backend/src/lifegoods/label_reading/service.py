"""Read This Label application service."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from lifegoods.label_reading.contracts import LabelReading, PhotoRole
from lifegoods.label_reading.gemini import LabelReadingProviderRequest
from lifegoods.label_reading.normalization import build_label_reading
from lifegoods.photo_comparison.gemini import (
    PhotoProviderOutputInvalid,
    PhotoProviderTimeout,
    PhotoProviderUnavailable,
)
from lifegoods.photo_comparison.images import PreparedImage
from lifegoods.photo_comparison.service import MissingCredentialsError, PhotoProviderAdmission


class LabelReadingProvider(Protocol):
    @property
    def provider_name(self) -> str: ...

    @property
    def model(self) -> str: ...

    def read_label(self, request: LabelReadingProviderRequest) -> dict[str, object]: ...


class LabelReadingService:
    """Reads one Product's label under the admission budget shared by all photo operations."""

    def __init__(
        self,
        provider: LabelReadingProvider | None,
        *,
        admission: PhotoProviderAdmission,
    ) -> None:
        self.provider = provider
        self.admission = admission

    def read(
        self,
        images: Sequence[PreparedImage],
        roles: Sequence[PhotoRole],
        *,
        rate_limit_key: str = "unknown",
    ) -> LabelReading:
        if self.provider is None:
            raise MissingCredentialsError(
                "Read This Label is unavailable because Gemini credentials are missing."
            )
        if len(roles) != len(images):
            raise ValueError("each photo requires one capture role")
        tagged = [
            PreparedImage(
                evidence=image.evidence.model_copy(update={"role": role.value}),
                content=image.content,
                mime_type=image.mime_type,
            )
            for image, role in zip(images, roles, strict=True)
        ]
        with self.admission.admit(rate_limit_key):
            try:
                payload = self.provider.read_label(
                    LabelReadingProviderRequest(images=tagged, roles=list(roles))
                )
            except (PhotoProviderTimeout, PhotoProviderUnavailable, PhotoProviderOutputInvalid):
                raise
            except Exception as error:
                raise PhotoProviderUnavailable("The label-reading provider failed.") from error
            return build_label_reading(
                payload,
                images=[image.evidence for image in tagged],
                provider=self.provider.provider_name,
                model=self.provider.model,
            )


__all__ = ["LabelReadingProvider", "LabelReadingService"]
