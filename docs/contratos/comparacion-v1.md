# Contrato de comparación v1

F01 define las respuestas que comparten la API, el visor y el catálogo de casos preparados. La sección 5 del [contexto general](../contexto/00_Contexto_General.md#5-contratos-para-que-los-módulos-puedan-trabajar-separados) recoge el acuerdo de partida.

## Rutas HTTP

| Petición | Respuesta |
| --- | --- |
| `GET /api/health` | `200` y `{"status":"ok"}` para comprobar el proceso. |
| `GET /api/v1/comparisons?ra_deg=10.25&dec_deg=-12.5` | `200 application/json` con el estado y los fotogramas disponibles. |
| `GET /api/v1/images/{frame_id}` | `200 image/png` para un ID de fotograma emitido por la API. |

La comparación requiere las dos coordenadas en grados decimales ICRS, con punto decimal y valores finitos. Los rangos son `0 ≤ ra_deg < 360` y `−90 ≤ dec_deg ≤ 90`. El navegador valida las coordenadas antes de enviar y la API vuelve a validarlas al recibirlas. El lado del campo cuadrado es de `0.1` grados. Todos los fotogramas usan ese mismo centro, campo, orientación y escala de contraste.

## Respuesta de comparación `200`

| Campo | Tipo y significado |
| --- | --- |
| `schema_version` | Cadena fija `"1"`. |
| `status` | `ready`, `insufficient` o `no_coverage`. |
| `reason` | Código de la tabla de estados o `null` en `ready`. |
| `mode` | `live` para consulta en vivo, `prepared` para un caso verificado, o `fixture` para desarrollo y pruebas. |
| `query` | Objeto con `ra_deg` y `dec_deg` numéricos, `frame: "ICRS"` y `fov_deg: 0.1`. |
| `band` | Objeto con `center_um` y `tolerance_um`, números finitos positivos en micrómetros. Si `frames` está vacío, el valor es `null`. |
| `checked_at` | Instante UTC de comprobación o preparación en ISO 8601 con sufijo `Z`. |
| `science_version` | Cadena no vacía que identifica la versión de los criterios de selección y renderizado. El módulo de ciencia de F01 emite `v1`. |
| `warnings` | Lista de códigos no bloqueantes. Usar `search_limit_reached` si se acotó la búsqueda y ya se obtuvo una secuencia válida. |
| `frames` | Lista de fotogramas por instante de observación ascendente. |
| `difference` | Producto opcional para un caso preparado de dos épocas. |

| Estado | Razón | Fotogramas y comportamiento |
| --- | --- | --- |
| `ready` | `null` | De 2 a 6 fotogramas de observaciones e instantes distintos, en una banda local comparable. Habilitar la comparación o reproducción. |
| `insufficient` | `single_epoch` | Un fotograma de la única época utilizable. Mostrarlo como imagen individual. |
| `insufficient` | `no_common_band` | Las observaciones utilizables no forman una secuencia en una banda común. Mostrar como máximo un fotograma. |
| `insufficient` | `no_usable_frames` | Se encontraron observaciones sin un fotograma utilizable. Lista vacía. |
| `insufficient` | `search_limit_reached` | La búsqueda se acotó antes de obtener una secuencia válida. Incluir un fotograma si se pudo validar y una lista vacía en los demás casos. |
| `no_coverage` | `no_observations` | La consulta espacial terminó sin observaciones en el ámbito consultado. Lista vacía. |

El modo `prepared` recupera el caso por coincidencia exacta de RA, Dec, campo y `science_version`. Conserva la fecha de preparación y la procedencia de cada fotograma. La interfaz indica «Caso preparado». El modo `fixture` se identifica como «Datos de prueba» y se usa exclusivamente en desarrollo y pruebas.

### Fotogramas

| Campo | Tipo y significado |
| --- | --- |
| `id` | Identificador opaco del PNG derivado. Su identidad incluye el recorte y la escala o versión de renderizado. Un ID siempre resuelve los mismos bytes. |
| `observed_at` | Instante UTC de la exposición en ISO 8601 con sufijo `Z`. |
| `release` | `dr1` o `qr3` en cada fotograma de modo `live` o `prepared`. Se admite `fixture` en modo `fixture`. |
| `observation_id` | Cadena con el identificador de la observación de origen. |
| `source_url` | Cadena con una URL HTTPS verificable del archivo o registro de IRSA en modos públicos. Se admite `null` en modo `fixture`. |
| `image_url` | Ruta del mismo origen `/api/v1/images/{frame_id}`. |
| `quality_flags` | Lista de avisos de calidad del fotograma. `masked_pixels` indica huecos transparentes por la máscara de comparación. Lista vacía cuando no haya avisos. |

### Imagen de diferencias

El mapa muestra brillo superficial de B menos A, en la misma rejilla y máscara común de las dos épocas. Está pensado para inspección visual. El ruido, el fondo, la respuesta espectral y las diferencias de resolución pueden aparecer como residuos.

| Campo de `difference` | Tipo y significado |
| --- | --- |
| `id` | Identificador del PNG de diferencias. |
| `frame_ids` | IDs de A y B en orden cronológico. Deben coincidir con los dos IDs de `frames`. |
| `image_url` | Ruta del mismo origen `/api/v1/images/{id}` para el producto. El catálogo la deriva del ID. |
| `scale_mjy_sr` | Magnitud en MJy/sr a la que se satura cada extremo de la escala de visualización. Finita y mayor o igual que cero. |
| `common_valid_fraction` | Fracción de píxeles de la rejilla válidos en ambas épocas. Entre 0.5 y 1. |

El catálogo omite `difference` cuando falta el PNG o sus metadatos no corresponden al par. El visor ofrece **Ver diferencias** cuando recibe ese campo. Los pasos para generarlo están en [Comparación científica de WISE 0855](../decisiones/comparacion-cientifica-wise0855.md).

## Errores

El cuerpo tiene la forma `{"error":{"code":"invalid_coordinates","message":"Revisa las coordenadas."}}`. `message` es texto público breve. El consumidor usa el código para decidir el estado de la interfaz.

| HTTP | Código | Cuándo se devuelve |
| --- | --- | --- |
| `422` | `invalid_coordinates` | Coordenada ausente, vacía, no numérica, no finita o fuera de rango. |
| `503` | `archive_unavailable` | El servicio de archivo impide completar la comparación. |
| `503` | `query_timeout` | Se agotó el plazo para terminar la comparación. |
| `404` | `image_not_found` | El ID de fotograma es inválido, desconocido o el PNG ya no está disponible. |
| `500` | `internal_error` | Fallo interno inesperado. El diagnóstico se registra en el servidor. |

El `503` permite reintentar. Ante un fallo externo, servir `200` en modo `prepared` si existe un respaldo real de la misma consulta.

Si `get_prepared()` devuelve `None`, la comparación sigue con la búsqueda en vivo cuando está habilitada. Reservar `no_coverage` para una búsqueda espacial completada sin observaciones. Un manifiesto corrupto o un PNG faltante al recuperar la comparación es un fallo interno. El `404 image_not_found` corresponde a la petición directa de un PNG.

## Ejemplos canónicos

| HTTP | Caso | Cuerpo JSON |
| --- | --- | --- |
| `200` | Dos épocas ordenadas | [comparacion-ready.json](../../web/src/contracts/fixtures/comparacion-ready.json) |
| `200` | Una época utilizable | [comparacion-insufficient.json](../../web/src/contracts/fixtures/comparacion-insufficient.json) |
| `200` | Consulta completada sin observaciones | [comparacion-no-coverage.json](../../web/src/contracts/fixtures/comparacion-no-coverage.json) |
| `503` | Servicio de archivo indisponible | [comparacion-error-503.json](../../web/src/contracts/fixtures/comparacion-error-503.json) |

Los JSON son cuerpos de respuesta. El stub o el interceptor de pruebas asigna el código HTTP y, si el recorrido necesita imágenes, devuelve PNG sintéticos en las rutas de los ejemplos.
