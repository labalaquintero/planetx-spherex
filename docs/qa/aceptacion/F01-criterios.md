# F01 · Criterios de aceptación (Quintero)

**Base:** `main` @ `9b08f93` · **Contrato:** referencia v0.1 de [00_Contexto_General.md §5](../../contexto/00_Contexto_General.md) (aún no existe `docs/contratos/comparacion-v1.md` ni los fixtures canónicos de Alexis).
**Estado de todos los casos: `pendiente`.** Este documento es un plan de pruebas, no un informe: no hay UI ni API de comparaciones en el repo, así que nada se ha ejecutado.

## Convenciones

- **Ámbito.** Cada caso es **SIMULADO** (fixtures `sintetico-*` interceptados con Playwright; no prueba datos reales) o **REAL** (demo desplegada, mismo SHA que publica Isaac, incógnito y red externa). Los resultados de ambos ámbitos se registran por separado y nunca se sustituyen entre sí: que pase lo simulado no cierra lo real.
- **Registro por ejecución:** SHA evaluado, fecha/hora UTC, navegador, URL (en REAL), pasos, esperado y observado. Se anota en [F01-matriz.csv](F01-matriz.csv).
- **Estados:** `pendiente` · `no disponible` (falta UI/API/Playwright) · `pasa` · `falla` · `parcial` · `bloqueado` (no se puede probar el resultado esperado por una dependencia ajena todavía no integrada, y el sistema se comporta según el contrato; no es un fallo). En ejecuciones contra la API local se usan `real-local-pasa` y `real-local-pasa-parcial`, para no confundirlas con la demo.
- Los fixtures usados son **sintéticos y provisionales** ([web/e2e/fixtures/README.md](../../../web/e2e/fixtures/README.md)). Los selectores son **propuestas** ([selectores-propuestos.md](selectores-propuestos.md)).
- Coordenadas de ejemplo: `ra_deg=10.25`, `dec_deg=-12.5`, campo 0,10°.

## Casos simulados

### Estados 200

**F01-C01 · `ready` con 2 fotogramas (A/B).**
Dado un visitante sin cuenta en la página de inicio y una API que responde `ready` con 2 fotogramas de fechas distintas. Cuando escribe RA/Dec válidos y pulsa Comparar. Entonces ve la secuencia con el reproductor y el control A/B habilitados; cada fotograma muestra fecha/hora UTC, banda, ID de observación y enlace de fuente; ve el aviso de que un cambio visible no prueba un hallazgo; no hay reproducción automática.

**F01-C02 · `ready` con 6 fotogramas.**
Dado `ready` con 6 fotogramas en orden cronológico. Cuando se ejecuta la búsqueda. Entonces el control por posición ofrece 6 posiciones en orden de `observed_at`; avanzar/retroceder recorre las 6 sin inventar fotogramas ni interpolar fechas; Play/Pausa funciona y se detiene al cambiar de consulta.

**F01-C03 · `insufficient` / `single_epoch`.**
Dado `insufficient` con 1 fotograma. Cuando se ejecuta la búsqueda. Entonces se puede ver la imagen individual, la reproducción y el A/B están deshabilitados y se explica la razón (una sola época).

**F01-C04 · `insufficient` / `no_common_band`.**
Dado `insufficient`, lista vacía y `band: null`. Entonces se muestra «cobertura insuficiente» con la razón de banda no común; sin imágenes, sin reproducción; no se presenta como «sin cobertura» ni como error.

**F01-C05 · `insufficient` / `no_usable_frames`.**
Dado `insufficient`, lista vacía. Entonces estado de cobertura insuficiente con la razón de fotogramas no utilizables; distinto de `no_coverage` y de fallo temporal.

**F01-C06 · `insufficient` / `search_limit_reached` sin fotograma validado.**
Regla del contrato (confirmada por Alexis): si no se validó ningún fotograma, `frames: []` y `band: null`. Dado ese `insufficient`. Entonces estado de cobertura insuficiente que explica que la búsqueda se recortó por límite; sin imágenes ni reproducción; no afirma ausencia de datos.

**F01-C20 · `insufficient` / `search_limit_reached` con 1 fotograma validado.**
Regla: si se validó un fotograma, `frames` tiene 1 elemento y `band` tiene valor. Dado ese `insufficient`. Entonces se muestra la imagen individual con su banda, la reproducción y el A/B siguen deshabilitados y se explica que la búsqueda se recortó por límite.

**F01-C21 · `ready` con warning `search_limit_reached`.**
Regla: si ya hay secuencia válida, `status` es `ready` y `search_limit_reached` va en `warnings` (no como `reason`). Dado ese `ready`. Entonces el reproductor y el A/B están habilitados y la UI muestra un aviso no bloqueante de que la búsqueda se recortó; no se presenta como cobertura insuficiente.

**F01-C07 · `no_coverage` / `no_observations`.**
Dado `no_coverage`, lista vacía. Entonces estado «sin cobertura» limitado al ámbito consultado (no afirma ausencia global); sin imágenes ni reproducción; sin botón de reintento que sugiera fallo.

