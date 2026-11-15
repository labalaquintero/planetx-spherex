from __future__ import annotations

import json
import secrets
import sqlite3
from typing import Annotated, Any
from urllib.parse import quote, urlsplit
from uuid import UUID, uuid4

from fastapi import APIRouter, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute

from planetx.http.errors import ApiError
from planetx.workspace.models import MAX_BODY_BYTES, Decision, Login, Profile, Registration, ReportInput
from planetx.workspace.store import (
    EDITABLE_STATES, REVIEW_ROLES, SESSION_SECONDS, Workspace, account_data,
    is_owner, may_view_private, password_hash, password_matches, report_data, token_hash, utc_now,
)

COOKIE = "planetx_session"
COOKIE_PATH = "/api/v1/workspace"
NO_STORE = {"Cache-Control": "no-store"}


class WorkspaceError(ApiError):
    def __init__(self, status: int, code: str, message: str, **headers: str):
        self.status_code = status
        self.code = code
        super().__init__(message, headers={**NO_STORE, **headers})


class WorkspaceRoute(APIRoute):
    def get_route_handler(self):
        route_handler = super().get_route_handler()

        async def handler(request: Request) -> Response:
            if request.method in {"POST", "PUT", "PATCH"}:
                origin = request.headers.get("origin", "")
                # A cross-origin browser cannot set this header without a CORS preflight.
                if (request.headers.get("x-planetx-workspace") != "1"
                        or request.headers.get("sec-fetch-site") in {"cross-site", "same-site"}):
                    raise WorkspaceError(403, "invalid_origin", "Abre la cuenta desde el sitio de Planet X.")
                if _workspace(request).secure and urlsplit(origin).scheme != "https":
                    raise WorkspaceError(403, "https_required", "Abre Planet X mediante HTTPS para usar tu cuenta.")
                payload = bytearray()
                async for chunk in request.stream():
                    if len(payload) + len(chunk) > MAX_BODY_BYTES:
                        raise WorkspaceError(413, "body_too_large", "La ficha supera el tamaño permitido.")
                    payload.extend(chunk)

                async def receive():
                    return {"type": "http.request", "body": bytes(payload), "more_body": False}

                request = Request(request.scope, receive=receive)
            try:
                response = await route_handler(request)
            except RequestValidationError as exc:
                raise WorkspaceError(422, "invalid_workspace_input", "Revisa los campos y el tamaño del archivo adjunto.") from exc
            response.headers.update(NO_STORE)
            return response

        return handler


router = APIRouter(prefix=COOKIE_PATH, tags=["workspace"], route_class=WorkspaceRoute)


def _workspace(request: Request) -> Workspace:
    return request.app.state.workspace


def _actor(request: Request, *, required: bool = False) -> sqlite3.Row | None:
    actor = _workspace(request).authorize(request.cookies.get(COOKIE))
    if required and actor is None:
        raise WorkspaceError(401, "sign_in_required", "Inicia sesión para continuar.")
    return actor


def _reviewer(request: Request) -> sqlite3.Row:
    actor = _actor(request, required=True)
    if actor["role"] not in REVIEW_ROLES:
        raise WorkspaceError(403, "review_forbidden", "Tu cuenta no tiene permisos de revisión.")
    return actor


def _set_session(response: Response, workspace: Workspace, token: str) -> None:
    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, httponly=True, secure=workspace.secure,
                        samesite="strict", path=COOKIE_PATH)


def _throttled() -> WorkspaceError:
    return WorkspaceError(429, "auth_busy", "Espera un momento antes de volver a intentarlo.", **{"Retry-After": "60"})


@router.get("/session")
def session(request: Request) -> dict:
    actor = _actor(request)
    return {"account": account_data(actor) if actor else None}


@router.post("/register", status_code=201)
def register(fields: Registration, request: Request, response: Response) -> dict:
    workspace = _workspace(request)
    with workspace.try_authentication(fields.email) as allowed:
        if not allowed:
            raise _throttled()
        salt = secrets.token_bytes(16)
        digest = password_hash(fields.password, salt)
    with workspace.connect(write=True) as db:
        if db.execute("SELECT id FROM accounts WHERE email = ?", (fields.email,)).fetchone():
            raise WorkspaceError(409, "email_in_use", "Este correo ya tiene una cuenta. Inicia sesión.")
        account_id = str(uuid4())
        account = db.execute("""INSERT INTO accounts (id, email, alias, salt, password_hash)
            VALUES (?, ?, ?, ?, ?) RETURNING *""", (account_id, fields.email, fields.alias, salt, digest)).fetchone()
        token = workspace.new_session(db, account_id, request.cookies.get(COOKIE))
    _set_session(response, workspace, token)
    return {"account": account_data(account)}


