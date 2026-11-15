# Selectores: propuesta original y UI real

**Estado:** la UI del visor ya está en `main` (PR #9 de Santiago, SHA `ae983c9b3a6658103794283ffaad638cb9d88be7`). Los specs de `web/e2e/` usan ahora los **nombres reales** de esa UI. La tabla de abajo conserva mi propuesta original para ver qué cambió; la columna «UI real» es la que manda.

**Criterio:** localizar por **rol + nombre accesible** (`getByRole`, `getByLabel`), sin `data-testid` aunque existan. Si un elemento no puede localizarse así, es una señal de accesibilidad a corregir en la UI. Los nombres se acotan a lo que está dentro de la región o el `role` correcto cuando el texto se repite.

## Selectores reales (UI en `main`, SHA `ae983c9`)

Fuente: `web/src/App.tsx` y `web/src/features/viewer/components/*` (sólo lectura). Resultado de leer el código: **no está ejecutado** en un navegador y Playwright aún no está instalado, así que nada de esto está verificado en pantalla.

### Entrada

| Elemento | Propuesta original | UI real | Nota |
| --- | --- | --- | --- |
| Campo RA | textbox «RA (grados)» | textbox «RA (grados ICRS)» | Mi nombre no era subcadena del real. |
| Campo Dec | textbox «Dec (grados)» | textbox «Dec (grados ICRS)» | Ídem. |
| Enviar | button «Comparar» | button «Comparar» ✓ | Mientras carga pasa a «Buscando…» y se deshabilita. |
| Ejemplos | button «Usar ejemplo», «Caso preparado: …» | grupo «Ejemplos de coordenadas» con botones «Ejemplo listo», «Insuficiente», «Sin cobertura», «Error temporal» | Son presets de prueba con el mock; ver preguntas. |
| Error de validación | mensaje enlazado al campo | `alert` junto al campo; campo con `aria-invalid="true"` y `aria-describedby` ✓ | Textos: «Ingrese un valor numérico finito.», «RA debe estar entre 0 y 359.999…°», «Dec debe estar entre −90° y +90°». |
| Formulario | — | form «Búsqueda de coordenadas celestes» | |

### Estados

| Estado | Propuesta original | UI real |
| --- | --- | --- |
| Cargando | status «Cargando…» | status «Buscando observaciones…» |
| Resultado listo | heading «Resultado» | región «Comparador de épocas» (no hay heading «Resultado») |
| Cobertura insuficiente | status «Cobertura insuficiente» + razón | status «Cobertura insuficiente.» + frase por razón (p. ej. «Solo se encontró una época…», «banda espectral comparable», «fotogramas válidos», «límite de búsqueda») ✓ |
| Sin cobertura | status «Sin cobertura» | status «Sin cobertura.» ✓ **Pero** el preset «Sin cobertura» es un button con el mismo texto: buscar el estado siempre dentro de `role=status`. |
| Fallo 503 | alert «Fallo temporal» + «Reintentar» | alert «Error (503): \<mensaje\>» + button «Reintentar búsqueda». No dice «fallo temporal». Todo 503 se trata igual (`archive_unavailable` y `query_timeout`). |
| Error 500 u otro | alert con mensaje breve | alert «Error: \<mensaje\>»; **sin** botón de reintento |
| Imagen que no carga (404) | texto «Imagen no disponible» | alert «No se pudo cargar la imagen.» en el lugar del fotograma |
| Caso preparado | texto «Caso preparado» + fecha | «Caso preparado» como valor de «Modo» en el panel de procedencia; fecha en «Comprobado» (texto es-MX; el ISO está en `<time datetime>`) |
| Datos de prueba | texto «Datos de prueba» | insignia «Datos de prueba» (`aria-label` igual). El panel dice además «Datos de prueba (fixture)» en «Modo»: usar `exact`. En producción sólo con `mode: "fixture"`; **en desarrollo siempre**. |
| Aviso de no-hallazgo | `note` | párrafo sin rol dentro del panel («…no constituye por sí solo evidencia de un hallazgo…»); el pie de página repite una frase parecida: acotar a la región |
| Aviso `search_limit_reached` (ready + warning) | texto legible | **muestra el código en bruto** en «Avisos:» (pendiente de Santiago) |
| Un solo fotograma | reproductor deshabilitado | los controles **no existen** (no hay toolbar ni botones); hay un aviso «Visualización del único fotograma disponible» |

### Comparador

| Elemento | Propuesta original | UI real |
| --- | --- | --- |
| Región | — | region «Comparador de épocas» (enfocable: `tabIndex=0`) |
| Barra de controles | — | toolbar «Controles de reproducción» (sólo con 2 o más fotogramas) |
| Reproducir / Pausar | «Reproducir» ⇄ «Pausar» | «Reproducir secuencia» ⇄ «Pausar reproducción» (texto visible «▶ Play» / «⏸ Pausa»; el nombre accesible es el `aria-label`) |
| Anterior / Siguiente | «Fotograma anterior» / «Fotograma siguiente» | «Época anterior» / «Época siguiente» |
| Selector de época | slider «Época» o botones | botones «Mostrar época A», «Mostrar época B»… con `aria-pressed` (no hay slider) |
| Modo A/B | «Ver A» / «Ver B» | los mismos botones «Mostrar época A/B» |
| Imagen | «Fotograma N de M, observado …» | img «Observación del \<fecha larga es-MX\> — Época A — 1 de 2» |
| Anuncio del cambio de época | región `aria-live` | `<p aria-live="polite">`: «Época A — 1 de 2» |
| Teclado en el comparador | — | ←/→ cambian de época; Espacio reproduce/pausa (con el foco en la región) |

### Evidencia por fotograma (panel «Procedencia y metadatos», un `<details>` abierto)

| Dato | Propuesta original | UI real |
| --- | --- | --- |
| Fecha y hora UTC | texto con «UTC» | «Observado» (`<time datetime>` y texto es-MX con zona UTC) |
| Banda | texto «Banda» + µm | «Banda»: «1.25 ± 0.02 µm» |
| ID de observación | texto | «ID de observación» (`<code>`) y además «ID de fotograma» |
| Release | texto | «Publicación» |
| Enlace de fuente | link «Fuente (IRSA)» | link «Enlace al archivo» con `href` = `source_url`; si es `null`: «No disponible (fixture)» |
| Modo / versión / comprobado | — | «Modo», «Versión de procesamiento», «Comprobado» |

## Cómo se ejecutan los specs (consecuencia importante)

En desarrollo (`vite dev`) **la app no llama a la API**: `api.ts` usa un mock interno cuando `!import.meta.env.PROD`. La interceptación de Playwright sólo funciona contra un **build de producción** (`vite build` + `vite preview`), que sí hace `fetch('/api/v1/comparisons…')`. Por eso `web/playwright.config.ts` levanta ese preview en `http://127.0.0.1:4173` por defecto y `E2E_BASE_URL` lo sustituye (demo).

## Observaciones del código (no son preguntas)

- La UI acepta la coma decimal («10,25») y el exponente («1e1») y envía el número ya normalizado; a través de la UI esos formatos no dan 422 (a la API directa sí; ver F01-R03e).
- Con `Comparar` deshabilitado durante la carga, no se puede lanzar una segunda consulta desde la interfaz (afecta a C19).
- Los fixtures del mock de Santiago (`web/src/features/viewer/fixtures/`) llevan un `source_url` de IRSA no nulo, a diferencia de los canónicos de Alexis (`null`).

## Cerradas

- ~~¿La UI valida RA/Dec en el navegador antes de enviar?~~ **Sí**, confirmado por Alexis y por el código: la UI no envía la petición con coordenadas inválidas (C09–C11); el 422 de la API se prueba directamente (F01-R03a/b/c/d).
- ~~¿Cómo se anuncia el cambio de fotograma?~~ Con un `<p aria-live="polite">`.
- ~~¿Selector de época como slider o botones?~~ Botones «Mostrar época X» con `aria-pressed`.
- ~~¿Cómo se ve un fotograma cuyo PNG da 404?~~ Un alert «No se pudo cargar la imagen.».
- ~~¿Puerto y proxy de dev?~~ Dev: `127.0.0.1:5173` con proxy `/api` → `127.0.0.1:8000` (`vite.config.ts`). Los specs usan preview en `4173`.

## Preguntas abiertas para Santiago

1. ¿Añade `@playwright/test` y el script `test:e2e` en `web/package.json` (con su lock)?
2. ¿Los presets «Probar:» deben verse en producción? Hoy salen también en el build público y envían consultas reales.
3. El preset «Sin cobertura» tiene el mismo texto que el estado «Sin cobertura»: ¿renombrarlo (p. ej. «Ejemplo sin cobertura»)?
4. ¿Qué texto legible se muestra para `search_limit_reached` en vez del código en bruto (C21)?
5. ¿Se permite lanzar una nueva consulta durante la carga? Hoy `Comparar` se deshabilita y el descarte de respuestas antiguas sólo se puede probar en Vitest (C19).
6. Foco y ayuda en la validación: ¿el foco pasa al primer campo con error y se orienta sobre la conversión desde horas/minutos (§2.1 de la guía)? Hoy no mueve el foco y un valor como «10h30m» sólo dice «Ingrese un valor numérico finito.».
7. ¿La insignia «Datos de prueba» debe salir siempre en desarrollo, o sólo con `mode: "fixture"` como en producción?
8. Los presets sólo rellenan RA/Dec y la búsqueda se lanza con «Comparar»; la guía (§2.1) dice que los botones de casos preparados «rellenan y ejecutan la misma búsqueda». ¿Se mantiene así?
