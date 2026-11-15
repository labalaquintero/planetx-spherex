# F01 · Criterios de aceptación (Quintero)

**Base:** `main` @ `9b08f93` · **Contrato:** referencia v0.1 de [00_Contexto_General.md §5](../../contexto/00_Contexto_General.md) (aún no existe `docs/contratos/comparacion-v1.md` ni los fixtures canónicos de Alexis).
**Estado de todos los casos: `pendiente`.** Este documento es un plan de pruebas, no un informe: no hay UI ni API de comparaciones en el repo, así que nada se ha ejecutado.

## Convenciones

- **Ámbito.** Cada caso es **SIMULADO** (fixtures `sintetico-*` interceptados con Playwright; no prueba datos reales) o **REAL** (demo desplegada, mismo SHA que publica Isaac, incógnito y red externa). Los resultados de ambos ámbitos se registran por separado y nunca se sustituyen entre sí: que pase lo simulado no cierra lo real.
- **Registro por ejecución:** SHA evaluado, fecha/hora UTC, navegador, URL (en REAL), pasos, esperado y observado. Se anota en [F01-matriz.csv](F01-matriz.csv).
- **Estados:** `pendiente` · `no disponible` (falta UI/API/Playwright) · `pasa` · `falla` · `parcial`.
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

**F01-C06 · `insufficient` / `search_limit_reached`.**
Dado `insufficient`, lista vacía. Entonces estado de cobertura insuficiente que explica que la búsqueda se recortó por límite; no afirma ausencia de datos.

**F01-C07 · `no_coverage` / `no_observations`.**
Dado `no_coverage`, lista vacía. Entonces estado «sin cobertura» limitado al ámbito consultado (no afirma ausencia global); sin imágenes ni reproducción; sin botón de reintento que sugiera fallo.

**F01-C08 · `mode: prepared`.**
Dado `ready` con `mode: "prepared"`. Entonces la UI rotula **Caso preparado**, muestra su fecha de preparación (`checked_at`) y la procedencia por fotograma; no lo presenta como consulta en vivo.

### Errores HTTP

**F01-C09 · 422 · parámetro faltante.**
Dado el formulario con RA o Dec vacíos (o petición sin `dec_deg`). Cuando pulsa Comparar. Entonces aparece un error de validación asociado al campo, con foco/mensaje accesible; no se muestra «Sin cobertura». Pregunta abierta para Santiago: ¿la UI bloquea en cliente o envía y muestra el 422 `invalid_coordinates`? Se prueban ambas vías cuando se acuerde.

**F01-C10 · 422 · NaN/Infinity.**
Dado `ra_deg=NaN` (o `Infinity`). Entonces igual que C09: mensaje de validación, sin resultado de comparación.

**F01-C11 · 422 · fuera de rango.**
Dado `ra_deg=360`, `ra_deg=-0.1`, `dec_deg=90.1` o `dec_deg=-90.1` (límites válidos: `0 ≤ ra < 360`, `−90 ≤ dec ≤ 90`; `ra=0`, `dec=±90` deben aceptarse). Entonces mensaje de validación que orienta el rango y, con comas decimales o horas/minutos, orienta la conversión a grados decimales.

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
| F01-R03 | La API real responde `422 invalid_coordinates` para faltante, NaN y fuera de rango (petición directa). |
| F01-R04 | Entrada manual de coordenadas libres y consulta en vivo: el resultado es uno de los estados del contrato, con su razón. |
| F01-R05 | Imagen inexistente (`/api/v1/images/<id inexistente>`) responde `404 image_not_found`. |
| F01-R06 | Incógnito y red externa: cargan web, API, PNG y fuentes; sin fixtures visibles; mismo SHA en todas las pruebas. |
| F01-R07 | Teclado y móvil sobre la demo real. |

## Fuera de alcance de este documento

La validez científica (WCS, banda, orientación) es de Alexis y César; aquí sólo se comprueba lo que la UI presenta frente al contrato. Un fixture que pasa nunca reemplaza una prueba pública real.
