import re

CHUNK_SPLIT_DELIMITERS = re.compile(r"[,;]\s*")


def _split_top_level_items(text: str) -> list[str]:
    items: list[str] = []
    current: list[str] = []
    paren_depth = 0
    bracket_depth = 0
    brace_depth = 0

    i = 0
    n = len(text)

    while i < n:
        ch = text[i]

        if ch == "(":
            paren_depth += 1
        elif ch == ")":
            paren_depth = max(0, paren_depth - 1)
        elif ch == "[":
            bracket_depth += 1
        elif ch == "]":
            bracket_depth = max(0, bracket_depth - 1)
        elif ch == "{":
            brace_depth += 1
        elif ch == "}":
            brace_depth = max(0, brace_depth - 1)

        # Delimiter check at top level
        if paren_depth == 0 and bracket_depth == 0 and brace_depth == 0 and ch in (",", ";"):
            item_str = "".join(current).strip()
            if item_str:
                items.append(item_str)
            current = []
            # Skip following whitespace
            while i + 1 < n and text[i + 1].isspace():
                i += 1
            i += 1
            continue


        current.append(ch)
        i += 1

    remaining = "".join(current).strip()
    if remaining:
        items.append(remaining)

    return items


def chunk_ingredients(text: str, max_chunk_chars: int = 800) -> list[str]:
    trimmed = text.strip()
    if len(trimmed) <= max_chunk_chars:
        return [trimmed]

    items = _split_top_level_items(trimmed)
    if not items or len(items) == 1:
        return [trimmed]

    chunks: list[str] = []
    current_chunk: list[str] = []
    current_length = 0

    for item in items:
        # Delimiter length roughly 2 characters (", ")
        added_len = len(item) + (2 if current_chunk else 0)
        if current_chunk and (current_length + added_len > max_chunk_chars):
            chunks.append(", ".join(current_chunk))
            current_chunk = [item]
            current_length = len(item)
        else:
            current_chunk.append(item)
            current_length += added_len

    if current_chunk:
        chunks.append(", ".join(current_chunk))

    return chunks


def join_ingredient_chunks(chunks: list[str]) -> str:
    cleaned = [c.strip().rstrip(".,; ") for c in chunks if c and c.strip()]
    if not cleaned:
        return ""
    return ", ".join(cleaned)