**F01-C08 · `mode: prepared`.**
Regla (confirmada por Alexis): un caso preparado público lleva en cada fotograma `release` `dr1` o `qr3` y un `source_url` de IRSA verificable. Dado `ready` con `mode: "prepared"`. Entonces la UI rotula **Caso preparado**, muestra su fecha de preparación (`checked_at`), `release` y enlace de fuente por fotograma; no lo presenta como consulta en vivo.
**Límite del caso simulado:** el fixture usa `release: "dr1"` y un `source_url` `https://example.invalid/…` falso a propósito (es sintético), así que sólo comprueba que la UI muestra `release` y enlaza al `source_url` recibido. Que un `source_url` real abre en IRSA se comprueba en **F01-R08** (REAL).

### Errores HTTP

**F01-C09 · 422 · parámetro faltante.**
Regla (confirmada por Alexis): RA/Dec se validan en el navegador y también en la API. Dado el formulario con RA o Dec vacíos. Cuando pulsa Comparar. Entonces aparece un error de validación asociado al campo, con foco/mensaje accesible; **la UI no envía la petición**; no se muestra «Sin cobertura». El 422 de la API se prueba aparte, sin UI (F01-R03a).

**F01-C10 · 422 · NaN/Infinity.**
Dado `ra_deg=NaN` (o `Infinity`). Entonces igual que C09: mensaje de validación, la UI no envía la petición y no hay resultado de comparación. El 422 de la API: F01-R03b.

**F01-C11 · 422 · fuera de rango.**
Dado `ra_deg=360`, `ra_deg=-0.1`, `dec_deg=90.1` o `dec_deg=-90.1` (límites válidos: `0 ≤ ra < 360`, `−90 ≤ dec ≤ 90`; `ra=0`, `dec=±90` deben aceptarse). Entonces mensaje de validación que orienta el rango y, con comas decimales o horas/minutos, orienta la conversión a grados decimales; la UI no envía la petición. El 422 de la API: F01-R03c.

**F01-C12 · 503 `archive_unavailable`.**
Dado que la API responde `503` con `error.code = "archive_unavailable"`. Entonces estado «fallo temporal» con acción **Reintentar**; nunca «Sin cobertura»; al reintentar con éxito se sustituye por el resultado.

**F01-C13 · 503 `query_timeout`.**
Igual que C12 con `query_timeout`: fallo temporal reintentable, distinto de `no_coverage`.

**F01-C14 · 500 `internal_error`.**
Dado `500` con `internal_error`. Entonces mensaje público breve, sin detalles internos ni trazas; la página sigue operable y permite una nueva consulta.

**F01-C15 · 404 `image_not_found`.**
Dado `ready` cuyo `image_url` de un fotograma devuelve `404 image_not_found`. Entonces ese fotograma muestra un estado de imagen no disponible (no una imagen rota silenciosa), el resto de metadatos sigue visible y no se interpreta como ausencia de datos.

### Etiquetado y transversales

**F01-C16 · Etiqueta «Datos de prueba».**
Dado un resultado con `mode: "fixture"` o fotogramas `release: "fixture"` en dev/test. Entonces la UI muestra la etiqueta **«Datos de prueba»** y no los presenta como NASA/SPHEREx. Complemento: un build público nunca debe mostrar `fixture` (verificación REAL en la demo).

**F01-C17 · Teclado y foco (extra, §2.4).**
Entonces todos los controles (campos, Comparar, presets, Play/Pausa, anterior/siguiente, selector de época) se operan sólo con teclado, el foco es visible y el orden de tabulación es lógico.

**F01-C18 · Vista móvil (extra, §2.4).**
Entonces en ancho de móvil no hay desplazamiento horizontal de la página y los controles y datos de procedencia siguen utilizables.

**F01-C19 · Respuesta tardía descartada (extra, §9).**
Dado que una primera búsqueda responde tarde y una segunda ya terminó. Entonces la respuesta antigua se descarta y su reproducción se detiene; el resultado visible corresponde a la consulta más reciente.

## Casos reales (demo desplegada)

Requieren URL pública, SHA publicado por Isaac y datos verificados por César. Se registran aparte de lo simulado.

