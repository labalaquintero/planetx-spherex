# Selectores propuestos (borrador para acordar con Santiago)

**Estado: PROPUESTA, no definitiva.** Nada de esto existe aún en la UI (hoy `web/src/App.tsx` es la plantilla de Vite). Los specs de `web/e2e/` usan estos nombres sólo para describir la intención; si Santiago elige otros, se ajustan los specs, no al revés.

**Criterio:** localizar por **rol + nombre accesible** (`getByRole`, `getByLabel`), tal como lo haría un usuario con lector de pantalla. Sin `data-testid` ni selectores CSS añadidos sólo para que pase una prueba. Los textos son castellano de inicio (§2). Si un elemento no puede localizarse así, es una señal de accesibilidad a corregir en la UI.

## Entrada

| Elemento | Rol y nombre propuesto |
| --- | --- |
| Campo RA | `textbox` «RA (grados)» |
| Campo Dec | `textbox` «Dec (grados)» |
| Enviar | `button` «Comparar» |
| Ejemplo | `button` «Usar ejemplo» (rellena y ejecuta la misma búsqueda) |
| Casos preparados | `button` «Caso preparado: \<nombre\>» |
| Error de validación | mensaje enlazado al campo con `aria-describedby`; campo con `aria-invalid="true"` |

## Estados (regiones anunciables)

| Estado | Propuesta |
| --- | --- |
| Cargando | `status` «Cargando…» |
| Resultado listo | `heading` «Resultado» (o `region` «Comparación») |
| Cobertura insuficiente | `status` con texto «Cobertura insuficiente» + razón |
| Sin cobertura | `status` con texto «Sin cobertura» |
| Fallo temporal (503) | `alert` con texto «Fallo temporal» y `button` «Reintentar» |
| Error inesperado (500) | `alert` con mensaje público breve |
| Aviso de no-hallazgo | `note` con «un cambio visible no prueba un hallazgo» |
| Datos de prueba | texto visible «Datos de prueba» |
| Caso preparado | texto visible «Caso preparado» + fecha de preparación |

Es esencial que «Sin cobertura», «Cobertura insuficiente» y «Fallo temporal» sean **textualmente distintos** (§2.5).

## Comparador

| Elemento | Propuesta |
| --- | --- |
| Reproducir / Pausar | `button` «Reproducir» ⇄ «Pausar» (deshabilitado si no hay `ready`) |
| Anterior / Siguiente | `button` «Fotograma anterior», «Fotograma siguiente» |
| Control por época | `slider` «Época» con `aria-valuetext` = fecha UTC; o grupo de `radio`/`button` por fecha |
| Modo A/B | `button` «Ver A», «Ver B» (o `tab`) |
| Imagen | `img` con nombre «Fotograma N de M, observado \<fecha UTC\>» |
| Imagen no disponible | texto «Imagen no disponible» en el lugar del fotograma |

## Evidencia por fotograma

| Dato | Propuesta |
| --- | --- |
| Fecha y hora UTC | texto con «UTC» |
| Banda aproximada | texto «Banda» + µm |
| ID de observación | texto «Observación» + `observation_id` |
| Enlace de fuente | `link` «Fuente (IRSA)» con `href` = `source_url` |
| Release | texto `dr1` / `qr3` |

## Preguntas abiertas para Santiago

1. ¿La UI valida RA/Dec en el navegador antes de enviar? Si sí, ¿qué mensaje y qué campo recibe el foco? ¿Y si llega un `422` del servidor, se muestra igual?
2. ¿Cómo se anuncia el cambio de fotograma durante la reproducción (región `aria-live`)?
3. ¿Selector de época como `slider` o como grupo de botones?
4. ¿Cómo se ve un fotograma cuyo PNG da 404?
5. ¿Puerto y proxy de dev para `E2E_BASE_URL`? (Isaac confirma el puerto de la API.)
