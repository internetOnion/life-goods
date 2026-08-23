---
status: superseded by ADR-0006
---

# ADR 0004: Google Gemini 3.7 Flash & Dual-Layered Safety Architecture

This pre-benchmark model commitment and its unsupported accuracy guarantees were superseded by ADR 0006. The project now selects a model from measured packaging performance and records every extraction and assessment version.

## Context
Multilingual packaging OCR in Cambodia is uniquely challenging due to:
1. Low-quality printing and tiny 6pt fonts on imported snack bags.
2. Stacked Vietnamese diacritics (`ấ`, `ở`, `ễ`, `ợ`) on reflective foil/plastic packaging.
3. Dense Chinese Hanzi date markings (`生产日期` vs `保质期`).
4. Complex Khmer script with subscript consonants (ជើង).
5. Critical health and life-safety implications of allergen misclassification (e.g. fatal anaphylaxis from hidden peanut/dairy derivatives).

Relying solely on generic OCR models (like Tesseract) leads to frequent character dropouts on reflective packaging. Conversely, relying purely on unconstrained LLM text generation introduces hallucination risks for chemical E-numbers and mathematical errors in date arithmetic.

## Decision
1. **Model Selection**: We adopt **Google Gemini 3.7 Flash** (`gemini-3.7-flash` via `@google/genai`) as the core multimodal intelligence engine. Gemini 3.7 Flash delivers superior vision tokenization for degraded packaging, sub-second latency for retail aisles, and a configurable reasoning/thinking budget to deduce hidden allergen derivatives (e.g. tracing *casein* or *whey* back to *dairy*).
2. **Dual-Layered Safety Architecture**:
   - **Layer 1 (AI Semantic Extraction & Reasoning)**: Gemini 3.7 Flash performs multilingual OCR, translates to natural Khmer, and extracts structured ingredient/additive tokens.
   - **Layer 2 (Deterministic Rule Validation)**: Every extracted token is validated against deterministic safety rules:
     - **Codex 14 Major Allergens**: Parallel 4-language regex keyword scanner.
     - **Halal/Haram Rules**: Categorizes additives as Halal, Haram, or Mushbooh (Doubtful).
     - **400+ E-Number Registry**: Exact cross-referencing against Codex GSFA and EFSA databases.
     - **Date Calculation**: Deterministic arithmetic via `date-fns` (never let LLM calculate calendar math).
3. **Zero-Trust Confidence Tiering**: Output is badged as `AI_EXTRACTED` with a clear medical disclaimer (ADR 0001) until moderated.

## Considered Options
1. **Classic OCR (Tesseract / EasyOCR) + Translation API**: Fragile on curved foil packages, high failure rate on stacked Vietnamese diacritics, unable to reason about allergen derivatives.
2. **Pure LLM Generation without Rule Validation**: High risk of hallucinated E-numbers, arithmetic errors on date calculations, unacceptable safety liability.
3. **Gemini 3.7 Flash + Deterministic Dual-Layer Validation**: Maximum real-world extraction accuracy with mathematically guaranteed safety bounds.

## Consequences
- Requires `@google/genai` SDK integration with structured JSON schema (`responseSchema`).
- Deterministic rules engines run on both backend and client-side (for Offline Market Mode).
- Zero hallucination risk on safety classifications.
