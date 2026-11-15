class CatalogError(Exception):
    """Error base del catálogo de casos preparados de Planet X."""


class InvalidCatalogQueryError(CatalogError, ValueError):
    """Se lanza cuando las coordenadas, el campo o la versión son inválidos."""


class CatalogIntegrityError(CatalogError):
    """Se lanza cuando el manifiesto preparado o sus productos PNG están corruptos o incompletos."""


class ManifestNotFoundError(CatalogIntegrityError):
    """Se lanza cuando el archivo de manifiesto configurado no existe."""


class ManifestCorruptError(CatalogIntegrityError):
    """Se lanza cuando el manifiesto tiene JSON inválido, duplicados, orden roto o esquema inválido."""


class MissingProductError(CatalogIntegrityError):
    """Se lanza cuando falta un PNG derivado referenciado por un fotograma del manifiesto."""