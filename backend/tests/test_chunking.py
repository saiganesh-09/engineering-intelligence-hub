"""Parser and chunker unit tests."""
from app.ingestion.chunker import chunk_blocks, chunk_code
from app.ingestion.parsers import parse_markdown


def test_markdown_heading_structure():
    parsed = parse_markdown(
        "# Title\n\nintro\n\n## A\n\nbody a\n\n### A1\n\nsub a1\n\n## B\n\nbody b"
    )
    assert parsed.title == "Title"
    paths = [" > ".join(b.heading_path) for b in parsed.blocks]
    assert "Title > A > A1" in paths
    assert "Title > B" in paths


def test_chunks_group_by_section():
    body = "This section contains a reasonably long paragraph of documentation text " * 2
    parsed = parse_markdown(
        f"# Guide\n\n{body}\n\n## Install\n\n{body}\n\n## Usage\n\n{body}"
    )
    chunks = chunk_blocks(parsed.blocks)
    assert chunks
    assert all(c.content.strip() for c in chunks)
    # Sections should be preserved in metadata
    assert any("Install" in (c.meta.get("section") or "") for c in chunks)


def test_python_ast_chunking():
    code = '''
import os

CONSTANT = 1


def helper(x):
    """Help."""
    return x + 1


class Thing:
    def method(self):
        return helper(CONSTANT)
'''
    chunks = chunk_code(code, "python", "mod.py")
    symbols = {c.meta.get("symbol") for c in chunks}
    assert "helper" in symbols
    assert "Thing" in symbols
    assert any(c.meta.get("kind") == "module" for c in chunks)


def test_code_fallback_chunking():
    code = "\n".join(
        f"const line{i} = doSomethingMeaningful(withSome, arguments, here);"
        for i in range(300)
    )
    chunks = chunk_code(code, "javascript", "big.js")
    assert len(chunks) > 1
    assert all("line_start" in c.meta for c in chunks)


def test_invalid_python_falls_back():
    code = "def broken(:\n  this is not python"
    chunks = chunk_code(code, "python", "bad.py")
    assert chunks  # fell back to line chunker
