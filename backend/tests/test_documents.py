"""Document upload + ingestion tests."""
import io


def upload(client, headers, name="auth-guide.md", content=None, title="Auth Guide"):
    data = (content or "").encode() or b"# Doc\n\nHello world.\n"
    return client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (name, io.BytesIO(data), "text/markdown")},
        data={"title": title},
    )


def test_upload_indexes_document(client, auth_headers):
    from tests.conftest import SAMPLE_MD

    res = upload(client, auth_headers, content=SAMPLE_MD)
    assert res.status_code == 201, res.text
    doc = res.json()
    # Background tasks run after the response — re-fetch to see final status.
    fresh = client.get(f"/api/documents/{doc['id']}", headers=auth_headers).json()
    assert fresh["status"] == "indexed"

    listed = client.get("/api/documents", headers=auth_headers).json()
    assert any(d["id"] == doc["id"] for d in listed)


def test_document_chunks_have_sections(client, auth_headers):
    from tests.conftest import SAMPLE_MD

    res = upload(client, auth_headers, name="sections.md", content=SAMPLE_MD,
                 title="Sections Doc")
    doc_id = res.json()["id"]
    chunks = client.get(
        f"/api/documents/{doc_id}/chunks", headers=auth_headers
    ).json()
    assert len(chunks) >= 2
    sections = [c["meta"].get("section") for c in chunks]
    assert any("Token Validation" in (s or "") for s in sections)


def test_unsupported_file_type_rejected(client, auth_headers):
    res = client.post(
        "/api/documents/upload",
        headers=auth_headers,
        files={"file": ("evil.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
    )
    assert res.status_code == 422


def test_upload_requires_auth(client):
    res = client.post(
        "/api/documents/upload",
        files={"file": ("x.md", io.BytesIO(b"# x"), "text/markdown")},
    )
    assert res.status_code == 401


def test_delete_document(client, auth_headers):
    res = upload(client, auth_headers, name="to-delete.md", title="Delete Me")
    doc_id = res.json()["id"]
    assert client.delete(f"/api/documents/{doc_id}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/documents/{doc_id}", headers=auth_headers).status_code == 404
