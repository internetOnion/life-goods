"""Khmer Rendering of Printed Text from a Label Reading (ADR 0005, SPEC section 29.4).

Khmer Rendering is not Khmer Translation. It reuses the stateless Gemini translation
adapter and the token protection/validation helpers, but it writes no generated-data
artifacts, uses no translation cache or quota, and keeps nothing after the response.
"""

from __future__ import annotations

import httpx2 as httpx

from lifegoods.label_reading.contracts import (
    KHMER_RENDERING_CONFIGURATION_VERSION,
    KhmerRenderedBlock,
    KhmerRenderingBlockInput,
    KhmerRenderingRequest,
    KhmerRenderingResponse,
    KhmerRenderingState,
)
from lifegoods.photo_comparison.gemini import (
    PHOTO_MODEL,
    PhotoProviderTimeout,
    PhotoProviderUnavailable,
)
from lifegoods.photo_comparison.service import MissingCredentialsError, PhotoProviderAdmission
from lifegoods.translation.deadline import TranslationDeadline
from lifegoods.translation.gemini import GeminiTranslationAdapter
from lifegoods.translation.protection import ProtectionResult, protect_tokens, restore_tokens
from lifegoods.translation.provider import ProviderTranslationRequest, TranslationProvider
from lifegoods.translation.selection import is_predominantly_khmer_script
from lifegoods.translation.validator import validate_field_translation

KHMER_RENDERING_DEADLINE_SECONDS = 20.0


class KhmerRenderingService:
    """Renders Printed Text into Khmer under the admission budget shared by all photo work."""

    def __init__(
        self,
        provider: TranslationProvider | None,
        *,
        admission: PhotoProviderAdmission,
        deadline_seconds: float = KHMER_RENDERING_DEADLINE_SECONDS,
    ) -> None:
        self.provider = provider
        self.admission = admission
        self.deadline_seconds = deadline_seconds

    def render(
        self, request: KhmerRenderingRequest, *, rate_limit_key: str = "unknown"
    ) -> KhmerRenderingResponse:
        states: dict[str, KhmerRenderedBlock] = {}
        pending: list[KhmerRenderingBlockInput] = []
        for block in request.blocks:
            if is_predominantly_khmer_script(block.text):
                states[block.block_id] = KhmerRenderedBlock(
                    block_id=block.block_id, state=KhmerRenderingState.NOT_NEEDED
                )
            else:
                pending.append(block)

        if pending:
            if self.provider is None:
                raise MissingCredentialsError(
                    "Khmer Rendering is unavailable because Gemini credentials are missing."
                )
            with self.admission.admit(rate_limit_key):
                states.update(self._render_pending(pending, self.provider))

        return KhmerRenderingResponse(
            blocks=[states[block.block_id] for block in request.blocks],
            provider=self.provider.provider_name if self.provider else None,
            model=self.provider.model if self.provider else None,
            configuration_version=KHMER_RENDERING_CONFIGURATION_VERSION,
        )

    def _render_pending(
        self, blocks: list[KhmerRenderingBlockInput], provider: TranslationProvider
    ) -> dict[str, KhmerRenderedBlock]:
        protected: dict[str, ProtectionResult] = {
            block.block_id: protect_tokens(block.text) for block in blocks
        }
        response = provider.translate(
            ProviderTranslationRequest(
                fields={block_id: result.masked_text for block_id, result in protected.items()},
                deadline=TranslationDeadline(self.deadline_seconds),
            )
        )
        if response.status != "success":
            if response.timed_out:
                raise PhotoProviderTimeout("The Khmer Rendering provider timed out.")
            raise PhotoProviderUnavailable("The Khmer Rendering provider failed.")

        rendered: dict[str, KhmerRenderedBlock] = {}
        for block in blocks:
            result = protected[block.block_id]
            raw = response.translations.get(block.block_id)
            state = KhmerRenderingState.UNAVAILABLE
            khmer_text: str | None = None
            if isinstance(raw, str):
                restored = restore_tokens(raw, result.token_map)
                if not validate_field_translation(
                    block.text, raw, restored, result.token_map, target_language="km"
                ):
                    state = KhmerRenderingState.RENDERED
                    khmer_text = restored.strip()
            rendered[block.block_id] = KhmerRenderedBlock(
                block_id=block.block_id, state=state, khmer_text=khmer_text
            )
        return rendered


def create_khmer_rendering_provider(
    api_key: str | None,
    *,
    http_client: httpx.Client | None = None,
) -> GeminiTranslationAdapter | None:
    if not api_key:
        return None
    # One provider attempt: a paid call is never retried invisibly (SPEC section 28).
    return GeminiTranslationAdapter(
        api_key,
        model=PHOTO_MODEL,
        timeout_seconds=KHMER_RENDERING_DEADLINE_SECONDS,
        http_client=http_client,
        max_attempts=1,
    )


__all__ = [
    "KHMER_RENDERING_DEADLINE_SECONDS",
    "KhmerRenderingService",
    "create_khmer_rendering_provider",
]
