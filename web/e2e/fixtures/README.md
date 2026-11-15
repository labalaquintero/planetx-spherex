# Fixtures sintéticos de aceptación

**Estos archivos son SINTÉTICOS y PROVISIONALES.** No son capturas ni respuestas reales de SPHEREx/IRSA, y no prueban nada sobre datos reales.

- Los hizo Quintero para poder preparar specs de Playwright sin esperar a Alexis. Siguen el contrato v0.1 de [00_Contexto_General.md §5](../../../docs/contexto/00_Contexto_General.md) (`schema_version "1"`, `science_version "v1"`, campo 0,10°, misma banda, fechas distintas y cronológicas).
- **No son los fixtures canónicos.** Alexis publicará los cuatro canónicos (`comparacion-ready.json`, `comparacion-insufficient.json`, `comparacion-no-coverage.json`, `comparacion-error-503.json`) en `web/src/contracts/fixtures/`. Cuando existan, estos se sustituyen o se eliminan; no deben convivir como fuente de verdad.
- Prefijo `sintetico-` en archivos, IDs de fotograma (`sintetico-*`) e IDs de observación, para que no se confundan con datos reales ni se reciclen IDs con otros bytes.
- `release` es `"fixture"` y `source_url` es `null`, permitidos sólo en mocks/pruebas. `mode` es `"fixture"`, salvo `sintetico-prepared.json` (`"prepared"`), que sólo sirve para comprobar el rótulo «Caso preparado»: un preparado real llevaría `release` `dr1`/`qr3` y `source_url` comprobable.
- Los archivos de error contienen sólo el cuerpo `{"error":{"code","message"}}`; el código HTTP lo pone el spec.
- Los PNG se simulan con un píxel de relleno en `../support.ts`; no hay imágenes en el repo.

| Archivo | HTTP | Estado / código | Casos |
| --- | --- | --- | --- |
| `sintetico-ready-2.json` | 200 | `ready`, 2 fotogramas | C01, C16–C19 |
| `sintetico-ready-6.json` | 200 | `ready`, 6 fotogramas | C02 |
| `sintetico-prepared.json` | 200 | `ready`, `mode: prepared` | C08 |
| `sintetico-insufficient-single-epoch.json` | 200 | `insufficient` / `single_epoch` | C03 |
| `sintetico-insufficient-no-common-band.json` | 200 | `insufficient` / `no_common_band` | C04 |
| `sintetico-insufficient-no-usable-frames.json` | 200 | `insufficient` / `no_usable_frames` | C05 |
| `sintetico-insufficient-search-limit-reached.json` | 200 | `insufficient` / `search_limit_reached` | C06 |
| `sintetico-no-coverage.json` | 200 | `no_coverage` / `no_observations` | C07 |
| `sintetico-error-422.json` | 422 | `invalid_coordinates` | C09–C11 |
| `sintetico-error-503-archive-unavailable.json` | 503 | `archive_unavailable` | C12 |
| `sintetico-error-503-query-timeout.json` | 503 | `query_timeout` | C13 |
| `sintetico-error-500.json` | 500 | `internal_error` | C14 |
| `sintetico-error-404-image.json` | 404 | `image_not_found` | C15 |
