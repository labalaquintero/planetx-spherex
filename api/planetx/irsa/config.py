"""Límites y constantes del adaptador IRSA."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

# api/planetx/irsa/config.py -> raíz del repositorio (no depende del cwd).
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CACHE_DIR = REPO_ROOT / "data" / "raw" / "irsa"  # /data/raw/ está ignorado por Git


@dataclass(frozen=True)
class IrsaConfig:
    # Endpoint leído del código de astroquery (conf.sia_url); la sonda lo confirmó (200 VOTable).
    sia_url: str = "https://irsa.ipac.caltech.edu/SIA"
    allowed_hosts: frozenset[str] = frozenset({"irsa.ipac.caltech.edu"})
    collections: tuple[str, ...] = ("spherex_dr1", "spherex_qr3")

    search_radius_deg: float = 0.05
    size_deg: float = 0.1  # lado del recorte (§2: campo fijo 0,10°)
    sia_maxrec: int = 2000  # medido: hasta 474 filas por colección en las muestras

    # Fotogramas (§4): máximo 6 y 8 intentos para sustituir 503 transitorios.
    max_frames: int = 6
    max_attempts: int = 8
    min_epoch_separation_days: float = 1.0

    # Plazos duros. El presupuesto debe quedar por debajo del de la ruta en vivo (25 s).
    budget_s: float = 22.0
    connect_timeout_s: float = 3.0
    read_timeout_s: float = 5.0  # entre chunks; el plazo total lo impone el deadline
    pool_timeout_s: float = 2.0
    retry_after_cap_s: float = 5.0  # medido: IRSA responde 503 con Retry-After: 5

    # Tamaños (medido: SIA2 ~0,56–1 MB; recorte 3,95–4,08 MB, 97 % en la extensión EPSF).
    max_sia_bytes: int = 8 * 1024 * 1024
    max_cutout_bytes: int = 8 * 1024 * 1024

    # Concurrencia saliente global hacia IRSA y paralelismo por búsqueda.
    outbound_concurrency: int = 4
    cutout_workers: int = 3

    # Extensiones que se conservan localmente. El servicio no permite pedir menos (la sonda
    # mostró que parámetros no documentados se ignoran): se descarta EPSF tras descargar.
    keep_extensions: tuple[str, ...] = ("IMAGE", "FLAGS", "VARIANCE", "ZODI", "WCS-WAVE")

    cache_dir: Path = DEFAULT_CACHE_DIR
    user_agent: str = "planetx-spherex/0.1"  # genérico: sin correo ni datos del equipo

    @property
    def min_edge_margin_deg(self) -> float:
        """Media diagonal del campo: con menos margen al borde el recorte sale truncado."""
        return self.size_deg * math.sqrt(2.0) / 2.0
