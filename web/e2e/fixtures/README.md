# Fixtures de aceptación

Hay dos tipos. Ninguno es una respuesta real de SPHEREx/IRSA ni prueba nada sobre datos reales.

## 1. Canónicos de Alexis (se usan directamente)

Los specs leen **tal cual**, sin copiarlos ni editarlos, los cuatro JSON de `web/src/contracts/fixtures/` (contrato [`docs/contratos/comparacion-v1.md`](../../../docs/contratos/comparacion-v1.md)). `support.ts` los carga con `loadFixture("comparacion-…")`. Sus IDs llevan el prefijo `fixture-` (`fixture-a`, `fixture-obs-a`…), `mode: "fixture"`, `release: "fixture"` y `source_url: null`.

| Canónico | HTTP | Estado / código | Casos |
| --- | --- | --- | --- |
| `comparacion-ready.json` | 200 | `ready`, 2 fotogramas | C01, C16–C19 |
| `comparacion-insufficient.json` | 200 | `insufficient` / `single_epoch`, 1 fotograma | C03 |
| `comparacion-no-coverage.json` | 200 | `no_coverage` / `no_observations` | C07 |
| `comparacion-error-503.json` | 503 | `archive_unavailable` | C12 |

## 2. Sintéticos míos (`sintetico-*`): sólo lo que los canónicos no cubren

**Son SINTÉTICOS y PROVISIONALES.** Siguen el contrato v1 y llevan el prefijo `sintetico-` en archivo, IDs de fotograma y de observación, para no confundirse con datos reales ni reciclar IDs con otros bytes. Si Alexis publica un canónico para alguno de estos casos, se sustituye por el suyo y se borra el mío. Los de error contienen sólo el cuerpo `{"error":{"code","message"}}`; el código HTTP lo pone el spec.

| Archivo | HTTP | Estado / código | Casos |
| --- | --- | --- | --- |
| `sintetico-ready-6.json` | 200 | `ready`, 6 fotogramas | C02 |
| `sintetico-ready-search-limit-warning.json` | 200 | `ready` + warning `search_limit_reached` | C21 |
| `sintetico-prepared.json` | 200 | `ready`, `mode: prepared`, `release: dr1`, `source_url` `.invalid` | C08 |
| `sintetico-insufficient-no-common-band.json` | 200 | `insufficient` / `no_common_band`, `frames: []`, `band: null` | C04 |
| `sintetico-insufficient-no-usable-frames.json` | 200 | `insufficient` / `no_usable_frames` | C05 |
| `sintetico-insufficient-search-limit-reached-0-frames.json` | 200 | `insufficient` / `search_limit_reached`, `frames: []`, `band: null` | C06 |
| `sintetico-insufficient-search-limit-reached-1-frame.json` | 200 | `insufficient` / `search_limit_reached`, 1 fotograma, `band` con valor | C20 |
| `sintetico-error-422.json` | 422 | `invalid_coordinates` | C09–C11 (sólo para detectar que la UI **no** envía la petición) |
| `sintetico-error-503-query-timeout.json` | 503 | `query_timeout` | C13 |
| `sintetico-error-500.json` | 500 | `internal_error` | C14 |
| `sintetico-error-404-image.json` | 404 | `image_not_found` | C15 |

Se borraron los sintéticos `ready-2`, `insufficient-single-epoch`, `no-coverage` y `error-503-archive-unavailable` porque los canónicos los cubren. Comparados con los canónicos eran idénticos salvo los IDs (`sintetico-*` frente a `fixture-*`) y, en el 503, el texto de `message`.

## Reglas del contrato que cumplen (comprobadas por script al comparar)

`schema_version "1"`, `science_version "v1"`, `query.frame "ICRS"` y `fov_deg 0.1`; `band` es `null` si y sólo si `frames` está vacío y, si no, tiene valores positivos; `observed_at` ascendente, distintos y en UTC con `Z`; `image_url` = `/api/v1/images/{id}`; `observation_id` distintos; `ready` tiene de 2 a 6 fotogramas y `reason: null`; `single_epoch` 1 fotograma; `no_usable_frames` y `no_observations` lista vacía; `no_common_band` y `search_limit_reached` como máximo 1 fotograma; `search_limit_reached` en `warnings` sólo con `ready`; los IDs cumplen la expresión de la API (`[A-Za-z0-9][A-Za-z0-9._-]{0,127}`).

## Aviso sobre `sintetico-prepared.json`

Cumple la regla de caso `prepared` público (cada fotograma con `release` `dr1` o `qr3` y `source_url`), pero su `source_url` es `https://example.invalid/irsa/sintetico-prep-obs-*`: **falsa a propósito y NO verificable**, porque es sintético. El dominio `.invalid` está reservado y nunca resuelve.

- **Riesgo:** como lleva `release: "dr1"` y `mode: "prepared"`, la UI no puede distinguirlo de un preparado real salvo por el dominio y los IDs `sintetico-*`. **No usarlo nunca en una demo, captura de entrega ni build público.**
- Que un `source_url` real abre un registro de IRSA **no** se comprueba con este fixture: va en un caso REAL de la matriz (**F01-R08**, y **F01-R14** para el caso de la demo, WISE 0855).

## Más reglas confirmadas por Alexis

1. `search_limit_reached` tiene tres formas: `insufficient` con un fotograma validado (1 frame y `band` con valor), `insufficient` sin fotograma (`frames: []`, `band: null`) y `ready` con el código en `warnings`. Cada una tiene su fixture sintético.
2. RA/Dec se validan en el navegador y también en la API. La API real se prueba directamente (`web/e2e/api.spec.ts`, sin mocks).

## No cubierto

Ningún fixture, canónico ni sintético, incluye `quality_flags` con `masked_pixels` (huecos transparentes por la máscara de comparación). Si se quiere un caso de UI para ese aviso, hace falta un fixture nuevo.

Los PNG se simulan con un píxel de relleno en `../support.ts`; no hay imágenes en el repo.
