from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

FieldType = Literal["product_name", "generic_name", "ingredients_text", "categories"]
TranslationFieldStatus = Literal[
    "generated",
    "source_khmer_available",
    "source_data_unavailable",
]


class BenchmarkField(BaseModel):
    field_name: FieldType
    original_text: str | None = None
    source_language: str | None = None
    expected_status: TranslationFieldStatus = "generated"
    protected_tokens: list[str] = Field(default_factory=list)
    notes: str | None = None


class BenchmarkItem(BaseModel):
    item_id: str
    title: str
    language: str | None = None
    tags: list[str] = Field(default_factory=list)
    fields: list[BenchmarkField] = Field(default_factory=list)
    brands: list[str] = Field(default_factory=list)


class BenchmarkDataset(BaseModel):
    version: str
    description: str
    items: list[BenchmarkItem] = Field(default_factory=list)


def get_dataset_path(version: str = "v1") -> Path:
    base_dir = Path(__file__).parent / "datasets"
    file_path = base_dir / f"{version}.json"
    if not file_path.is_file():
        raise FileNotFoundError(f"Benchmark dataset version '{version}' not found at {file_path}")
    return file_path


def load_benchmark_dataset(version: str = "v1") -> BenchmarkDataset:
    file_path = get_dataset_path(version)
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)
    return BenchmarkDataset.model_validate(data)
