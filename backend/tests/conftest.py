"""Test fixtures: isolated SQLite DB + offline mock providers."""
import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="eih_test_"))

# Configure environment BEFORE any app modules are imported.
os.environ.update({
    "DATABASE_URL": f"sqlite+pysqlite:///{_tmp / 'test.db'}",
    "JWT_SECRET": "test-secret",
    "LLM_PROVIDER": "mock",
    "EMBEDDING_PROVIDER": "hash",
    "STORAGE_DIR": str(_tmp / "storage"),
    "RATE_LIMIT_PER_MINUTE": "100000",
    "FRONTEND_URL": "http://localhost:3000",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin(client) -> dict:
    """First registered user — becomes admin."""
    res = client.post("/api/auth/register", json={
        "name": "Admin", "email": "admin@test.dev", "password": "password123",
    })
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture(scope="session")
def auth_headers(admin) -> dict:
    return {"Authorization": f"Bearer {admin['access_token']}"}


@pytest.fixture(scope="session")
def dev_headers(client) -> dict:
    """A second user — developer role by default."""
    res = client.post("/api/auth/register", json={
        "name": "Dev", "email": "dev@test.dev", "password": "password123",
    })
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


SAMPLE_MD = """# Auth Service Guide

## Overview
The auth-service issues JWT tokens for internal service calls between the
API gateway and downstream microservices. It owns the token signing keys,
the refresh-token store, and the service-account registry used by all
platform workloads.

## Token Validation
Tokens are validated at the API gateway before requests reach downstream
services. The gateway checks signature, expiry, and audience claims against
the published JWKS endpoint and rejects anything malformed with a 401.

## Rotation
Signing keys rotate every 90 days via the secrets manager. Old keys remain
valid for a 24-hour grace period so in-flight tokens are not rejected
during the rollover window.
"""
