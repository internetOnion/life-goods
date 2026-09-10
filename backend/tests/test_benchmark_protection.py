from lifegoods.translation.benchmark.protection import (
    ProtectionResult,
    TokenValidationResult,
    protect_tokens,
    restore_tokens,
    validate_token_preservation,
)


def test_protect_tokens_e_numbers_and_ins_codes() -> None:
    text = "Contains emulsifier (E322, E476) and acidity regulator (INS 500(ii), INS 451(i))."
    result = protect_tokens(text)
    assert isinstance(result, ProtectionResult)
    assert "E322" in result.protected_tokens
    assert "E476" in result.protected_tokens
    assert "INS 500(ii)" in result.protected_tokens
    assert "INS 451(i)" in result.protected_tokens
    # Placeholders should replace tokens in masked_text
    assert "E322" not in result.masked_text
    assert "__LG_TOK_" in result.masked_text


def test_protect_tokens_percentages_and_numbers() -> None:
    text = "Sugar 65.5%, cocoa mass 25%, sea salt 0.5%."
    result = protect_tokens(text)
    assert "65.5%" in result.protected_tokens
    assert "25%" in result.protected_tokens
    assert "0.5%" in result.protected_tokens


def test_protect_tokens_preserves_thai_quantity_unit_as_one_token() -> None:
    result = protect_tokens("ขนาด 55 กรัม")

    assert "55 กรัม" in result.protected_tokens
    assert "55 กรัม" not in result.masked_text


def test_protect_tokens_brands() -> None:
    text = "Galaxy Smooth Milk Chocolate Bar by Nestlé"
    result = protect_tokens(text, brand_names=["Galaxy", "Nestlé"])
    assert "Galaxy" in result.protected_tokens
    assert "Nestlé" in result.protected_tokens
    assert "Galaxy" not in result.masked_text
    assert "Nestlé" not in result.masked_text


def test_restore_tokens_round_trip() -> None:
    text = "Sugar, cocoa (25%), emulsifier E322, 100g."
    result = protect_tokens(text)
    # When placeholders are restored:
    restored = restore_tokens(result.masked_text, result.token_map)
    assert restored == text


def test_validate_token_preservation_success() -> None:
    text = "Sugar, cocoa 25%, E322"
    result = protect_tokens(text)
    # Translated text with exact placeholders
    translated_with_placeholders = (
        f"ស្ករ, កាកាវ {list(result.token_map.keys())[0]}, {list(result.token_map.keys())[1]}"
    )
    restored = restore_tokens(translated_with_placeholders, result.token_map)
    val = validate_token_preservation(restored, result.token_map)
    assert isinstance(val, TokenValidationResult)
    assert val.is_valid is True
    assert len(val.missing_tokens) == 0
    assert len(val.lingering_placeholders) == 0


def test_validate_token_preservation_missing_or_mangled() -> None:
    text = "Sugar, cocoa 25%, E322"
    result = protect_tokens(text)
    # LLM accidentally drops one placeholder and mangles another
    translated_bad = "ស្ករ, កាកាវ __LG_TOK_0"  # missing closing underscore and dropped token 1
    val = validate_token_preservation(translated_bad, result.token_map)
    assert val.is_valid is False
    assert len(val.missing_tokens) > 0 or len(val.lingering_placeholders) > 0
