from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from lifegoods.package_matches.contracts import (
    ExternalDatasetVersionResponse,
    PackageMatchReferenceImageResponse,
)


class PackageSearchEvidenceResponse(BaseModel):
    value: Any
    source_field: str
    language: str | None
    source_name: str
    source_url: str
    retrieved_at: datetime
    source_revision: str | None = None
    dataset_version_id: str


class PackageSearchResultResponse(BaseModel):
    source_kind: Literal["OPEN_FOOD_FACTS"] = "OPEN_FOOD_FACTS"
    identifier: str
    names: list[PackageSearchEvidenceResponse]
    brands: PackageSearchEvidenceResponse | None
    quantity: PackageSearchEvidenceResponse | None
    manufacturing_place: PackageSearchEvidenceResponse | None
    reference_image: PackageMatchReferenceImageResponse | None


class PackageSearchResponse(BaseModel):
    normalized_query: str
    dataset_version: ExternalDatasetVersionResponse
    results: list[PackageSearchResultResponse]
    next_offset: int | None
