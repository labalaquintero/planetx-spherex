"""Errores del adaptador IRSA. Ninguno equivale a «sin cobertura»."""

from __future__ import annotations


class IrsaError(Exception):
    """Base. Los mensajes no incluyen URLs completas ni rutas locales."""


class IrsaTimeout(IrsaError):
    """Se agotó el plazo (conexión, lectura o presupuesto total). Reintentable."""


class IrsaUnavailable(IrsaError):
    """IRSA falló o respondió algo inutilizable (5xx, 503, formato). Reintentable."""


class IrsaRejected(IrsaError):
    """Un recurso concreto no es aceptable (URL no permitida, demasiado grande, no es FITS).

    No indica caída del servicio: el candidato se descarta.
    """


class InvalidFits(IrsaRejected):
    """El cuerpo no es un FITS bien formado."""
