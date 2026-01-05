import re
from pathlib import Path

EXCEPT_SINGULAR = {"status", "news", "series"}

PREFIX_MAP = {"scm": "Scm", "mdm": "Mdm", "bcm": "Bcm", "os": "Os", "ad": "Ad"}

MODEL_NAME_RE = re.compile(r"(?m)^model\s+(\w+)\s*\{")


def singularize(word: str) -> str:
    if word in EXCEPT_SINGULAR:
        return word
    if word.endswith("ies") and len(word) > 3:
        return word[:-3] + "y"
    if word.endswith("ses") and len(word) > 3:
        return word[:-2]
    if word.endswith("s") and not word.endswith("ss") and len(word) > 1:
        return word[:-1]
    return word


def pascalize_from_table(table: str) -> str:
    # Keep already PascalCase-ish names (Prisma may generate such when table name is quoted).
    if any(ch.isupper() for ch in table):
        return table
    parts = table.split("_")
    if not parts:
        return table
    parts[-1] = singularize(parts[-1])
    out_parts: list[str] = []
    for p in parts:
        out_parts.append(PREFIX_MAP.get(p, p[:1].upper() + p[1:]))
    return "".join(out_parts)


def normalize(schema_text: str) -> str:
    model_names = MODEL_NAME_RE.findall(schema_text)
    mapping: dict[str, str] = {old: pascalize_from_table(old) for old in model_names}

    # 1) Rename model identifiers everywhere (types, relation targets, etc.)
    for old, new in sorted(mapping.items(), key=lambda kv: -len(kv[0])):
        if old != new:
            schema_text = re.sub(rf"\b{re.escape(old)}\b", new, schema_text)

    # 2) Inject @@map("<old>") for renamed models that don't already have @@map
    for old, new in mapping.items():
        if old == new:
            continue

        # Find model block by new name
        block_re = re.compile(
            rf"(?ms)^model\s+{re.escape(new)}\s*\{{(.*?)^\}}\s*$"
        )
        m = block_re.search(schema_text)
        if not m:
            continue
        body = m.group(1)
        if "@@map" in body:
            continue
        # Insert map at the end of the block (before closing brace)
        insert = f'  @@map("{old}")\n'
        new_body = body
        if not new_body.endswith("\n"):
            new_body += "\n"
        new_body = new_body + insert
        schema_text = schema_text[: m.start(1)] + new_body + schema_text[m.end(1) :]

    return schema_text


if __name__ == "__main__":
    schema_path = Path("backend/prisma/schema.prisma")
    raw = schema_path.read_text(encoding="utf-8")
    out = normalize(raw)
    schema_path.write_text(out, encoding="utf-8")
    print("normalized", schema_path)




EXCEPT_SINGULAR = {"status", "news", "series"}

PREFIX_MAP = {"scm": "Scm", "mdm": "Mdm", "bcm": "Bcm", "os": "Os", "ad": "Ad"}

MODEL_NAME_RE = re.compile(r"(?m)^model\s+(\w+)\s*\{")


def singularize(word: str) -> str:
    if word in EXCEPT_SINGULAR:
        return word
    if word.endswith("ies") and len(word) > 3:
        return word[:-3] + "y"
    if word.endswith("ses") and len(word) > 3:
        return word[:-2]
    if word.endswith("s") and not word.endswith("ss") and len(word) > 1:
        return word[:-1]
    return word


def pascalize_from_table(table: str) -> str:
    # Keep already PascalCase-ish names (Prisma may generate such when table name is quoted).
    if any(ch.isupper() for ch in table):
        return table
    parts = table.split("_")
    if not parts:
        return table
    parts[-1] = singularize(parts[-1])
    out_parts: list[str] = []
    for p in parts:
        out_parts.append(PREFIX_MAP.get(p, p[:1].upper() + p[1:]))
    return "".join(out_parts)


def normalize(schema_text: str) -> str:
    model_names = MODEL_NAME_RE.findall(schema_text)
    mapping: dict[str, str] = {old: pascalize_from_table(old) for old in model_names}

    # 1) Rename model identifiers everywhere (types, relation targets, etc.)
    for old, new in sorted(mapping.items(), key=lambda kv: -len(kv[0])):
        if old != new:
            schema_text = re.sub(rf"\b{re.escape(old)}\b", new, schema_text)

    # 2) Inject @@map("<old>") for renamed models that don't already have @@map
    for old, new in mapping.items():
        if old == new:
            continue

        # Find model block by new name
        block_re = re.compile(
            rf"(?ms)^model\s+{re.escape(new)}\s*\{{(.*?)^\}}\s*$"
        )
        m = block_re.search(schema_text)
        if not m:
            continue
        body = m.group(1)
        if "@@map" in body:
            continue
        # Insert map at the end of the block (before closing brace)
        insert = f'  @@map("{old}")\n'
        new_body = body
        if not new_body.endswith("\n"):
            new_body += "\n"
        new_body = new_body + insert
        schema_text = schema_text[: m.start(1)] + new_body + schema_text[m.end(1) :]

    return schema_text


if __name__ == "__main__":
    schema_path = Path("backend/prisma/schema.prisma")
    raw = schema_path.read_text(encoding="utf-8")
    out = normalize(raw)
    schema_path.write_text(out, encoding="utf-8")
    print("normalized", schema_path)


