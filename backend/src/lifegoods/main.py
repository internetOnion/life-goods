from collections.abc import Iterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from lifegoods.adapters.database import create_session_factory, session_dependency
from lifegoods.api.contracts import ErrorDetail, ErrorEnvelope
from lifegoods.api.package_matches import get_session, router
from lifegoods.matching.identifier import InvalidIdentifierError
from lifegoods.settings import Settings

ERROR_MESSAGES = {
    "IDENTIFIER_REQUIRED": "An identifier is required.",
    "IDENTIFIER_CHARACTERS_INVALID": "The identifier can contain only digits, spaces, or hyphens.",
    "IDENTIFIER_LENGTH_UNSUPPORTED": "The identifier is not a supported GTIN, EAN, or UPC length.",
    "IDENTIFIER_CHECK_DIGIT_INVALID": "The identifier check digit is invalid.",
}


def create_app(
    *,
    settings: Settings | None = None,
    session_factory: sessionmaker[Session] | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    resolved_factory = session_factory or create_session_factory(resolved_settings)
    app = FastAPI(title="LifeGoods API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(router)

    def provide_session() -> Iterator[Session]:
        yield from session_dependency(resolved_factory)

    app.dependency_overrides[get_session] = provide_session

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        _request: Request, _error: RequestValidationError
    ) -> JSONResponse:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code="IDENTIFIER_REQUIRED",
                message=ERROR_MESSAGES["IDENTIFIER_REQUIRED"],
            )
        )
        return JSONResponse(status_code=422, content=envelope.model_dump())

    @app.exception_handler(InvalidIdentifierError)
    async def invalid_identifier_handler(
        _request: Request, error: InvalidIdentifierError
    ) -> JSONResponse:
        envelope = ErrorEnvelope(
            error=ErrorDetail(code=error.code, message=ERROR_MESSAGES[error.code])
        )
        return JSONResponse(status_code=422, content=envelope.model_dump())

    @app.exception_handler(SQLAlchemyError)
    async def database_unavailable_handler(
        _request: Request, _error: SQLAlchemyError
    ) -> JSONResponse:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code="PACKAGE_MATCH_SOURCE_UNAVAILABLE",
                message="Package Match lookup is temporarily unavailable.",
            )
        )
        return JSONResponse(status_code=503, content=envelope.model_dump())

    return app


app = create_app()
