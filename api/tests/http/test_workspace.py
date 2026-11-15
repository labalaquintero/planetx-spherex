import base64
from uuid import uuid4

from fastapi.testclient import TestClient

from conftest import FakeCatalog, FakeScience, TINY_PNG, make_client, synthetic_prepared

PREFIX = "/api/v1/workspace"
WRITE_HEADER = {"X-PlanetX-Workspace": "1"}
PASSWORD = "SYNTH: prueba de cuenta 2026"
PARAMS = {"ra_deg": 10.25, "dec_deg": -12.5}
PDF = b"%PDF-1.7\n% Archivo sintetico para probar permisos de descarga\n%%EOF\n"


def register(client, alias):
    response = client.post(f"{PREFIX}/register", headers=WRITE_HEADER, json={
        "alias": alias, "email": f"{alias.lower()}@example.test", "password": PASSWORD,
    })
    assert response.status_code == 201, response.text
    return response.json()["account"]


def test_report_lifecycle_keeps_evidence_private_until_admin_publishes(tmp_path):
    db = tmp_path / "workspace.sqlite3"
    frames = {"synthetic-a": TINY_PNG, "synthetic-b": TINY_PNG}
    owner = make_client(workspace_db=db, prepared=FakeCatalog(),
                        science=FakeScience(synthetic_prepared(), images=frames))
    reviewer, admin, visitor = (TestClient(owner.app) for _ in range(3))
    author_account = register(owner, "Autora")
    reviewer_account = register(reviewer, "Revisora")
    admin_account = register(admin, "Publicador")
    with owner.app.state.workspace.connect(write=True) as conn:
        conn.execute("UPDATE accounts SET role = 'reviewer' WHERE id = ?", (reviewer_account["id"],))
        conn.execute("UPDATE accounts SET role = 'admin' WHERE id = ?", (admin_account["id"],))

    report_url = f"{PREFIX}/reports/{uuid4()}"
    pdf_url = f"{report_url}/attachment"
    fields = {
        "author": "Autora", "title": "Ficha sintética", "notes": "Evidencia de prueba", "format": "pdf",
        "revision": 0, "status": "draft", "frame_ids": list(frames),
        "annotations": {"synthetic-a": [{"type": "crop", "points": [[0.2, 0.3], [0.6, 0.5]]}]},
        "attachment": {"name": "observación.pdf", "content": base64.b64encode(PDF).decode()},
    }
    assert owner.put(report_url, headers=WRITE_HEADER, json=fields).status_code == 409
    comparison = owner.get("/api/v1/comparisons", params=PARAMS).json()
    saved = owner.put(report_url, headers=WRITE_HEADER, json=fields)
    assert saved.status_code == 200, saved.text
    report = saved.json()
    image_url = report["comparison"]["frames"][0]["src"]
    assert report["comparison"]["frames"][0]["source_url"] == comparison["frames"][0]["source_url"]
    assert report["annotations"] == fields["annotations"]
    assert owner.get(image_url).content == TINY_PNG
    for client in (reviewer, admin, visitor):
        assert client.get(report_url).status_code == 404
        assert client.get(image_url).status_code == 404
        assert client.get(pdf_url).status_code == 404
    assert reviewer.get(f"{PREFIX}/review").json() == []
    assert owner.get(f"{PREFIX}/review").status_code == 403

    fields.pop("attachment")
    fields.update(status="review", revision=report["revision"])
    submitted = owner.put(report_url, headers=WRITE_HEADER, json=fields).json()
    assert submitted["status"] == "review"
    assert owner.put(report_url, headers=WRITE_HEADER, json=fields).status_code == 409
    assert reviewer.get(image_url).content == TINY_PNG
    assert reviewer.get(pdf_url).content == PDF
    assert visitor.get(report_url).status_code == 404

    decision = {"action": "rejected", "revision": submitted["revision"]}
    assert reviewer.post(f"{report_url}/decision", headers=WRITE_HEADER, json=decision).status_code == 422
    decision["note"] = "Identifica el recorte."
    rejected = reviewer.post(f"{report_url}/decision", headers=WRITE_HEADER, json=decision).json()
    assert rejected["status"] == "rejected"
    assert owner.get(report_url).json()["reviewNote"] == decision["note"]
    fields.update(revision=rejected["revision"], notes="Recorte señalado en la época A.")
    resubmitted = owner.put(report_url, headers=WRITE_HEADER, json=fields).json()

    decision = {"action": "accepted", "revision": resubmitted["revision"], "note": "Evidencia lista."}
    assert owner.post(f"{report_url}/decision", headers=WRITE_HEADER, json=decision).status_code == 403
    accepted = reviewer.post(f"{report_url}/decision", headers=WRITE_HEADER, json=decision).json()
    assert accepted["status"] == "accepted"
    assert visitor.get(f"{PREFIX}/publications").json() == []
    decision = {"action": "published", "revision": accepted["revision"]}
    assert reviewer.post(f"{report_url}/decision", headers=WRITE_HEADER, json=decision).status_code == 403
    assert admin.post(f"{report_url}/decision", headers=WRITE_HEADER, json=decision).json()["status"] == "published"
    assert len(visitor.get(f"{PREFIX}/publications").json()) == 1
    assert visitor.get(report_url).json()["reviewNote"] == ""
    assert visitor.get(pdf_url).headers["content-disposition"].startswith("attachment;")

    restarted = make_client(workspace_db=db)
    assert restarted.get(image_url).content == TINY_PNG
    assert restarted.get(pdf_url).content == PDF
    profile_url = f"{PREFIX}/profiles/{author_account['id']}"
    assert restarted.get(profile_url).status_code == 404
    photo = "data:image/png;base64," + base64.b64encode(TINY_PNG).decode()
    assert owner.patch(f"{PREFIX}/profile", headers=WRITE_HEADER, json={
        "alias": "Autora", "public": True, "avatar": photo,
    }).is_success
    profile = restarted.get(profile_url).json()
    assert profile["profile"]["alias"] == "Autora" and "email" not in profile["profile"]
    assert profile["profile"]["avatar"].startswith("data:image/webp;base64,")
    assert len(profile["reports"]) == 1


