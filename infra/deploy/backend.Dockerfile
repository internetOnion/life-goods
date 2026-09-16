# syntax=docker/dockerfile:1.7
# LifeGoods backend — hardened production image.
#
# Build from the REPO ROOT (context = project root) so the copy paths resolve:
#   docker build -t lifegoods/backend:prod -f infra/deploy/backend.Dockerfile .
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Non-root runtime user.
RUN addgroup --system --gid 10001 lifegoods \
    && adduser --system --uid 10001 --ingroup lifegoods lifegoods

COPY --from=ghcr.io/astral-sh/uv:0.8.22 /uv /usr/local/bin/uv

WORKDIR /app

# Dependency manifests first (leverage layer cache), then app source.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/src ./src
COPY shared ./shared
COPY backend/data ./data
# Build the wheel from the copied source and install it into the venv.
RUN uv build --no-sources \
    && uv pip install --no-deps --no-cache-dir dist/*.whl \
    && rm -rf src dist

ENV UV_CACHE_DIR=/tmp/uv-cache
USER lifegoods

EXPOSE 8000

# Hardened uvicorn: hide server header, cap concurrency, single worker (lightweight).
CMD ["uv", "run", "--no-sync", "uvicorn", "lifegoods.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--no-server-header", "--no-proxy-headers", "--no-access-log", "--limit-concurrency", "40"]
