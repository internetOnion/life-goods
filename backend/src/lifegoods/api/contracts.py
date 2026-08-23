from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


class PackageMatchCandidateResponse(BaseModel):
    package_variant_id: str
    product_id: str


class PackageMatchesResponse(BaseModel):
    normalized_identifier: str
    scheme: str
    candidates: list[PackageMatchCandidateResponse]
