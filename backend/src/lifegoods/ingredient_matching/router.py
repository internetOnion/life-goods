from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from lifegoods.ingredient_matching.models import (
    MAX_INGREDIENT_TEXT_LENGTH,
    IngredientMatch,
    IngredientMatcher,
    IngredientMatchingUnavailableError,
    IngredientQualification,
)

router = APIRouter(prefix="/api/experimental", tags=["Ingredient Matching"])


class IngredientMatchRequest(BaseModel):
    ingredient_text: str = Field(
        min_length=1,
        max_length=MAX_INGREDIENT_TEXT_LENGTH,
        description="English ingredient text to match against the prototype taxonomy.",
    )

    @field_validator("ingredient_text")
    @classmethod
    def reject_blank_ingredient_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("ingredient_text must not be blank")
        return value


class IngredientMatchDetailResponse(BaseModel):
    matched_text: str
    start: int
    end: int
    alias: str
    tags: list[str]
    name: str | None
    parents: list[str]
    ambiguous: bool
    qualification: IngredientQualification


class IngredientMatchDataResponse(BaseModel):
    ingredient_tags: list[str]
    matches: list[IngredientMatchDetailResponse]


class IngredientMatchSourceResponse(BaseModel):
    name: str
    taxonomy_sha256: str


class IngredientMatchResponse(BaseModel):
    data: IngredientMatchDataResponse
    source: IngredientMatchSourceResponse


class IngredientMatchErrorDetail(BaseModel):
    code: Literal["invalid_ingredient_text", "prototype_unavailable"]
    message: str


class IngredientMatchErrorResponse(BaseModel):
    error: IngredientMatchErrorDetail


def get_ingredient_matcher() -> IngredientMatcher:
    raise RuntimeError("Ingredient matching dependency is not configured")


@router.post(
    "/ingredient-matches",
    operation_id="matchExperimentalIngredients",
    summary="Match experimental ingredient taxonomy entries",
    description=(
        "Matches English ingredient text against a disposable Open Food Facts taxonomy "
        "projection. This experimental contract is unstable and does not infer allergens."
    ),
    response_model=IngredientMatchResponse,
    responses={
        422: {"model": IngredientMatchErrorResponse},
        503: {"model": IngredientMatchErrorResponse},
    },
)
def match_experimental_ingredients(
    request: Annotated[IngredientMatchRequest, Body()],
    matcher: Annotated[IngredientMatcher, Depends(get_ingredient_matcher)],
) -> IngredientMatchResponse | JSONResponse:
    try:
        result = matcher.match(request.ingredient_text)
    except ValueError:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "invalid_ingredient_text",
                    "message": "Enter ingredient text from 1 to 2000 characters.",
                }
            },
        )
    except IngredientMatchingUnavailableError as error:
        return JSONResponse(
            status_code=503,
            content={"error": {"code": "prototype_unavailable", "message": str(error)}},
        )
    return IngredientMatchResponse(
        data=IngredientMatchDataResponse(
            ingredient_tags=list(result.ingredient_tags),
            matches=[_response_match(match) for match in result.matches],
        ),
        source=IngredientMatchSourceResponse(
            name="Open Food Facts",
            taxonomy_sha256=result.taxonomy_sha256,
        ),
    )


def _response_match(match: IngredientMatch) -> IngredientMatchDetailResponse:
    return IngredientMatchDetailResponse(
        matched_text=match.matched_text,
        start=match.start,
        end=match.end,
        alias=match.alias,
        tags=list(match.tags),
        name=match.name,
        parents=list(match.parents),
        ambiguous=match.ambiguous,
        qualification=match.qualification,
    )
