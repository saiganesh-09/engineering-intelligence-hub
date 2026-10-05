"""GitHub repository ingestion: safe clone, file filtering, language detection."""
from __future__ import annotations

import logging
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from git import Git, GitCommandError

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

IGNORED_DIRS = {
    ".git", "node_modules", "dist", "build", "out", "target", ".next",
    "__pycache__", ".venv", "venv", "env", ".idea", ".vscode", "coverage",
    ".cache", ".turbo", "vendor", "bin", "obj", ".gradle", ".mvn",
    "site-packages", "egg-info",
}

IGNORED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".bmp",
    ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp4", ".mp3", ".wav", ".mov", ".avi",
    ".exe", ".dll", ".so", ".dylib", ".class", ".jar", ".pyc", ".pyo",
    ".lock", ".min.js", ".map", ".wasm", ".db", ".sqlite", ".bin",
}

LANGUAGE_MAP = {
    ".py": "python", ".ts": "typescript", ".tsx": "typescript",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript",
    ".go": "go", ".rs": "rust", ".java": "java", ".kt": "kotlin",
    ".rb": "ruby", ".php": "php", ".cs": "csharp", ".cpp": "cpp",
    ".cc": "cpp", ".c": "c", ".h": "c", ".hpp": "cpp",
    ".swift": "swift", ".scala": "scala", ".sql": "sql", ".sh": "shell",
    ".bash": "shell", ".ps1": "powershell", ".lua": "lua", ".r": "r",
    ".md": "markdown", ".markdown": "markdown", ".mdx": "markdown",
    ".txt": "text", ".rst": "rst",
    ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
    ".xml": "xml", ".html": "html", ".css": "css", ".scss": "scss",
    ".graphql": "graphql", ".proto": "protobuf",
}

MAX_FILE_BYTES = 512 * 1024  # skip files larger than 512 KB


class RepoError(RuntimeError):
    pass


def parse_github_url(url: str) -> tuple[str, str]:
    """Return (owner, name) from a GitHub URL."""
    url = url.strip().rstrip("/").removesuffix(".git")
    m = re.search(r"github\.com[:/]([^/]+)/([^/]+)$", url)
    if not m:
        raise RepoError(f"Not a valid GitHub repository URL: {url}")
    return m.group(1), m.group(2)


def _authed_url(url: str) -> str:
    """Embed the PAT in an https URL for private repos (never logged)."""
    if not settings.github_token:
        return url
    if url.startswith("https://") and "@" not in url:
        return url.replace("https://", f"https://x-access-token:{settings.github_token}@")
    return url


def _tarball_candidates(url: str, branch: str | None) -> tuple[str, list[str]]:
    owner, name = parse_github_url(url)
    if branch:
        branches = list(dict.fromkeys([branch, "main", "master"]))
    else:
        branches = ["main", "master"]
    return owner, name, branches


def _download_tarball(url: str, dest: Path, branch: str | None = None) -> str:
    """Fallback for hosts without a git binary (serverless): fetch the repo
    as a GitHub tarball via the public codeload endpoint. Returns the branch
    actually used."""
    import tarfile
    from io import BytesIO

    import httpx

    owner, name, branches = _tarball_candidates(url, branch)
    headers = {}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    last_err: Exception | None = None
    for b in branches:
        try:
            r = httpx.get(
                f"https://codeload.github.com/{owner}/{name}/tar.gz/{b}",
                headers=headers, follow_redirects=True, timeout=120,
            )
            r.raise_for_status()
            if dest.exists():
                shutil.rmtree(dest)
            dest.mkdir(parents=True, exist_ok=True)
            with tarfile.open(fileobj=BytesIO(r.content), mode="r:gz") as tar:
                # Strip the top-level "<repo>-<sha>" directory.
                members = [m for m in tar.getmembers() if "/" in m.name]
                for m in members:
                    m.name = m.name.split("/", 1)[1]
                tar.extractall(dest, members=[m for m in members if m.name])
            return b
        except Exception as exc:  # noqa: BLE001 — try next branch
            last_err = exc
            continue
    raise RepoError(
        f"Failed to download repository. Check the URL, branch name, and "
        f"access permissions. ({str(last_err)[:200] if last_err else 'unknown error'})"
    )


def clone_repository(url: str, dest: Path, branch: str | None = None) -> str:
    """Shallow-clone ``url`` into ``dest``. Returns the branch actually used.
    Falls back to a GitHub tarball download when git isn't installed
    (serverless runtimes)."""
    if shutil.which("git") is None:
        return _download_tarball(url, dest, branch)
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    authed = _authed_url(url)
    git = Git()
    # Try the requested branch first, then the remote default and common names.
    if branch:
        branches = list(dict.fromkeys([branch, None, "main", "master"]))
    else:
        branches = [None, "main", "master"]
    last_err: Exception | None = None
    for b in branches:
        try:
            args = {"depth": 1, "single_branch": True}
            if b:
                args["branch"] = b
            git.clone(authed, str(dest), **args)
            if dest.exists():
                return b or _current_branch(dest)
        except GitCommandError as exc:
            last_err = exc
            continue
    raise RepoError(
        f"Failed to clone repository. Check the URL, branch name, and access "
        f"permissions. ({str(last_err)[:200] if last_err else 'unknown error'})"
    )


def _current_branch(dest: Path) -> str:
    try:
        from git import Repo

        return Repo(str(dest)).active_branch.name
    except Exception:
        return "main"


@dataclass
class DiscoveredFile:
    path: str          # repo-relative path
    language: str | None
    content: str
    size: int


def _is_probably_binary(raw: bytes) -> bool:
    return b"\x00" in raw[:8192]


def discover_files(repo_root: Path) -> list[DiscoveredFile]:
    """Walk the repo and return indexable files (code + docs)."""
    discovered: list[DiscoveredFile] = []
    total_bytes = 0
    max_total = settings.max_repo_mb * 1024 * 1024

    for path in sorted(repo_root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(repo_root).as_posix()
        parts = set(path.relative_to(repo_root).parts[:-1])
        if parts & IGNORED_DIRS or any(p.startswith(".") and p != ".github" for p in parts):
            continue
        suffix = path.suffix.lower()
        if suffix in IGNORED_EXTENSIONS:
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size == 0 or size > MAX_FILE_BYTES:
            continue
        if total_bytes + size > max_total:
            logger.warning("Repo size cap reached at %s", rel)
            break
        # Unknown extension without a recognizable name → skip binary-ish files.
        if suffix not in LANGUAGE_MAP and path.name not in {
            "Dockerfile", "Makefile", "LICENSE", "CHANGELOG", "CONTRIBUTING",
        }:
            raw = path.read_bytes()[:8192]
            if _is_probably_binary(raw):
                continue
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        total_bytes += size
        discovered.append(
            DiscoveredFile(
                path=rel,
                language=LANGUAGE_MAP.get(suffix, "text" if suffix in {".txt"} else suffix.lstrip(".") or None),
                content=content,
                size=size,
            )
        )
    return discovered