@router.post("/login")
def login(fields: Login, request: Request, response: Response) -> dict:
    workspace = _workspace(request)
    with workspace.try_authentication(fields.email) as allowed:
        if not allowed:
            raise _throttled()
        with workspace.connect() as db:
            account = db.execute("SELECT * FROM accounts WHERE email = ?", (fields.email,)).fetchone()
        if not password_matches(fields.password, account):
            raise WorkspaceError(401, "invalid_credentials", "El correo o la contraseña no coinciden.")
    with workspace.connect(write=True) as db:
        current = db.execute("SELECT * FROM accounts WHERE id = ?", (account["id"],)).fetchone()
        if current is None or current["password_hash"] != account["password_hash"]:
            raise WorkspaceError(401, "invalid_credentials", "El correo o la contraseña no coinciden.")
        token = workspace.new_session(db, account["id"], request.cookies.get(COOKIE))
    _set_session(response, workspace, token)
    return {"account": account_data(current)}


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response) -> None:
    workspace = _workspace(request)
    token = request.cookies.get(COOKIE)
    if token:
        with workspace.connect(write=True) as db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
    response.delete_cookie(COOKIE, path=COOKIE_PATH, secure=workspace.secure, httponly=True, samesite="strict")


@router.patch("/profile")
def update_profile(fields: Profile, request: Request) -> dict:
    actor = _actor(request, required=True)
    try:
        avatar = fields.prepared_avatar()
    except ValueError as exc:
        raise WorkspaceError(422, "invalid_avatar", str(exc)) from exc
    with _workspace(request).connect(write=True) as db:
        account = db.execute("""UPDATE accounts SET alias = ?, public = ?, avatar = COALESCE(?, avatar)
            WHERE id = ? RETURNING *""", (fields.alias, fields.public, avatar, actor["id"])).fetchone()
    return {"account": account_data(account)}


def _summary(report: sqlite3.Row, *, private: bool = False) -> dict[str, Any]:
    result = {key: report[key] for key in ("id", "title", "author", "created", "status")}
    result["publishedAt"] = report["published_at"]
    if private:
        result.update(format=report["format"], reviewNote=report["review_note"], shared=True)
    return result


@router.get("/profiles/{account_id}")
def public_profile(account_id: UUID, request: Request) -> dict:
    with _workspace(request).connect() as db:
        account = db.execute("SELECT id, alias, avatar FROM accounts WHERE id = ? AND public = 1", (str(account_id),)).fetchone()
        if account is None:
            raise _not_found()
        reports = db.execute("""SELECT * FROM reports WHERE owner_id = ? AND status = 'published'
            ORDER BY published_at DESC, id DESC""", (str(account_id),)).fetchall()
    return {"profile": dict(account), "reports": [_summary(report) for report in reports]}


@router.get("/publications")
def publications(request: Request, offset: Annotated[int, Query(ge=0, le=30_000_000)] = 0) -> list[dict]:
    with _workspace(request).connect() as db:
        reports = db.execute("SELECT * FROM reports WHERE status = 'published' ORDER BY published_at DESC, id DESC LIMIT 30 OFFSET ?",
                             (offset,)).fetchall()
    return [_summary(report) for report in reports]


@router.get("/reports")
def my_reports(request: Request) -> list[dict]:
    actor = _actor(request, required=True)
    with _workspace(request).connect() as db:
        reports = db.execute("SELECT * FROM reports WHERE owner_id = ? ORDER BY updated DESC", (actor["id"],)).fetchall()
    return [_summary(report, private=True) for report in reports]


@router.get("/review")
def review_queue(request: Request) -> list[dict]:
    _reviewer(request)
    with _workspace(request).connect() as db:
        reports = db.execute("""SELECT * FROM reports WHERE status != 'draft'
            ORDER BY CASE status WHEN 'review' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, updated DESC""").fetchall()
    return [_summary(report, private=True) for report in reports]


def _not_found() -> WorkspaceError:
    return WorkspaceError(404, "workspace_not_found", "No encontramos esta ficha o perfil.")


def _conflict(message: str = "La ficha cambió. Vuelve a abrirla antes de guardar.") -> WorkspaceError:
    return WorkspaceError(409, "report_conflict", message)


def _read_report(db: sqlite3.Connection, report_id: UUID, actor: sqlite3.Row | None) -> sqlite3.Row:
    report = db.execute("SELECT * FROM reports WHERE id = ?", (str(report_id),)).fetchone()
    if report is None or (report["status"] != "published" and not may_view_private(report, actor)):
        raise _not_found()
    return report


@router.get("/reports/{report_id}")
def get_report(report_id: UUID, request: Request) -> dict:
    actor = _actor(request)
    with _workspace(request).connect() as db:
        return report_data(_read_report(db, report_id, actor), actor)


