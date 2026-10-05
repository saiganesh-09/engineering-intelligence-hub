"""Document parsers: extract structured text blocks from files.

Each parser returns a list of :class:`Block` objects carrying the text plus
structural metadata (heading path, page number) that downstream chunking
and citation rendering rely on.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Block:
    text: str
    heading_path: list[str] = field(default_factory=list)
    page: int | None = None


@dataclass
class ParsedContent:
    title: str
    blocks: list[Block]


class UnsupportedFileType(ValueError):
    pass


_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


def parse_markdown(text: str) -> ParsedContent:
    """Split markdown into heading-scoped blocks."""
    blocks: list[Block] = []
    heading_stack: list[tuple[int, str]] = []
    buf: list[str] = []
    title = ""

    def flush():
        nonlocal buf
        body = "\n".join(buf).strip()
        if body:
            blocks.append(
                Block(text=body, heading_path=[h for _, h in heading_stack])
            )
        buf = []

    for line in text.splitlines():
        m = _HEADING_RE.match(line)
        if m:
            flush()
            level, heading = len(m.group(1)), m.group(2).strip()
            if not title:
                title = heading
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, heading))
        else:
            buf.append(line)
    flush()
    return ParsedContent(title=title, blocks=blocks)


def parse_pdf(path: Path) -> ParsedContent:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    blocks: list[Block] = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            blocks.append(Block(text=text, page=i))
    title = path.stem
    try:
        meta_title = (reader.metadata or {}).get("/Title")
        if meta_title:
            title = str(meta_title).strip() or title
    except Exception:
        pass
    return ParsedContent(title=title, blocks=blocks)


def parse_docx(path: Path) -> ParsedContent:
    from docx import Document as DocxDocument

    doc = DocxDocument(str(path))
    blocks: list[Block] = []
    heading_stack: list[tuple[int, str]] = []
    buf: list[str] = []
    title = ""

    def flush():
        nonlocal buf
        body = "\n".join(buf).strip()
        if body:
            blocks.append(Block(text=body, heading_path=[h for _, h in heading_stack]))
        buf = []

    for para in doc.paragraphs:
        style = (para.style.name or "") if para.style else ""
        m = re.match(r"Heading\s+(\d)", style)
        if m and para.text.strip():
            flush()
            level = int(m.group(1))
            heading = para.text.strip()
            if not title:
                title = heading
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, heading))
        elif style.lower() == "title" and para.text.strip():
            title = para.text.strip()
        else:
            buf.append(para.text)
    flush()
    return ParsedContent(title=title, blocks=blocks)


def parse_text(text: str) -> ParsedContent:
    body = text.strip()
    return ParsedContent(title="", blocks=[Block(text=body)] if body else [])


def parse_file(path: Path, file_type: str) -> ParsedContent:
    """Dispatch to the right parser based on file extension."""
    ft = file_type.lower().lstrip(".")
    if ft in {"md", "markdown", "mdx"}:
        parsed = parse_markdown(path.read_text(encoding="utf-8", errors="replace"))
    elif ft == "pdf":
        parsed = parse_pdf(path)
    elif ft == "docx":
        parsed = parse_docx(path)
    elif ft in {"txt", "text", "rst", "log"}:
        parsed = parse_text(path.read_text(encoding="utf-8", errors="replace"))
    else:
        raise UnsupportedFileType(f"Unsupported file type: {file_type}")
    if not parsed.title:
        parsed.title = path.stem
    return parsed


SUPPORTED_UPLOAD_EXTENSIONS = {".md", ".markdown", ".txt", ".pdf", ".docx", ".rst"}
