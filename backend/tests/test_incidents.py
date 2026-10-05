"""Incident CRUD + analysis tests."""

PAYLOAD = {
    "title": "Payment API timeouts during deploy",
    "severity": "critical",
    "status": "resolved",
    "description": "Payment API returned 504s for 12 minutes during the v4.1 deploy.",
    "root_cause": "Connection pool exhausted by blocking health check.",
    "resolution": "Rolled back; moved health check off the request threadpool.",
    "affected_services": ["payment-service", "api-gateway"],
}


def test_create_incident(client, auth_headers):
    res = client.post("/api/incidents", headers=auth_headers, json=PAYLOAD)
    assert res.status_code == 201, res.text
    inc = res.json()
    assert inc["severity"] == "critical"
    assert inc["affected_services"] == ["payment-service", "api-gateway"]


def test_incident_is_searchable(client, auth_headers):
    res = client.get(
        "/api/search", headers=auth_headers,
        params={"q": "payment timeouts connection pool"},
    )
    assert res.status_code == 200
    assert any(r["source_type"] == "incident" for r in res.json()["results"])


def test_incident_analysis(client, auth_headers):
    inc = client.get("/api/incidents", headers=auth_headers).json()[0]
    res = client.post(
        f"/api/incidents/{inc['id']}/analyze", headers=auth_headers
    )
    assert res.status_code == 200
    assert res.json()["answer"]


def test_update_incident(client, auth_headers):
    inc = client.get("/api/incidents", headers=auth_headers).json()[0]
    res = client.patch(
        f"/api/incidents/{inc['id']}", headers=auth_headers,
        json={"status": "closed"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "closed"


def test_incident_stats(client, auth_headers):
    res = client.get("/api/incidents/stats/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert "critical" in data["by_severity"]
