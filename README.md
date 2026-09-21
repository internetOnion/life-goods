<p align="center">
  <img src="frontend/public/branding/lifegoods-logo.png" alt="Life Goods" width="180" />
</p>

<h1 align="center">Life Goods</h1>

<p align="center">A Khmer-first product-information experience for people shopping in Cambodia.</p>

<p align="center"><em>Built under the DMIL theme for Next Gen Engagement Program Batch 3 — Team WoW.</em></p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-black?logo=fastapi">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white">
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white">
</p>

## Overview

Life Goods gives Khmer-speaking shoppers a fast, readable way to understand packaged-food products from Open Food Facts, with visible attribution and Original Text preserved, plus optional on-demand Khmer Translation.

Read [PRODUCT.md](PRODUCT.md) for the product boundary, [CONTEXT.md](CONTEXT.md) for canonical language, and [docs/SPEC.md](docs/SPEC.md) for the full backend-first contract.

## Features

- **Barcode lookup** — on-device Barcode scanning with a typed-entry fallback; camera frames never leave the device.
- **Product pages with visible Source Attribution** — every field traces back to Open Food Facts, with explicit "Source Data Unavailable" states instead of guessed values.
- **On-demand Khmer Translation** — machine-generated Khmer display text, generated per request and cached, while Original Text always remains available.
- **Product Search** — Barcode and text search across product names and brands.
- **Compare Products** — compare two products' nutrition facts from label photos when a Barcode or Source Record isn't available, with no retained photos or comparison history and no declared "winner."
- **Source-based allergen evidence** — ingredient-text matches shown alongside Open Food Facts allergen tags, never as a safety or allergen-free claim.

## Tech stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router
- **Backend** — FastAPI, Python 3.13, MongoDB, Redis, uv
- **Infra** — Docker Compose, Cloudflare Workers

## Deployment

- **Frontend** is deployed to **Cloudflare** (Workers Static Assets).
- **Backend, MongoDB, and Redis** are deployed together on a **VPS**, reached from Cloudflare through a Workers VPC service and Cloudflare Tunnel. MongoDB and Redis are never exposed on the VPS public address.

See [docs/staging-deployment.md](docs/staging-deployment.md) for the deployment procedure.

## Documentation

- [PRODUCT.md](PRODUCT.md) — product purpose and boundaries
- [CONTEXT.md](CONTEXT.md) — canonical glossary
- [docs/SPEC.md](docs/SPEC.md) — full backend-first behavioral contract
- [AGENTS.md](AGENTS.md) — contributor/agent guide (structure, conventions, issue tracking)
- [docs/generated-data-persistence.md](docs/generated-data-persistence.md) — isolated translation storage architecture and operations
- [docs/staging-deployment.md](docs/staging-deployment.md) — Cloudflare + VPS deployment procedure
- [docs/dataset-deployment.md](docs/dataset-deployment.md) — dataset-only VPS deployment (Open Food Facts snapshot hosting)

## Data & attribution

Every Product page displays a visible "Data from Open Food Facts" link. Life Goods provides a global notice covering the Open Food Facts [conditions for reuse](https://world.openfoodfacts.org/data): the database under the Open Database License, individual database contents under the Database Contents License, and product images under Creative Commons Attribution-ShareAlike. Source Assessments (Nutri-Score, NOVA, Green-Score, etc.) remain visibly attributed Open Food Facts calculations — Life Goods does not verify, recalculate, or present them as its own judgments.

## Team

**Team WoW** — Next Gen Engagement Program Batch 3, DMIL theme.
