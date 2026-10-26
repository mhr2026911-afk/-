"""Integration tests for the main path of the app.

Covers the flow that has to work for the app to be usable at all: a visitor
signs up with a phone number, opens a direct chat, sends a message and reads it
back — plus the guards that keep the API closed without a session.
"""


def _signup(client, phone: str, name: str) -> dict:
    requested = client.post("/api/auth/request-code", json={"phone": phone})
    assert requested.status_code == 200, requested.text
    payload = requested.json()
    assert payload["registered"] is False
    code = payload.get("dev_code")
    assert code, "preview mode must expose the code so the flow is testable"

    verified = client.post(
        "/api/auth/verify", json={"phone": phone, "code": code, "name": name}
    )
    assert verified.status_code == 200, verified.text
    return verified.json()


def test_signup_chat_message_flow(client):
    alice = _signup(client, "+966500000101", "اختبار ألف")
    bob = _signup(client, "+966500000102", "اختبار باء")
    headers = {"Authorization": f"Bearer {alice['token']}"}

    me = client.get("/api/users/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["user"]["id"] == alice["user"]["id"]

    opened = client.post(
        "/api/chats/direct", json={"user_id": bob["user"]["id"]}, headers=headers
    )
    assert opened.status_code in (200, 201), opened.text
    conversation_id = (opened.json().get("conversation") or opened.json())["id"]

    sent = client.post(
        f"/api/chats/{conversation_id}/messages",
        json={"kind": "text", "body": "مرحبا"},
        headers=headers,
    )
    assert sent.status_code in (200, 201), sent.text

    messages = client.get(f"/api/chats/{conversation_id}/messages", headers=headers)
    assert messages.status_code == 200, messages.text
    bodies = [message["body"] for message in messages.json()["messages"]]
    assert "مرحبا" in bodies

    chats = client.get("/api/chats", headers=headers)
    assert chats.status_code == 200, chats.text
    assert len(chats.json()["chats"]) == 1


def test_settings_and_group_paths(client):
    alice = _signup(client, "+966500000201", "اختبار ألف")
    bob = _signup(client, "+966500000202", "اختبار باء")
    headers = {"Authorization": f"Bearer {alice['token']}"}

    updated = client.patch("/api/settings", json={"show_online": False}, headers=headers)
    assert updated.status_code == 200, updated.text

    group = client.post(
        "/api/groups",
        json={"title": "مجموعة اختبار", "member_ids": [bob["user"]["id"]]},
        headers=headers,
    )
    assert group.status_code in (200, 201), group.text

    groups = client.get("/api/groups", headers=headers)
    assert groups.status_code == 200, groups.text
    assert len(groups.json()["groups"]) == 1


def test_api_requires_a_session(client):
    assert client.get("/api/chats").status_code == 401
    assert client.get("/api/users/me").status_code == 401
    assert client.get("/api/groups").status_code == 401
