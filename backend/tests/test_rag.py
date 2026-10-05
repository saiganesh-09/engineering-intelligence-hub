"""RAG retrieval + chat pipeline tests."""
import io

from app.core.database import SessionLocal
from app.models.knowledge import SourceType
from app.rag.retriever import retrieve

from tests.conftest import SAMPLE_MD


def _ensure_doc(client, headers):
    docs = client.get("/api/documents", headers=headers).json()
    if not any(d["title"] == "Auth Guide" for d in docs):
        client.post(
            "/api/documents/upload", headers=headers,
            files={"file": ("auth-guide.md", io.BytesIO(SAMPLE_MD.encode()), "text/markdown")},
            data={"title": "Auth Guide"},
        )


def test_retrieval_finds_relevant_chunk(client, auth_headers):
    _ensure_doc(client, auth_headers)
    db = SessionLocal()
    try:
        results = retrieve(db, "how are JWT tokens validated")
    finally:
        db.close()
    assert results
    top = results[0]
    assert top.source_type == SourceType.document
    assert "gateway" in top.content.lower() or "token" in top.content.lower()


def test_retrieval_respects_source_type_filter(client, auth_headers):
    _ensure_doc(client, auth_headers)
    db = SessionLocal()
    try:
        results = retrieve(db, "JWT tokens", source_types=[SourceType.incident])
    finally:
        db.close()
    assert results == []


def test_chat_returns_answer_with_citations(client, auth_headers):
    _ensure_doc(client, auth_headers)
    res = client.post(
        "/api/chat", headers=auth_headers,
        json={"message": "How are JWT tokens validated?", "stream": False},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["answer"]
    assert body["conversation_id"]
    # Sources were retrieved and returned
    assert body["sources"], "expected retrieved sources"

    # Conversation persisted with messages + citations
    conv = client.get(
        f"/api/conversations/{body['conversation_id']}", headers=auth_headers
    ).json()
    roles = [m["role"] for m in conv["messages"]]
    assert roles.count("user") == 1 and roles.count("assistant") == 1


def test_chat_insufficient_context(client, auth_headers):
    res = client.post(
        "/api/chat", headers=auth_headers,
        json={"message": "zzqxv nonsense gibberish unrelated", "stream": False},
    )
    assert res.status_code == 200
    body = res.json()
    assert "does not provide enough information" in body["answer"] or body["insufficient_context"]


def test_streaming_chat(client, auth_headers):
    _ensure_doc(client, auth_headers)
    with client.stream(
        "POST", "/api/chat", headers=auth_headers,
        json={"message": "What does the auth-service do?", "stream": True},
    ) as res:
        assert res.status_code == 200
        raw = "".join(res.iter_text())
    assert "event: sources" in raw
    assert "event: done" in raw


def test_search_endpoint(client, auth_headers):
    _ensure_doc(client, auth_headers)
    res = client.get(
        "/api/search", headers=auth_headers,
        params={"q": "JWT token validation gateway"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert data["results"][0]["title"]
