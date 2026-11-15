# Fixtures sintéticos de aceptación

**Estos archivos son SINTÉTICOS y PROVISIONALES.** No son capturas ni respuestas reales de SPHEREx/IRSA, y no prueban nada sobre datos reales.

- Los hizo Quintero para poder preparar specs de Playwright sin esperar a Alexis. Siguen el contrato v0.1 de [00_Contexto_General.md §5](../../../docs/contexto/00_Contexto_General.md) más las tres reglas que Alexis confirmó después (ver abajo): `schema_version "1"`, `science_version "v1"`, campo 0,10°, misma banda, fechas distintas y cronológicas.
- **No son los fixtures canónicos.** Alexis publicará los cuatro canónicos (`comparacion-ready.json`, `comparacion-insufficient.json`, `comparacion-no-coverage.json`, `comparacion-error-503.json`) en `web/src/contracts/fixtures/`. Cuando existan, estos se sustituyen o se eliminan; no deben convivir como fuente de verdad.
- Prefijo `sintetico-` en archivos, IDs de fotograma (`sintetico-*`) e IDs de observación, para que no se confundan con datos reales ni se reciclen IDs con otros bytes.
- `release` es `"fixture"` y `source_url` es `null`, permitidos sólo en mocks/pruebas, **salvo `sintetico-prepared.json`** (ver abajo). `mode` es `"fixture"`, salvo ese archivo (`"prepared"`).
- Los archivos de error contienen sólo el cuerpo `{"error":{"code","message"}}`; el código HTTP lo pone el spec.
- Los PNG se simulan con un píxel de relleno en `../support.ts`; no hay imágenes en el repo.

## Reglas del contrato confirmadas por Alexis

1. **`search_limit_reached`** tiene tres formas, cada una en su fixture:
   - `insufficient` con un fotograma validado: `frames` con 1 elemento y `band` con valor (`...-search-limit-reached-1-frame.json`).
   - `insufficient` sin fotograma validado: `frames: []` y `band: null` (`...-search-limit-reached-0-frames.json`).
   - Con secuencia válida ya disponible: `status: "ready"` con `"search_limit_reached"` en `warnings` (`sintetico-ready-search-limit-warning.json`). La UI debería mostrar el aviso sin bloquear el reproductor.
2. **Caso `prepared` público:** cada fotograma lleva `release` `dr1` o `qr3` y un `source_url` de IRSA verificable.
3. **RA/Dec se validan en el navegador y también en la API.** Los fixtures de error 422 sólo se usan para detectar que la UI **no** envía la petición; la API real se prueba directamente (`web/e2e/api.spec.ts`).

## Aviso sobre `sintetico-prepared.json`

Cumple la regla 2 en forma (`release: "dr1"`), pero su `source_url` es `https://example.invalid/irsa/sintetico-prep-obs-*`: **falsa a propósito y NO verificable**, porque es sintético. El dominio `.invalid` está reservado y nunca resuelve.

- **Riesgo:** como lleva `release: "dr1"` y `mode: "prepared"`, la UI no tiene forma de distinguirlo de un preparado real salvo por el dominio y los IDs `sintetico-*`. **No usarlo nunca en una demo, captura de entrega ni build público.**
- Que un `source_url` real abre un registro de IRSA **no** se comprueba con este fixture. Va en un caso REAL de la matriz (**F01-R08**).

| Archivo | HTTP | Estado / código | Casos |
| --- | --- | --- | --- |
| `sintetico-ready-2.json` | 200 | `ready`, 2 fotogramas | C01, C16–C19 |
| `sintetico-ready-6.json` | 200 | `ready`, 6 fotogramas | C02 |
| `sintetico-ready-search-limit-warning.json` | 200 | `ready` + warning `search_limit_reached` | C21 |
| `sintetico-prepared.json` | 200 | `ready`, `mode: prepared`, `release: dr1`, `source_url` `.invalid` | C08 |
| `sintetico-insufficient-single-epoch.json` | 200 | `insufficient` / `single_epoch` | C03 |
| `sintetico-insufficient-no-common-band.json` | 200 | `insufficient` / `no_common_band` | C04 |
| `sintetico-insufficient-no-usable-frames.json` | 200 | `insufficient` / `no_usable_frames` | C05 |
| `sintetico-insufficient-search-limit-reached-0-frames.json` | 200 | `insufficient` / `search_limit_reached`, `frames: []`, `band: null` | C06 |
| `sintetico-insufficient-search-limit-reached-1-frame.json` | 200 | `insufficient` / `search_limit_reached`, 1 fotograma, `band` con valor | C20 |
| `sintetico-no-coverage.json` | 200 | `no_coverage` / `no_observations` | C07 |
| `sintetico-error-422.json` | 422 | `invalid_coordinates` | C09–C11 (sólo para detectar que no se envía) |
| `sintetico-error-503-archive-unavailable.json` | 503 | `archive_unavailable` | C12 |
| `sintetico-error-503-query-timeout.json` | 503 | `query_timeout` | C13 |
| `sintetico-error-500.json` | 500 | `internal_error` | C14 |
| `sintetico-error-404-image.json` | 404 | `image_not_found` | C15 |
