"""Acceso a PNG derivados: solo por ID emitido, nunca por ruta o URL del cliente."""

from __future__ import annotations

import re
from collections import OrderedDict
from collections.abc import Mapping
from pathlib import Path
from typing import Protocol

FRAME_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z", re.ASCII)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_PNG_BYTES = 10 * 1024 * 1024


def is_valid_frame_id(frame_id: str) -> bool:
    return FRAME_ID_RE.match(frame_id) is not None


class ImageStore(Protocol):
    def get_png(self, frame_id: str) -> bytes | None: ...


class InMemoryImageStore:
    """PNG de secuencias en vivo, acotado para no crecer sin límite."""

    def __init__(self, max_items: int = 128) -> None:
        self._items: OrderedDict[str, bytes] = OrderedDict()
        self._max_items = max_items

    def put_many(self, images: Mapping[str, bytes]) -> None:
        for frame_id, data in images.items():
            if not is_valid_frame_id(frame_id) or not data.startswith(PNG_SIGNATURE):
                raise ValueError("imagen emitida con ID o bytes inválidos")
            self._items[frame_id] = data
            self._items.move_to_end(frame_id)
        while len(self._items) > self._max_items:
            self._items.popitem(last=False)

    def get_png(self, frame_id: str) -> bytes | None:
        return self._items.get(frame_id)


class DirectoryImageStore:
    """PNG preparados en ``<raíz>/<frame_id>.png`` (directorio local ignorado por Git)."""

    def __init__(self, root: Path) -> None:
        self._root = root.resolve()

    def get_png(self, frame_id: str) -> bytes | None:
        if not is_valid_frame_id(frame_id):
            return None
        try:
            path = (self._root / f"{frame_id}.png").resolve(strict=True)
            if not path.is_relative_to(self._root) or not path.is_file():
                return None
            if path.stat().st_size > MAX_PNG_BYTES:
                return None
            data = path.read_bytes()
        except OSError:
            return None
        return data if data.startswith(PNG_SIGNATURE) else None


class CompositeImageStore:
    def __init__(self, *stores: ImageStore) -> None:
        self._stores = stores

    def get_png(self, frame_id: str) -> bytes | None:
        for store in self._stores:
            data = store.get_png(frame_id)
            if data is not None:
                return data
        return None
