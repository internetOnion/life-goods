from __future__ import annotations

import re
from dataclasses import dataclass, field

PLACEHOLDER_REGEX = re.compile(r"__LG_TOK_(\d+)__")
LINGERING_PLACEHOLDER_REGEX = re.compile(r"__LG_TOK[A-Za-z0-9_]*")

# Regex patterns for packaged food protected tokens
E_NUMBER_REGEX = re.compile(r"\bE\s*\d{3,4}[a-z]?\b", re.IGNORECASE)
INS_CODE_REGEX = re.compile(r"\bINS\s*\d{3,4}[a-z]?(?:\([a-zA-Z0-9]+\))?(?!\w)", re.IGNORECASE)
PERCENTAGE_REGEX = re.compile(r"\b\d+(?:[\.,]\d+)?\s*%")
UNIT_QUANTITY_REGEX = re.compile(
    r"\b\d+(?:[\.,]\d+)?\s*(?:g|kg|mg|ml|cl|l|មល\.|ក្រัม|กรัม|oz|fl\s*oz|kcal|kj)\b",
    re.IGNORECASE,
)
TEMPERATURE_REGEX = re.compile(
    r"(?:[-+]\s*)?\b\d+(?:[\.,]\d+)?\s*°\s*[CFcf]?\b|(?:[-+]\s*)?\d+(?:[\.,]\d+)?\s*°[CFcf]?",
    re.IGNORECASE,
)
DURATION_REGEX = re.compile(
    r"\b\d+(?:[\.,]\d+)?\s*(?:days?|hours?|hrs?|minutes?|mins?|seconds?|secs?|months?|weeks?|years?)\b",
    re.IGNORECASE,
)
PACKAGING_CODE_REGEX = re.compile(
    r"\b(?:C/)?(?:PETE?|HDPE|PVC|LDPE|PP|PS|OTHER|PAP|FE|ALU|FOR|TEX|GL)\s*\d{1,3}\b"
    r"|\b\d{1,3}\s*(?:PETE?|HDPE|PVC|LDPE|PP|PS|OTHER|PAP|FE|ALU|FOR|TEX|GL)\b",
    re.IGNORECASE,
)
# Uppercase distinguishes source material codes from ordinary words such as "pet".
PACKAGING_MATERIAL_CODE_REGEX = re.compile(
    r"\b(?:C/)?(?:PETE?|HDPE|PVC|LDPE|PP|PS|PAP|FE|ALU|FOR|TEX|GL)\b"
)
RATIO_MULTIPLIER_REGEX = re.compile(r"\b\d+\s*[xX]\s*\d+\b")
NUMERICAL_CODE_REGEX = re.compile(r"\b\d+[a-zA-Z]+\d*\b")
STANDALONE_NUMBER_REGEX = re.compile(r"\b\d+(?:[\.,]\d+)?\b")


@dataclass(frozen=True)
class ProtectionResult:
    masked_text: str
    token_map: dict[str, str]
    protected_tokens: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class TokenValidationResult:
    is_valid: bool
    missing_tokens: list[str] = field(default_factory=list)
    lingering_placeholders: list[str] = field(default_factory=list)


def _collect_spans(
    text: str,
    brand_names: list[str] | None = None,
) -> list[tuple[int, int, str]]:
    spans: list[tuple[int, int, str]] = []

    # 1. Brands take highest priority
    if brand_names:
        # Sort by length descending to match longest brand names first
        sorted_brands = sorted((b.strip() for b in brand_names if b.strip()), key=len, reverse=True)
        for brand in sorted_brands:
            for match in re.finditer(re.escape(brand), text):
                spans.append((match.start(), match.end(), match.group()))

    # 2. INS codes, E-numbers, percentages, units, temperatures, durations, numbers
    for regex in (
        TEMPERATURE_REGEX,
        DURATION_REGEX,
        INS_CODE_REGEX,
        PACKAGING_CODE_REGEX,
        PACKAGING_MATERIAL_CODE_REGEX,
        E_NUMBER_REGEX,
        PERCENTAGE_REGEX,
        UNIT_QUANTITY_REGEX,
        RATIO_MULTIPLIER_REGEX,
        NUMERICAL_CODE_REGEX,
        STANDALONE_NUMBER_REGEX,
    ):
        for match in regex.finditer(text):
            spans.append((match.start(), match.end(), match.group()))

    # Deduplicate and resolve overlapping spans (keep earlier, longer matches)
    spans.sort(key=lambda s: (s[0], -(s[1] - s[0])))
    resolved: list[tuple[int, int, str]] = []
    last_end = -1
    for start, end, token in spans:
        if start >= last_end:
            resolved.append((start, end, token))
            last_end = end

    return resolved


def protect_tokens(
    text: str,
    brand_names: list[str] | None = None,
) -> ProtectionResult:
    if not text:
        return ProtectionResult(masked_text=text, token_map={}, protected_tokens=[])

    spans = _collect_spans(text, brand_names)
    if not spans:
        return ProtectionResult(masked_text=text, token_map={}, protected_tokens=[])

    token_map: dict[str, str] = {}
    protected_tokens: list[str] = []
    chunks: list[str] = []
    cursor = 0

    for idx, (start, end, token) in enumerate(spans):
        placeholder = f"__LG_TOK_{idx}__"
        token_map[placeholder] = token
        protected_tokens.append(token)
        chunks.append(text[cursor:start])
        chunks.append(placeholder)
        cursor = end

    chunks.append(text[cursor:])
    masked_text = "".join(chunks)

    return ProtectionResult(
        masked_text=masked_text,
        token_map=token_map,
        protected_tokens=protected_tokens,
    )


def restore_tokens(text: str, token_map: dict[str, str]) -> str:
    if not text or not token_map:
        return text

    def repl(m: re.Match[str]) -> str:
        placeholder = m.group(0)
        return token_map.get(placeholder, placeholder)

    return PLACEHOLDER_REGEX.sub(repl, text)


def validate_token_preservation(
    restored_text: str,
    token_map: dict[str, str],
) -> TokenValidationResult:
    missing_tokens: list[str] = []
    for _placeholder, token in token_map.items():
        if token not in restored_text:
            missing_tokens.append(token)

    lingering_placeholders = LINGERING_PLACEHOLDER_REGEX.findall(restored_text)

    is_valid = len(missing_tokens) == 0 and len(lingering_placeholders) == 0
    return TokenValidationResult(
        is_valid=is_valid,
        missing_tokens=missing_tokens,
        lingering_placeholders=lingering_placeholders,
    )
