import re
from collections import Counter

from lifegoods.translation.protection import (
    protect_tokens,
    validate_token_preservation,
)
from lifegoods.translation.selection import KHMER_CHAR_REGEX


def validate_field_translation(
    input_text: str,
    raw_response_text: str,
    restored_text: str,
    token_map: dict[str, str],
    *,
    target_language: str = "kh",
) -> list[str]:
    reasons: list[str] = []

    if not restored_text or not restored_text.strip():
        reasons.append("Output is empty")
        return reasons

    # 1. 1:1 Placeholder presence in raw provider response
    for placeholder in token_map:
        count_raw = raw_response_text.count(placeholder)
        if count_raw == 0:
            reasons.append(f"Missing placeholder in provider output: {placeholder}")
        elif count_raw > 1:
            reasons.append(
                f"Duplicated placeholder in provider output: {placeholder} ({count_raw} times)"
            )

    # 2. Token preservation & lingering placeholder check in restored text
    token_res = validate_token_preservation(restored_text, token_map)
    if not token_res.is_valid:
        if token_res.missing_tokens:
            reasons.append(f"Missing tokens: {', '.join(token_res.missing_tokens)}")
        if token_res.lingering_placeholders:
            reasons.append(f"Lingering placeholders: {', '.join(token_res.lingering_placeholders)}")

    # 3. Bounds check against input text length
    in_len = len(input_text.strip())
    out_len = len(restored_text.strip())
    max_allowed = max(300, in_len * 5)
    if out_len > max_allowed or out_len > 4000:
        reasons.append(
            f"Output length ({out_len}) exceeds reasonable bounds for input length ({in_len})"
        )

    # 4. Script validation for target language
    if target_language in ("kh", "km"):
        # Remove known protected tokens from text before checking script
        text_without_tokens = restored_text
        for tok in token_map.values():
            if tok:
                text_without_tokens = text_without_tokens.replace(tok, "")

        # Check if remaining text contains Khmer characters
        if not KHMER_CHAR_REGEX.search(text_without_tokens):
            reasons.append("Output does not contain valid Khmer script")

    source_prose = input_text
    output_prose = restored_text
    for token in token_map.values():
        source_prose = source_prose.replace(token, "")
        output_prose = output_prose.replace(token, "")
    source_words = re.sub(r"[\W_]+", "", KHMER_CHAR_REGEX.sub("", source_prose)).casefold()
    output_words = re.sub(r"[\W_]+", "", KHMER_CHAR_REGEX.sub("", output_prose)).casefold()
    if source_words and source_words in output_words:
        reasons.append("Output retains unchanged source prose")

    # Khmer does not require word-separating spaces. Normalize script boundaries
    # for numeric/code comparison without changing the returned translation.
    if Counter(
        protect_tokens(KHMER_CHAR_REGEX.sub(" ", restored_text)).protected_tokens
    ) != Counter(protect_tokens(KHMER_CHAR_REGEX.sub(" ", input_text)).protected_tokens):
        reasons.append("Output alters protected values")

    # Appending Latin letters/digits can turn an intact placeholder into a
    # different brand or unit (for example, 5 g + allons). Khmer adjacency is valid.
    for placeholder, token in token_map.items():
        escaped = re.escape(placeholder)
        if (
            re.match(r"[A-Za-z0-9]", token)
            and re.search(rf"[A-Za-z0-9]{escaped}", raw_response_text)
        ) or (
            re.search(r"[A-Za-z0-9]$", token)
            and re.search(rf"{escaped}[A-Za-z0-9]", raw_response_text)
        ):
            reasons.append("Output alters a protected token boundary")

    return reasons
