"""Puente hacia ``planetx.catalog`` (DeValle) con importación diferida y mapeo de errores.

Mapeo acordado:
  - ``None``                     -> búsqueda en vivo (lo decide la ruta)
  - ``InvalidCatalogQueryError`` -> 422 invalid_coordinates
  - ``CatalogIntegrityError``    -> log + 500 internal_error (nunca ``no_coverage``)
"""

from __future__ import annotations

import importlib
import logging
from pathlib import Path
from types import ModuleType
from typing import Any

from planetx.http.errors import InternalError, InvalidCoordinates

logger = logging.getLogger("planetx.http")

CATALOG_MODULE = "planetx.catalog"


def load_catalog_module() -> ModuleType | None:
    """Importa ``planetx.catalog`` si existe. La API debe arrancar aunque no exista.

    Solo la ausencia del propio módulo se tolera; un fallo de importación *dentro* de un
    catálogo presente (dependencia rota, error de sintaxis) se propaga para verlo al arrancar.
    """
    try:
        return importlib.import_module(CATALOG_MODULE)
    except ModuleNotFoundError as exc:
        if exc.name == CATALOG_MODULE:
            return None
        raise


class CatalogAdapter:
    """Implementa ``PreparedCatalog`` sobre el módulo real, con rutas resueltas una sola vez."""

    def __init__(self, module: ModuleType, *, manifest_path: Path | None, products_dir: Path) -> None:
        self._module = module
        self._manifest_path = manifest_path
        self._products_dir = products_dir

    def get_prepared(
        self, *, ra_deg: float, dec_deg: float, fov_deg: float, science_version: str
    ) -> dict[str, Any] | None:
        module = self._module
        try:
            return module.get_prepared(
                ra_deg=ra_deg,
                dec_deg=dec_deg,
                fov_deg=fov_deg,
                science_version=science_version,
                # Rutas explícitas: catálogo e imágenes comparten una sola regla (ver factory).
                manifest_path=self._manifest_path,
                products_dir=self._products_dir,
            )
        except module.InvalidCatalogQueryError:
            raise InvalidCoordinates() from None
        except module.CatalogIntegrityError as exc:
            # El detalle (rutas, ids) va solo a logs internos; la respuesta es un 500 genérico.
            logger.error("catálogo preparado íntegro=NO tipo=%s detalle=%s", type(exc).__name__, exc)
            raise InternalError() from None
