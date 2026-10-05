"""Auth + RBAC tests."""


def test_register_first_user_is_admin(admin):
    assert admin["user"]["role"] == "admin"
    assert admin["access_token"]


def test_register_second_user_is_developer(client):
    res = client.post("/api/auth/register", json={
        "name": "Another", "email": "another@test.dev", "password": "password123",
    })
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "developer"


def test_duplicate_email_rejected(client, admin):
    res = client.post("/api/auth/register", json={
        "name": "Dupe", "email": "admin@test.dev", "password": "password123",
    })
    assert res.status_code == 409


def test_login_success(client, admin):
    res = client.post("/api/auth/login", json={
        "email": "admin@test.dev", "password": "password123",
    })
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "admin@test.dev"


def test_login_wrong_password(client):
    res = client.post("/api/auth/login", json={
        "email": "admin@test.dev", "password": "wrong-password",
    })
    assert res.status_code == 401


def test_me(client, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["email"] == "admin@test.dev"


def test_me_unauthenticated(client):
    assert client.get("/api/auth/me").status_code == 401


def test_rbac_blocks_developer_from_admin_endpoints(client, dev_headers):
    res = client.get("/api/admin/users", headers=dev_headers)
    assert res.status_code == 403


def test_admin_can_list_users(client, auth_headers):
    res = client.get("/api/admin/users", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 2


def test_short_password_rejected(client):
    res = client.post("/api/auth/register", json={
        "name": "Short", "email": "short@test.dev", "password": "abc",
    })
    assert res.status_code == 422
