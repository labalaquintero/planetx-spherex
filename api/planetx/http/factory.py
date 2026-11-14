"""Fábrica de la aplicación FastAPI con servicios inyectables."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI

from planetx.http.errors import install_error_handlers
from planetx.http.images import CompositeImageStore, DirectoryImageStore, ImageStore, InMemoryImageStore
from planetx.http.routes import AppState, router
from planetx.http.services import (
    LiveGate,
    PreparedCatalog,
    ScienceService,
    UnconfiguredPreparedCatalog,
    UnconfiguredScience,
)

# api/planetx/http/factory.py -> raíz del repositorio (no depende del cwd).
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PRODUCTS_DIR = REPO_ROOT / "data" / "products"

PRODUCTS_DIR_ENV = "PLANETX_PRODUCTS_DIR"
LIVE_CONCURRENCY_ENV = "PLANETX_LIVE_CONCURRENCY"
DEFAULT_LIVE_CONCURRENCY = 2
DEFAULT_LIVE_TIMEOUT_S = 20.0


def resolve_products_dir(value: str | os.PathLike[str] | None = None) -> Path:
    """Directorio de PNG preparados. Una ruta relativa se interpreta desde la raíz del repo."""
    raw = value if value is not None else os.environ.get(PRODUCTS_DIR_ENV)
    if not raw:
        return DEFAULT_PRODUCTS_DIR
    path = Path(raw)
    return path if path.is_absolute() else REPO_ROOT / path


def _live_concurrency(value: int | None) -> int:
    if value is not None:
        return value
    raw = os.environ.get(LIVE_CONCURRENCY_ENV)
    if not raw:
        return DEFAULT_LIVE_CONCURRENCY
    try:
        return int(raw)
    except ValueError:
        raise ValueError(f"{LIVE_CONCURRENCY_ENV} debe ser un entero >= 1") from None


def create_app(
    *,
    prepared: PreparedCatalog | None = None,
    science: ScienceService | None = None,
    image_store: ImageStore | None = None,
    products_dir: str | os.PathLike[str] | None = None,
    live_timeout_s: float = DEFAULT_LIVE_TIMEOUT_S,
    live_concurrency: int | None = None,
    allow_fixtures: bool = False,
) -> FastAPI:
    """Crea la API. Sin argumentos usa stubs: nada de fixtures como producto público.

    ``allow_fixtures`` solo existe para dev/pruebas; con False un payload con
    ``mode: "fixture"`` se rechaza como error interno.
    """
    live_images = InMemoryImageStore()
    disk_store = image_store if image_store is not None else DirectoryImageStore(resolve_products_dir(products_dir))

    app = FastAPI(title="Planet X / SPHEREx")
    app.state.planetx = AppState(
        prepared=prepared or UnconfiguredPreparedCatalog(),
        science=science or UnconfiguredScience(),
        gate=LiveGate(_live_concurrency(live_concurrency)),
        live_timeout_s=live_timeout_s,
        allow_fixtures=allow_fixtures,
        live_images=live_images,
        image_store=CompositeImageStore(live_images, disk_store),
    )
    install_error_handlers(app)
    app.include_router(router)
    return app