| ID | Qué se comprueba |
| --- | --- |
| F01-R01 | Caso preparado real: dos fechas reales distintas, misma banda, IDs y enlaces de fuente comprobables; A/B y Play funcionan. |
| F01-R02 | Con IRSA no disponible, el caso preparado exacto sigue sirviéndose con fecha y procedencia. |
| F01-R03a | **API directa** (petición de Playwright a `/api/v1/comparisons`, sin UI ni mocks): `422 invalid_coordinates` con parámetro faltante o vacío. |
| F01-R03b | API directa: `422 invalid_coordinates` con NaN/Infinity. |
| F01-R03c | API directa: `422 invalid_coordinates` fuera de rango (`ra=360`, `ra=-0.1`, `dec=±90.1`); `ra=0` y `dec=90` no devuelven 422. |
| F01-R03e | API directa: `422 invalid_coordinates` con formato no decimal (exponente `1e1`, coma `10,25`). De momento sólo se ejecuta a mano (`scripts/ejecutar_api_local.py`); no tiene spec de Playwright. |
| F01-R03d | API directa: `422 invalid_coordinates` con parámetro repetido (`ra_deg` o `dec_deg` indicado dos veces, p. ej. `?ra_deg=10.25&ra_deg=11&dec_deg=-12.5`). |
| F01-R04 | Entrada manual de coordenadas libres y consulta en vivo: el resultado es uno de los estados del contrato, con su razón. |
| F01-R05 | Imagen inexistente (`/api/v1/images/<id inexistente>`) responde `404 image_not_found`. |
| F01-R06 | Incógnito y red externa: cargan web, API, PNG y fuentes; sin fixtures visibles; mismo SHA en todas las pruebas. |
| F01-R07 | Teclado y móvil sobre la demo real. |
| F01-R08 | Un caso `prepared` real: cada fotograma lleva `release` `dr1` o `qr3` y un `source_url` de IRSA que **abre un registro verificable** y corresponde al `observation_id`. No lo cubre ningún fixture sintético. |

Los casos F01-R03a/b/c/d no usan mocks: se ejecutan contra la API real (local de Isaac o desplegada, según `E2E_BASE_URL`) con `web/e2e/api.spec.ts`. Se anota la URL y el SHA evaluados en cada ejecución.

### Los cinco objetos del reto (REAL)

**Fuente: [docs/qa/datos/matriz_5_casos.md](../datos/matriz_5_casos.md) de César** (solo lectura; aquí no se copian ni se recalculan sus coordenadas, conteos, fechas ni IDs: consúltense allí). Cada caso se prueba contra la API real y se compara con el estado esperado de abajo.

**Estado esperado: PROVISIONAL, por confirmar con César.** La matriz clasifica la **cobertura en el archivo SIA2** (`verificado` o `sin cobertura`) de cada objeto; no registra el estado que devolverá `/api/v1/comparisons`. El esperado de la API es una inferencia mía a partir de esa clasificación.

| ID | Objeto (caso de la matriz) | Qué reporta la matriz | Estado esperado de la API (provisional) | Observaciones |
| --- | --- | --- | --- | --- |
| F01-R09 | Estrella de Barnard (a) | `verificado` en `spherex_dr1` y `spherex_qr3`, con varias épocas. | `ready` | |
| F01-R10 | Epsilon Indi B (b) | `verificado` en `spherex_dr1` y `spherex_qr3`. | `ready` | Esperado para el objeto consultado; la matriz no promete resolver el par. |
| F01-R11 | WISE 0855 (c) | `verificado` en `spherex_dr1`; `sin cobertura` (`no_observations`) en `spherex_qr3`. | `ready` (la API consulta ambas colecciones y dr1 aporta épocas) | Una consulta **solo** a `qr3` daría `no_coverage` / `no_observations`; no es lo esperado de la API completa. La advertencia de la matriz (§5.3) pide manejar ese estado sin romper el flujo. |
| F01-R12 | RW Aurigae (d) | `verificado` en `spherex_dr1` y `spherex_qr3`. | `ready` | |
| F01-R13 | R Draconis (e) | `verificado` en `spherex_dr1` y `spherex_qr3`. | `ready` | La matriz lo recomienda para variabilidad (§5.1). |

**Estado actual de R09–R13: `bloqueado`.** En la ejecución REAL-local del 2026-11-14 ([ejecuciones/2026-11-14-api-local.md](ejecuciones/2026-11-14-api-local.md)) los cinco devolvieron `503 archive_unavailable`: API cumple el contrato (503 archive_unavailable, no no_coverage); búsqueda en vivo aún no integrada. No es un fallo ni una validación de la expectativa `ready`, que sigue sin comprobarse.

Por qué el esperado no es una certeza (y qué otro estado podría aparecer):

- **Cobertura ≠ secuencia comparable.** La matriz cuenta exposiciones y épocas por detector/banda del archivo; la guía pide además banda común por `WCS-WAVE`, recortes y píxeles válidos. `insufficient` con `no_common_band` o `no_usable_frames` no se descarta con lo que reporta la matriz.
- **Muchas exposiciones.** Con cientos de candidatos por caso, la búsqueda puede acotarse: `ready` con `search_limit_reached` en `warnings`, o `insufficient` / `search_limit_reached` (ver C20 y C21). A confirmar con Isaac y César.
- **Preparado o en vivo.** Un caso sólo se sirve como preparado si coincide exactamente con un manifiesto; si no, se consulta IRSA en vivo (plazo de 20–25 s) y un fallo externo da `503`, nunca `no_coverage`.
- **La matriz no dice cuál objeto se usará en la demo.** Eso lo confirma César (véase [guion-demo.md](../../entrega/guion-demo.md)).

Los resultados se registran tal como salgan, también los negativos, y no se promete ningún desplazamiento ni variación visible: la ausencia de un cambio no es un error por sí sola.

## Fuera de alcance de este documento

La validez científica (WCS, banda, orientación) es de Alexis y César; aquí sólo se comprueba lo que la UI presenta frente al contrato. Un fixture que pasa nunca reemplaza una prueba pública real.
