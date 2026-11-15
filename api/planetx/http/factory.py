"""Fábrica de la aplicación FastAPI con servicios inyectables."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI

from planetx.http.catalog_adapter import CatalogAdapter, load_catalog_module
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

logger = logging.getLogger("planetx.http")

# api/planetx/http/factory.py -> raíz del repositorio (no depende del cwd).
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PRODUCTS_DIR = REPO_ROOT / "data" / "products"

PRODUCTS_DIR_ENV = "PLANETX_PRODUCTS_DIR"
CATALOG_MANIFEST_ENV = "PLANETX_CATALOG_MANIFEST"
LIVE_CONCURRENCY_ENV = "PLANETX_LIVE_CONCURRENCY"
DEFAULT_LIVE_CONCURRENCY = 2
# Plazo total de la ruta en vivo. CloudFront corta a los 30 s por defecto hacia el origen; el
# adaptador IRSA usa ~22 s de presupuesto para terminar antes que la ruta.
DEFAULT_LIVE_TIMEOUT_S = 25.0


def _from_repo_root(raw: str | os.PathLike[str]) -> Path:
    path = Path(raw)
    return path if path.is_absolute() else REPO_ROOT / path


def resolve_catalog_manifest(value: str | os.PathLike[str] | None = None) -> Path | None:
    """Manifiesto del catálogo preparado (``PLANETX_CATALOG_MANIFEST``); relativo => raíz del repo."""
    raw = value if value is not None else os.environ.get(CATALOG_MANIFEST_ENV)
    return _from_repo_root(raw) if raw else None


def resolve_products_dir(
    value: str | os.PathLike[str] | None = None, *, manifest: Path | None = None
) -> Path:
    """Directorio de PNG. UNA regla para catálogo e ``/api/v1/images``:

    1. ``PLANETX_PRODUCTS_DIR`` (o el argumento), siempre que esté definido. Relativo => raíz del repo.
    2. Si hay manifiesto y no hay (1): ``<carpeta del manifiesto>/products`` (el default de
       ``planetx.catalog``), de modo que ambos lean el mismo sitio. ``create_app`` avisa en el log.
    3. Sin manifiesto: ``<repo>/data/products``.
    """
    raw = value if value is not None else os.environ.get(PRODUCTS_DIR_ENV)
    if raw:
        return _from_repo_root(raw)
    if manifest is not None:
        return manifest.parent / "products"
    return DEFAULT_PRODUCTS_DIR


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
    catalog_manifest: str | os.PathLike[str] | None = None,
    live_timeout_s: float = DEFAULT_LIVE_TIMEOUT_S,
    live_concurrency: int | None = None,
    allow_fixtures: bool = False,
) -> FastAPI:
    """Crea la API. Sin argumentos usa el catálogo real si existe y stubs para el resto.

    ``allow_fixtures`` solo existe para dev/pruebas; con False un payload con
    ``mode: "fixture"`` se rechaza como error interno.
    """
    manifest = resolve_catalog_manifest(catalog_manifest)
    products = resolve_products_dir(products_dir, manifest=manifest)
    if manifest is not None and products_dir is None and not os.environ.get(PRODUCTS_DIR_ENV):
        logger.warning(
            "%s no está definido junto con %s: se usa %s. Defínelo explícitamente.",
            PRODUCTS_DIR_ENV, CATALOG_MANIFEST_ENV, products,
        )

    if prepared is None:
        catalog = load_catalog_module()
        if catalog is not None:
            prepared = CatalogAdapter(catalog, manifest_path=manifest, products_dir=products)
        else:
            if manifest is not None:
                logger.warning("%s está definido pero planetx.catalog no existe: sin casos preparados.", CATALOG_MANIFEST_ENV)
            prepared = UnconfiguredPreparedCatalog()

    live_images = InMemoryImageStore()
    disk_store = image_store if image_store is not None else DirectoryImageStore(products)

    app = FastAPI(title="Planet X / SPHEREx")
    app.state.planetx = AppState(
        prepared=prepared,
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
