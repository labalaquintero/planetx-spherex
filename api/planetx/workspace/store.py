from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import threading
import time
from collections import OrderedDict
from collections.abc import Iterator
from contextlib import closing, contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from planetx.http.images import ImageStore, PNG_SIGNATURE, is_valid_frame_id

SESSION_SECONDS = 7 * 24 * 60 * 60
REVIEW_ROLES = {"reviewer", "admin"}
EDITABLE_STATES = {"draft", "rejected"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    alias TEXT NOT NULL,
    salt BLOB NOT NULL,
    password_hash BLOB NOT NULL,
    role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN ('collaborator', 'reviewer', 'admin')),
    public INTEGER NOT NULL DEFAULT 0,
    avatar TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash BLOB PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES accounts(id),
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    revision INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'accepted', 'rejected', 'published')),
    author TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT NOT NULL,
    format TEXT NOT NULL,
    comparison TEXT NOT NULL,
    annotations TEXT NOT NULL,
    review_note TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT REFERENCES accounts(id),
    published_at TEXT,
    published_by TEXT REFERENCES accounts(id),
    filename TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS reports_owner ON reports(owner_id, updated);
CREATE INDEX IF NOT EXISTS reports_status ON reports(status, updated);
CREATE TABLE IF NOT EXISTS attachments (
    report_id TEXT PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
    content BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_picks (
    week TEXT PRIMARY KEY,
    report_id TEXT NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    chosen_by TEXT NOT NULL REFERENCES accounts(id),
    chosen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence_images (
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    frame_id TEXT NOT NULL,
    png BLOB NOT NULL,
    PRIMARY KEY (report_id, frame_id)
);
"""


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def iso_week(moment: datetime | None = None) -> str:
    """Semana ISO 8601 en UTC, p. ej. «2026-W46»: la clave de la ficha de la semana."""
    year, week, _ = (moment or datetime.now(UTC)).isocalendar()
    return f"{year}-W{week:02d}"


# Columnas de las fichas con la semana en que fueron ficha de la semana (o NULL).
REPORTS_WITH_WEEK = "reports.*, (SELECT week FROM weekly_picks WHERE report_id = reports.id) AS weekly_pick"


def weekly_pick(report: sqlite3.Row) -> str | None:
    return report["weekly_pick"] if "weekly_pick" in report.keys() else None


def contribution_stats(db: sqlite3.Connection, account_id: str) -> dict[str, Any]:
    """Datos de las insignias: fichas que pasaron la revisión (aceptadas o publicadas) y fichas de la semana."""
    contributions = db.execute(
        "SELECT COUNT(*) FROM reports WHERE owner_id = ? AND status IN ('accepted', 'published')", (account_id,),
    ).fetchone()[0]
    weeks = db.execute("""SELECT week FROM weekly_picks JOIN reports ON reports.id = report_id
        WHERE owner_id = ? ORDER BY week DESC""", (account_id,)).fetchall()
    return {"contributions": contributions, "weeklyPicks": [row["week"] for row in weeks]}


def password_hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024**2)


def password_matches(password: str, account: sqlite3.Row | None) -> bool:
    salt = account["salt"] if account else bytes(16)
    expected = account["password_hash"] if account else bytes(64)
    return hmac.compare_digest(password_hash(password, salt), expected) and account is not None


def token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def account_data(account: sqlite3.Row) -> dict[str, Any]:
    return {**{key: account[key] for key in ("id", "email", "alias", "role", "avatar")},
            "public": bool(account["public"])}


def is_owner(report: sqlite3.Row, account: sqlite3.Row | None) -> bool:
    return account is not None and report["owner_id"] == account["id"]


def may_view_private(report: sqlite3.Row, account: sqlite3.Row | None) -> bool:
    return is_owner(report, account) or (
        account is not None and account["role"] in REVIEW_ROLES and report["status"] != "draft"
    )


def report_data(report: sqlite3.Row, account: sqlite3.Row | None) -> dict[str, Any]:
    public = {key: report[key] for key in ("id", "created", "status", "author", "title", "notes", "format")}
    return {
        **public,
        "comparison": json.loads(report["comparison"]),
        "annotations": json.loads(report["annotations"]),
        "fileName": report["filename"],
        "hasPdf": bool(report["filename"]),
        "shared": True,
        "mine": is_owner(report, account),
        "revision": report["revision"],
        "reviewNote": report["review_note"] if may_view_private(report, account) else "",
        "publishedAt": report["published_at"],
        "weeklyPick": weekly_pick(report),
    }


class Workspace:
    def __init__(self, path: Path, *, secure: bool = False) -> None:
        self.path = path
        self.secure = secure
        self._lock = threading.Lock()
        self._ready: OrderedDict[tuple[str, ...], dict[str, Any]] = OrderedDict()
        self._auth_slots = threading.BoundedSemaphore(2)
        self._attempts: OrderedDict[str, tuple[float, int]] = OrderedDict()
        self._initialized = False

    def initialize(self) -> None:
        with self._lock:
            if self._initialized:
                return
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with closing(sqlite3.connect(self.path)) as db:
                db.execute("PRAGMA journal_mode = WAL")
                db.executescript(SCHEMA)
            self._initialized = True

    @contextmanager
    def connect(self, *, write: bool = False) -> Iterator[sqlite3.Connection]:
        self.initialize()
        with closing(sqlite3.connect(self.path, timeout=5)) as db, db:
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys = ON")
            db.execute("BEGIN IMMEDIATE" if write else "BEGIN")
            yield db

    def authorize(self, token: str | None) -> sqlite3.Row | None:
        if not token or len(token) != 43:
            return None
        with self.connect() as db:
            return db.execute("""SELECT accounts.* FROM sessions JOIN accounts ON id = account_id
                WHERE token_hash = ? AND expires > ?""", (token_hash(token), int(time.time()))).fetchone()

    def new_session(self, db: sqlite3.Connection, account_id: str, prior: str | None) -> str:
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        db.execute("DELETE FROM sessions WHERE expires <= ?", (now,))
        if prior:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(prior),))
        db.execute("INSERT INTO sessions VALUES (?, ?, ?)", (token_hash(token), account_id, now + SESSION_SECONDS))
        return token

    @contextmanager
    def try_authentication(self, key: str) -> Iterator[bool]:
        now = time.monotonic()
        with self._lock:
            until, count = self._attempts.get(key, (0, 0))
            accepted = (now >= until or count < 10) and self._auth_slots.acquire(blocking=False)
            if accepted:
                self._attempts[key] = (now + 60, 1) if now >= until else (until, count + 1)
                self._attempts.move_to_end(key)
                if len(self._attempts) > 2048:
                    self._attempts.popitem(last=False)
        try:
            yield accepted
        finally:
            if accepted:
                self._auth_slots.release()

    def remember_comparison(self, payload: dict[str, Any]) -> None:
        if payload.get("mode") not in {"live", "prepared"} or payload.get("status") not in {"ready", "insufficient"}:
            return
        frames = payload.get("frames", [])
        ids = tuple(frame.get("id") for frame in frames)
        if not ids or not all(isinstance(item, str) and is_valid_frame_id(item) for item in ids):
            return
        with self._lock:
            self._ready[ids] = payload
            self._ready.move_to_end(ids)
            if len(self._ready) > 256:
                self._ready.popitem(last=False)

    def capture(self, report_id: str, ids: tuple[str, ...], images: ImageStore) -> tuple[dict, list[tuple[str, bytes]]] | None:
        with self._lock:
            payload = self._ready.get(ids)
        if payload is None:
            return None
        snapshot = {key: payload.get(key) for key in (
            "query", "band", "checked_at", "science_version", "mode", "status", "reason", "warnings",
        )}
        snapshot["frames"] = []
        files = []
        for frame in payload["frames"]:
            frame_id = frame["id"]
            png = images.get_png(frame_id)
            if not png or not png.startswith(PNG_SIGNATURE):
                return None
            files.append((frame_id, png))
            url = f"/api/v1/workspace/reports/{report_id}/images/{frame_id}"
            snapshot["frames"].append({**frame, "src": url, "image_url": url})
        return snapshot, files
