# Domain Docs

LifeGoods uses a single domain context shared by the frontend and backend.

## Before exploring

- Read root `CONTEXT.md`.
- Read applicable accepted ADRs under `docs/adr/`.
- Follow the additional area-specific reading requirements in root `AGENTS.md`.

If a document is absent, proceed silently.

## Domain layout

- `CONTEXT.md` contains the shared glossary and domain boundaries.
- `docs/adr/` contains system-wide architectural decisions.
- `docs/SPEC.md`, `docs/DATA_MODEL.md`, and `docs/CLI.md` provide supporting product, schema, and operator detail as directed by `AGENTS.md`.

## Vocabulary

Use the exact terms and capitalization defined by `CONTEXT.md` in issue titles, specifications, code, tests, and implementation notes. Do not replace glossary terms with synonyms it explicitly rejects.

If required terminology is missing, record the gap for domain-modeling rather than silently inventing a competing term.

## ADR conflicts

Surface any conflict with an accepted ADR explicitly. Do not silently override or reinterpret an accepted decision.
