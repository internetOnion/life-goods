from __future__ import annotations

import logging
import time
from collections.abc import Callable
from contextlib import suppress
from datetime import UTC, datetime
from threading import Lock
from time import monotonic as system_monotonic
from typing import Any
from uuid import uuid4

from pymongo.errors import PyMongoError

from lifegoods.generated_data.budget import TranslationBudgetLimiterProtocol
from lifegoods.generated_data.cache import TranslationHotCacheProtocol
from lifegoods.generated_data.repository import (
    GeneratedDataRepositoryProtocol,
    StoredTranslationArtifact,
)
from lifegoods.product_lookup.contracts import ProductProjection
from lifegoods.translation.contracts import (
    FieldTranslationOutcome,
    ProductTranslationResult,
    TranslationFieldStatus,
    TranslationOverallStatus,
    TranslationProvenance,
)
from lifegoods.translation.module import (
    KhmerTranslationModule,
    is_original_text_preserved,
)
from lifegoods.translation.selection import FieldSelection, extract_eligible_fields

logger = logging.getLogger(__name__)


def _selection_fallback_status(selection: FieldSelection) -> TranslationFieldStatus:
    if selection.selected_text is None:
        return TranslationFieldStatus.SOURCE_DATA_UNAVAILABLE
    if selection.is_source_khmer:
        return TranslationFieldStatus.SOURCE_KHMER_AVAILABLE
    return TranslationFieldStatus.TRANSLATION_UNAVAILABLE


def result_to_stored_artifact(result: ProductTranslationResult) -> StoredTranslationArtifact:
    fields_dict: dict[str, dict[str, Any]] = {
        fname: {
            "field_name": outcome.field_name,
            "status": outcome.status.value,
            "khmer_translation": outcome.khmer_translation,
            "failure_reason": outcome.failure_reason,
        }
        for fname, outcome in result.fields.items()
    }
    now = datetime.now(UTC)
    return StoredTranslationArtifact(
        artifact_id=f"{result.content_hash}:{result.config_fingerprint}",
        content_hash=result.content_hash,
        translation_config_fingerprint=result.config_fingerprint,
        overall_status=result.overall_status.value,
        fields=fields_dict,
        raw_input=result.raw_input,
        masked_input=result.masked_input,
        token_maps=result.token_maps,
        provenance=result.provenance.model_dump() if result.provenance else {},
        created_at=now,
    )


def reconstruct_result_from_artifact(
    artifact: StoredTranslationArtifact,
    product: ProductProjection,
) -> ProductTranslationResult:
    selections = extract_eligible_fields(product)
    fields: dict[str, FieldTranslationOutcome] = {}

    for fname, sel in selections.items():
        stored_f = artifact.fields.get(fname)
        if stored_f is not None:
            fields[fname] = FieldTranslationOutcome(
                field_name=fname,
                status=TranslationFieldStatus(stored_f["status"]),
                selected_original_text=sel.selected_text,
                original_texts=sel.all_texts,
                khmer_translation=stored_f.get("khmer_translation"),
                failure_reason=stored_f.get("failure_reason"),
            )
        else:
            fields[fname] = FieldTranslationOutcome(
                field_name=fname,
                status=_selection_fallback_status(sel),
                selected_original_text=sel.selected_text,
                original_texts=sel.all_texts,
                khmer_translation=None,
            )

    provenance = (
        TranslationProvenance(**artifact.provenance)
        if artifact.provenance
        else None
    )

    return ProductTranslationResult(
        overall_status=TranslationOverallStatus(artifact.overall_status),
        fields=fields,
        content_hash=artifact.content_hash,
        config_fingerprint=artifact.translation_config_fingerprint,
        provenance=provenance,
        raw_input=artifact.raw_input,
        masked_input=artifact.masked_input,
        token_maps=artifact.token_maps,
    )


