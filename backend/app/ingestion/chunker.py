"""Structure-aware chunking.

Documents are chunked along their section/paragraph boundaries (not fixed
windows), and source code is chunked by top-level definitions when the
language allows (Python via ``ast``; other languages via declaration
heuristics), falling back to line windows.
"""
from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field

from app.ingestion.parsers import Block

TARGET_TOKENS = 450
MAX_TOKENS = 700
OVERLAP_TOKENS = 60
MIN_TOKENS = 20
CODE_MIN_TOKENS = 8  # a one-liner function is still meaningful


def approx_tokens(text: str) -> int:
    return max(1, len(text) // 4)


@dataclass
class RawChunk:
    content: str
    meta: dict = field(default_factory=dict)


def _split_long_text(text: str, max_tokens: int = MAX_TOKENS) -> list[str]:
    """Split oversized text on paragraph → sentence → hard boundaries."""
    if approx_tokens(text) <= max_tokens:
        return [text]
    parts: list[str] = []
    # Paragraph level first
    for para in re.split(r"\n\s*\n", text):
        if approx_tokens(para) <= max_tokens:
            parts.append(para)
            continue
        # Sentence level
        sentences = re.split(r"(?<=[.!?])\s+", para)
        buf = ""
        for s in sentences:
            if buf and approx_tokens(buf + " " + s) > max_tokens:
                parts.append(buf)
                buf = s
            else:
                buf = f"{buf} {s}".strip()
        if buf:
            parts.append(buf)
    # Hard-split anything still oversized
    out: list[str] = []
    max_chars = max_tokens * 4
    for p in parts:
        while len(p) > max_chars:
            out.append(p[:max_chars])
            p = p[max_chars:]
        if p.strip():
            out.append(p)
    return out


def chunk_blocks(blocks: list[Block]) -> list[RawChunk]:
    """Group parsed blocks into structure-aware chunks.

    Consecutive blocks sharing a heading path are merged until the target
    size; oversized blocks are split on paragraph boundaries. Each chunk
    records its section path and page range.
    """
    chunks: list[RawChunk] = []
    buf: list[str] = []
    buf_path: list[str] = []
    buf_pages: list[int] = []

    def flush():
        nonlocal buf, buf_pages
        text = "\n\n".join(buf).strip()
        if text:
            chunks.append(
                RawChunk(
                    content=text,
                    meta={
                        "section": " > ".join(buf_path) or None,
                        "page_start": min(buf_pages) if buf_pages else None,
                        "page_end": max(buf_pages) if buf_pages else None,
                    },
                )
            )
        buf = []
        buf_pages = []

    for block in blocks:
        for piece in _split_long_text(block.text):
            piece_tokens = approx_tokens(piece)
            buf_tokens = approx_tokens("\n\n".join(buf)) if buf else 0
            # Start a new chunk when over target or the section changes.
            if buf and (
                buf_tokens + piece_tokens > TARGET_TOKENS
                or block.heading_path != buf_path
            ):
                flush()
            if not buf:
                buf_path = block.heading_path
            buf.append(piece)
            if block.page is not None:
                buf_pages.append(block.page)
            if approx_tokens("\n\n".join(buf)) >= MAX_TOKENS:
                flush()
    flush()

    # Merge undersized chunks into a neighbor instead of dropping them —
    # small sections still carry retrievable knowledge.
    if len(chunks) > 1:
        merged: list[RawChunk] = []
        for c in chunks:
            if merged and approx_tokens(c.content) < MIN_TOKENS:
                merged[-1].content += "\n\n" + c.content
                prev, cur = merged[-1].meta, c.meta
                if cur.get("page_end") and (
                    not prev.get("page_end") or cur["page_end"] > prev["page_end"]
                ):
                    prev["page_end"] = cur["page_end"]
            else:
                merged.append(c)
        if len(merged) > 1 and approx_tokens(merged[0].content) < MIN_TOKENS:
            merged[1].content = merged[0].content + "\n\n" + merged[1].content
            merged.pop(0)
        chunks = merged
    return chunks


# ---------------- Code chunking ----------------

_PY_AST_MAX = 60  # max file size (KB) we bother parsing with AST


def _chunk_python_ast(content: str) -> list[RawChunk] | None:
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return None
    lines = content.splitlines()
    chunks: list[RawChunk] = []
    covered: set[int] = set()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            start, end = node.lineno - 1, node.end_lineno or node.lineno
            covered.update(range(start, end))
            body = "\n".join(lines[start:end])
            kind = "class" if isinstance(node, ast.ClassDef) else "function"
            chunks.append(
                RawChunk(
                    content=body,
                    meta={"symbol": node.name, "kind": kind,
                          "line_start": start + 1, "line_end": end},
                )
            )
    # Module-level code (imports, constants, docstring) as a preamble chunk.
    preamble = "\n".join(
        line for i, line in enumerate(lines) if i not in covered and line.strip()
    )
    if preamble.strip():
        chunks.insert(0, RawChunk(content=preamble[:4000], meta={"kind": "module"}))
    return chunks or None


_DECL_RE = re.compile(
    r"^(?:export\s+|public\s+|private\s+|protected\s+|static\s+|async\s+|func\s+|def\s+)*"
    r"(?:class|interface|function|func|def|struct|enum|impl|trait|const|fn|sub)\b"
)


def _chunk_code_lines(content: str) -> list[RawChunk]:
    """Line-window chunker biased toward declaration boundaries."""
    lines = content.splitlines()
    boundaries = [0]
    for i, line in enumerate(lines):
        if line and not line[0].isspace() and _DECL_RE.match(line.strip()):
            boundaries.append(i)
    boundaries.append(len(lines))

    chunks: list[RawChunk] = []
    buf: list[str] = []
    buf_start = 0
    for i in range(len(boundaries) - 1):
        start, end = boundaries[i], boundaries[i + 1]
        segment = lines[start:end]
        if buf and approx_tokens("\n".join(buf + segment)) > MAX_TOKENS:
            chunks.append(RawChunk(content="\n".join(buf),
                                   meta={"line_start": buf_start + 1,
                                         "line_end": start}))
            buf, buf_start = [], start
        if not buf:
            buf_start = start
        buf.extend(segment)
    if buf:
        chunks.append(RawChunk(content="\n".join(buf),
                               meta={"line_start": buf_start + 1,
                                     "line_end": len(lines)}))
    return chunks


def chunk_code(content: str, language: str | None, file_path: str) -> list[RawChunk]:
    """Chunk source code, preferring semantic (function/class) boundaries."""
    chunks: list[RawChunk] | None = None
    if language == "python" and len(content) < _PY_AST_MAX * 1024:
        chunks = _chunk_python_ast(content)
    if not chunks:
        chunks = _chunk_code_lines(content)
    # Drop trivially small chunks except tiny files; always keep the
    # module preamble (imports/constants carry useful context).
    if len(chunks) > 1:
        chunks = [
            c for c in chunks
            if approx_tokens(c.content) >= CODE_MIN_TOKENS
            or c.meta.get("kind") == "module"
        ]
    for c in chunks:
        c.meta.setdefault("file_path", file_path)
        if language:
            c.meta.setdefault("language", language)
    return chunks