@router.put("/reports/{report_id}")
def save_report(report_id: UUID, fields: ReportInput, request: Request) -> dict:
    actor = _actor(request, required=True)
    workspace = _workspace(request)
    pdf = None
    if fields.attachment:
        try:
            pdf = fields.attachment.pdf()
        except ValueError as exc:
            raise WorkspaceError(422, "invalid_pdf", str(exc)) from exc
    report_key = str(report_id)
    now = utc_now()
    annotations = json.dumps({key: [mark.model_dump() for mark in marks] for key, marks in fields.annotations.items()})
    with workspace.connect(write=True) as db:
        report = db.execute("SELECT * FROM reports WHERE id = ?", (report_key,)).fetchone()
        if report is not None:
            if not is_owner(report, actor):
                raise _not_found()
            if fields.revision != report["revision"] or report["status"] not in EDITABLE_STATES:
                raise _conflict()
            comparison = json.loads(report["comparison"])
            if fields.frame_ids != [frame["id"] for frame in comparison["frames"]]:
                raise _conflict("Abre una ficha nueva para usar observaciones diferentes.")
        elif fields.revision != 0:
            raise _not_found()

        filename = fields.attachment.name if fields.attachment else (report["filename"] if report else "")
        if fields.format == "pdf" and not filename:
            raise WorkspaceError(422, "pdf_required", "Adjunta el PDF antes de guardar.")
        if fields.format == "manual":
            filename = ""
        values = (now, fields.status, fields.author, fields.title, fields.notes, fields.format, annotations, filename)
        if report is None:
            capture = workspace.capture(report_key, tuple(fields.frame_ids), request.app.state.planetx.image_store)
            if capture is None:
                raise _conflict("Vuelve a abrir la comparación en el visor para guardar sus imágenes con la ficha.")
            comparison, images = capture
            report = db.execute("""INSERT INTO reports (id, owner_id, created, revision, comparison, updated,
                status, author, title, notes, format, annotations, filename)
                VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *""",
                (report_key, actor["id"], now, json.dumps(comparison), *values)).fetchone()
            db.executemany("INSERT INTO evidence_images VALUES (?, ?, ?)", ((report_key, frame_id, png) for frame_id, png in images))
        else:
            report = db.execute("""UPDATE reports SET updated = ?, status = ?, author = ?, title = ?, notes = ?, format = ?,
                annotations = ?, filename = ?, revision = revision + 1, review_note = '', reviewed_by = NULL
                WHERE id = ? RETURNING *""", (*values, report_key)).fetchone()
        if pdf:
            db.execute("INSERT OR REPLACE INTO attachments VALUES (?, ?)", (report_key, pdf))
        elif not filename:
            db.execute("DELETE FROM attachments WHERE report_id = ?", (report_key,))
    return report_data(report, actor)


@router.post("/reports/{report_id}/decision")
def decide(report_id: UUID, fields: Decision, request: Request) -> dict:
    actor = _reviewer(request)
    action = fields.action
    if action == "published" and actor["role"] != "admin":
        raise WorkspaceError(403, "publish_forbidden", "Solo un administrador puede publicar la ficha.")
    if action == "rejected" and not fields.note:
        raise WorkspaceError(422, "review_note_required", "Escribe un motivo para que el autor pueda corregir la ficha.")
    now = utc_now()
    with _workspace(request).connect(write=True) as db:
        report = _read_report(db, report_id, actor)
        if is_owner(report, actor) and action != "published":
            raise WorkspaceError(403, "self_review", "Otra persona debe revisar tu ficha.")
        expected = "accepted" if action == "published" else "review"
        if report["revision"] != fields.revision or report["status"] != expected:
            raise _conflict()
        if action == "published":
            updated = db.execute("""UPDATE reports SET status = 'published', updated = ?, published_at = ?,
                published_by = ?, revision = revision + 1 WHERE id = ? RETURNING *""",
                (now, now, actor["id"], str(report_id))).fetchone()
        else:
            updated = db.execute("""UPDATE reports SET status = ?, updated = ?, review_note = ?, reviewed_by = ?,
                revision = revision + 1 WHERE id = ? RETURNING *""",
                (action, now, fields.note, actor["id"], str(report_id))).fetchone()
    return report_data(updated, actor)


@router.get("/reports/{report_id}/images/{frame_id}")
def evidence_image(report_id: UUID, frame_id: str, request: Request) -> Response:
    actor = _actor(request)
    with _workspace(request).connect() as db:
        _read_report(db, report_id, actor)
        image = db.execute("SELECT png FROM evidence_images WHERE report_id = ? AND frame_id = ?",
                           (str(report_id), frame_id)).fetchone()
    if image is None:
        raise _not_found()
    return Response(image["png"], media_type="image/png", headers={"X-Content-Type-Options": "nosniff"})


@router.get("/reports/{report_id}/attachment")
def download_attachment(report_id: UUID, request: Request) -> Response:
    actor = _actor(request)
    with _workspace(request).connect() as db:
        report = _read_report(db, report_id, actor)
        attachment = db.execute("SELECT content FROM attachments WHERE report_id = ?", (str(report_id),)).fetchone()
    if attachment is None:
        raise _not_found()
    filename = quote(report["filename"], safe="")
    return Response(attachment["content"], media_type="application/octet-stream", headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
        "X-Content-Type-Options": "nosniff",
    })