def test_session_cookie_cannot_be_forged_or_reused_after_logout(tmp_path, monkeypatch):
    monkeypatch.setenv("PLANETX_WORKSPACE_SECURE_COOKIES", "1")
    base = make_client(workspace_db=tmp_path / "workspace.sqlite3")
    client = TestClient(base.app, base_url="https://planetx.test")
    register_url = f"{PREFIX}/register"
    fields = {"email": "visitante@example.test", "alias": "Visitante", "password": PASSWORD}
    origin = {"Origin": "https://planetx.test"}
    assert client.post(register_url, headers=origin, json=fields).status_code == 403
    assert client.post(register_url, headers={**origin, **WRITE_HEADER, "Sec-Fetch-Site": "cross-site"}, json=fields).status_code == 403
    assert client.post(register_url, headers={**WRITE_HEADER, "Origin": "http://planetx.test"}, json=fields).status_code == 403
    headers = {**origin, **WRITE_HEADER}
    assert client.post(register_url, headers=headers, json={**fields, "role": "admin"}).status_code == 422
    response = client.post(register_url, headers=headers, json=fields)
    assert response.status_code == 201, response.text
    assert response.json()["account"]["role"] == "collaborator"
    cookie = client.cookies.get("planetx_session")
    set_cookie = response.headers["set-cookie"].lower()
    assert all(flag in set_cookie for flag in ("httponly", "secure", "samesite=strict"))
    assert response.headers["cache-control"] == "no-store"
    assert client.post(f"{PREFIX}/logout", headers=headers).status_code == 204
    assert client.get(f"{PREFIX}/session", headers={"Cookie": f"planetx_session={cookie}"}).json() == {"account": None}
    login = {"email": fields["email"], "password": PASSWORD}
    assert client.post(f"{PREFIX}/login", headers=headers, json=login).status_code == 200