def _make_unavailable_result(
    product: ProductProjection,
    content_hash: str,
    config_fingerprint: str,
    reason: str,
) -> ProductTranslationResult:
    selections = extract_eligible_fields(product)
    brands = [b.strip() for b in product.identity.brands if b and b.strip()]
    fields: dict[str, FieldTranslationOutcome] = {}
    for fname, sel in selections.items():
        status = _selection_fallback_status(sel)
        if (
            sel.selected_text is not None
            and is_original_text_preserved(fname, sel.selected_text.value, brands)
        ):
            status = TranslationFieldStatus.ORIGINAL_TEXT_PRESERVED
        fields[fname] = FieldTranslationOutcome(
            field_name=fname,
            status=status,
            selected_original_text=sel.selected_text,
            original_texts=sel.all_texts,
            khmer_translation=None,
            failure_reason=(
                reason if status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE else None
            ),
        )

    return ProductTranslationResult(
        overall_status=TranslationOverallStatus.UNAVAILABLE,
        fields=fields,
        content_hash=content_hash,
        config_fingerprint=config_fingerprint,
        provenance=None,
    )


class TranslationCoordinator:
    def __init__(
        self,
        module: KhmerTranslationModule,
        repository: GeneratedDataRepositoryProtocol,
        cache: TranslationHotCacheProtocol,
        budget: TranslationBudgetLimiterProtocol,
        *,
        lease_ttl_seconds: float = 5.0,
        cooldown_seconds: float = 60.0,
        poll_interval_seconds: float = 0.05,
        fallback_seconds: float = 5.0,
        monotonic: Callable[[], float] = system_monotonic,
        sleep_func: Callable[[float], None] = time.sleep,
    ) -> None:
        self._module = module
        self._repository = repository
        self._cache = cache
        self._budget = budget
        self._lease_ttl_seconds = lease_ttl_seconds
        self._cooldown_seconds = cooldown_seconds
        self._poll_interval_seconds = poll_interval_seconds
        self._fallback_seconds = fallback_seconds
        self._monotonic = monotonic
        self._sleep_func = sleep_func

        self._state_lock = Lock()
        self._store_degraded = False
        self._store_degraded_until = 0.0

    def _is_store_degraded(self) -> bool:
        with self._state_lock:
            if not self._store_degraded:
                return False
            if self._monotonic() >= self._store_degraded_until:
                self._store_degraded = False
                return False
            return True

    def _record_store_degradation(self, error: Exception) -> None:
        with self._state_lock:
            self._store_degraded = True
            self._store_degraded_until = self._monotonic() + self._fallback_seconds
        logger.warning(
            "Generated data store degraded; holding new provider calls",
            extra={
                "event": "translation_store_degraded",
                "dependency": "mongodb",
                "failure_category": "store_unavailable",
                "error_category": type(error).__name__,
            },
        )

    def get_or_generate_translation(
        self,
        product: ProductProjection,
        *,
        target_language: str = "kh",
        deadline_seconds: float = 4.0,
    ) -> ProductTranslationResult:
        content_hash, config_fp, needs_gen = self._module.compute_translation_identity(
            product, target_language=target_language
        )

        if not needs_gen:
            return self._module.translate_product(product, target_language=target_language)

        # 1. Hot cache fast path (Redis)
        cached = self._cache.get(content_hash, config_fp)
        if cached is not None:
            return reconstruct_result_from_artifact(cached, product)

        # 2. Check quarantine in durable store
        try:
            if self._repository.is_quarantined(content_hash, config_fp):
                return _make_unavailable_result(
                    product, content_hash, config_fp, "Artifact is quarantined"
                )
        except PyMongoError as error:
            self._record_store_degradation(error)
            return _make_unavailable_result(
                product, content_hash, config_fp, "Generated store unavailable"
            )

        # 3. Check durable store (MongoDB)
        if not self._is_store_degraded():
            try:
                stored = self._repository.get_artifact(content_hash, config_fp)
                if stored is not None:
                    self._cache.put(stored)
                    return reconstruct_result_from_artifact(stored, product)
                if self._repository.is_cooling_down(content_hash, config_fp):
                    return _make_unavailable_result(
                        product, content_hash, config_fp, "Generation cooled down"
                    )
            except PyMongoError as error:
                self._record_store_degradation(error)

        if self._is_store_degraded():
            return _make_unavailable_result(
                product, content_hash, config_fp, "Generated store unavailable"
            )

        # 4. Single flight via MongoDB lease
        owner_token = uuid4().hex
        try:
            acquired = self._repository.acquire_lease(
                content_hash, config_fp, owner_token, ttl_seconds=self._lease_ttl_seconds
            )
        except PyMongoError as error:
            self._record_store_degradation(error)
            return _make_unavailable_result(
                product, content_hash, config_fp, "Could not acquire generation lease"
            )

        if acquired:
            # Won the lease: check project-wide generation budget (fail-closed)
            budget_ok, _ = self._budget.try_acquire()
            if not budget_ok:
                with suppress(Exception):
                    self._repository.release_lease(content_hash, config_fp, owner_token)
                return _make_unavailable_result(
                    product, content_hash, config_fp, "Generation budget exhausted"
                )

            try:
                result = self._module.translate_product(
                    product, target_language=target_language
                )
                logger.info(
                    "Translation generation completed",
                    extra={
                        "event": "translation_generation_completed",
                        "status": result.overall_status.value,
                        "generated_fields": sorted(
                            field_name
                            for field_name, field in result.fields.items()
                            if field.status == TranslationFieldStatus.GENERATED
                        ),
                        "unavailable_fields": sorted(
                            field_name
                            for field_name, field in result.fields.items()
                            if field.status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE
                        ),
                    },
                )
                if result.overall_status == TranslationOverallStatus.COMPLETE:
                    stored_art = result_to_stored_artifact(result)
                    try:
                        self._repository.save_artifact(stored_art)
                        self._cache.put(stored_art)
                    except PyMongoError as error:
                        self._record_store_degradation(error)
                        # Result still returned to current request!
                elif result.overall_status == TranslationOverallStatus.PARTIAL:
                    # Keep useful fields available briefly, but do not make an
                    # incomplete translation durable. A later lookup retries it.
                    self._cache.put(
                        result_to_stored_artifact(result),
                        ttl_seconds=max(1, int(self._cooldown_seconds)),
                    )
                elif result.overall_status == TranslationOverallStatus.UNAVAILABLE:
                    try:
                        reason = "Generation unavailable"
                        for f in result.fields.values():
                            if f.failure_reason:
                                reason = f.failure_reason
                                break
                        self._repository.record_cooldown(
                            content_hash,
                            config_fp,
                            reason,
                            ttl_seconds=self._cooldown_seconds,
                        )
                    except PyMongoError as error:
                        self._record_store_degradation(error)

                return result
            finally:
                with suppress(Exception):
                    self._repository.release_lease(content_hash, config_fp, owner_token)
        else:
            # Competing request polling
            start_time = self._monotonic()
            while (self._monotonic() - start_time) < deadline_seconds:
                self._sleep_func(self._poll_interval_seconds)

                # Check cache
                cached = self._cache.get(content_hash, config_fp)
                if cached is not None:
                    return reconstruct_result_from_artifact(cached, product)

                # Check store
                if not self._is_store_degraded():
                    try:
                        stored = self._repository.get_artifact(content_hash, config_fp)
                        if stored is not None:
                            self._cache.put(stored)
                            return reconstruct_result_from_artifact(stored, product)
                        if self._repository.is_cooling_down(content_hash, config_fp):
                            return _make_unavailable_result(
                                product,
                                content_hash,
                                config_fp,
                                "Generation cooled down",
                            )
                    except PyMongoError as error:
                        self._record_store_degradation(error)

            return _make_unavailable_result(
                product, content_hash, config_fp, "Translation timeout"
            )
