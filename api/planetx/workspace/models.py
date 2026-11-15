from __future__ import annotations

import base64
import binascii
import io
import re
from pathlib import PurePosixPath
from typing import Annotated, Literal

from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

from planetx.http.images import is_valid_frame_id

PDF_LIMIT = 10_000_000
MAX_BODY_BYTES = 14 * 1024 * 1024
Role = Literal["collaborator", "reviewer", "admin"]
Alias = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Password = Annotated[str, StringConstraints(min_length=15, max_length=128)]
Coordinate = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+", email):
        raise ValueError("Escribe una dirección de correo válida.")
    return email


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(Input):
    email: str = Field(max_length=254)
    password: Password

    _email_format = field_validator("email")(normalize_email)


class Registration(Login):
    alias: Alias


class Profile(Input):
    alias: Alias
    public: bool
    avatar: str | None = Field(default=None, max_length=1_333_366)

    def prepared_avatar(self) -> str | None:
        value = self.avatar
        if not value:
            return value
        prefix, _, content = value.partition(",")
        if prefix not in {"data:image/png;base64", "data:image/webp;base64", "data:image/jpeg;base64"}:
            raise ValueError("Elige una foto PNG, JPEG o WebP.")
        try:
            data = base64.b64decode(content, validate=True)
            with Image.open(io.BytesIO(data), formats=("PNG", "JPEG", "WEBP")) as photo:
                if len(data) > 1_000_000 or photo.width * photo.height > 16_000_000:
                    raise ValueError("La foto supera el tamaño permitido.")
                photo.thumbnail((192, 192))
                output = io.BytesIO()
                photo.convert("RGB").save(output, "WEBP", quality=85)
        except (binascii.Error, OSError, Image.DecompressionBombError) as exc:
            raise ValueError("No se pudo leer la foto.") from exc
        return "data:image/webp;base64," + base64.b64encode(output.getvalue()).decode("ascii")


class Mark(Input):
    type: Literal["draw", "crop"]
    points: list[tuple[Coordinate, Coordinate]] = Field(min_length=2, max_length=400)

    @model_validator(mode="after")
    def crop_corners(self) -> Mark:
        if self.type == "crop" and len(self.points) != 2:
            raise ValueError("Un recorte necesita dos esquinas.")
        return self


class Attachment(Input):
    name: str = Field(min_length=5, max_length=180)
    content: str = Field(max_length=4 * ((PDF_LIMIT + 2) // 3))

    def pdf(self) -> bytes:
        try:
            data = base64.b64decode(self.content, validate=True)
        except binascii.Error as exc:
            raise ValueError("No se pudo leer el PDF.") from exc
        if len(data) > PDF_LIMIT or not data.startswith(b"%PDF-"):
            raise ValueError("Adjunta un PDF válido de hasta 10 MB.")
        return data

    @field_validator("name")
    @classmethod
    def filename(cls, name: str) -> str:
        clean = PurePosixPath(name.replace("\\", "/")).name
        if not clean.lower().endswith(".pdf") or any(ord(char) < 32 for char in clean):
            raise ValueError("El documento debe tener extensión .pdf.")
        return clean


class ReportInput(Input):
    author: str = Field(min_length=1, max_length=60)
    title: str = Field(min_length=1, max_length=120)
    notes: str = Field(max_length=5000)
    format: Literal["manual", "pdf"]
    status: Literal["draft", "review"]
    revision: int = Field(ge=0)
    frame_ids: list[str] = Field(min_length=1, max_length=6)
    annotations: dict[str, Annotated[list[Mark], Field(max_length=30)]] = Field(max_length=6)
    attachment: Attachment | None = None

    @field_validator("author", "title", "notes", mode="before")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_evidence(self) -> ReportInput:
        if len(set(self.frame_ids)) != len(self.frame_ids) or not all(map(is_valid_frame_id, self.frame_ids)):
            raise ValueError("La ficha debe usar fotogramas distintos con identificadores válidos.")
        if not self.annotations.keys() <= set(self.frame_ids):
            raise ValueError("Las marcas deben pertenecer a los fotogramas de la ficha.")
        if self.format == "manual" and (not self.notes or self.attachment):
            raise ValueError("Escribe la descripción de la ficha.")
        return self


class Decision(Input):
    action: Literal["accepted", "rejected", "published"]
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1200)] = ""
    revision: int = Field(ge=1)


class WeeklyPick(Input):
    revision: int = Field(ge=1)
