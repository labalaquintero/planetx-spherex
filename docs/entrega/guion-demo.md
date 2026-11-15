# Guion de demo F01 (borrador, Quintero)

**Estado: BORRADOR sin ensayar.** Nada de lo que sigue se ha verificado contra una demo real: aún no hay UI, API de comparaciones ni URL pública. Todo lo marcado **TODO** está pendiente de una persona o dato concretos. **No se inventa ningún dato de observación**: coordenadas, fechas, IDs y banda salen del caso que confirme César en su matriz, y sólo se presentan después de comprobarlos en la demo.

- Base de contexto: [00_Contexto_General.md](../contexto/00_Contexto_General.md) §2 (recorrido de demo), §10 (entrega).
- Duración objetivo del ensayo: 2–3 min (≈2:45). **TODO: duración máxima y formato que pida la sede** (la guía menciona como orientación un vídeo de hasta 30 s o hasta 7 diapositivas; confirmarlo con la guía vigente). Si el límite es menor, se recorta por el orden de la sección «Qué recortar».
- Se enseña sólo lo que existe y lo que se comprobó. Lo que sea fixture o respaldo se dice en voz alta.

## Datos del caso (TODO, no rellenar sin confirmación)

| Campo | Valor |
| --- | --- |
| Caso elegido (matriz de César) | **TODO: nombre del caso** |
| RA / Dec (grados decimales ICRS) | **TODO: ra_deg, dec_deg** |
| Campo | 0,10° × 0,10° (valor de diseño de la guía) |
| Fecha y hora UTC, fotograma A | **TODO** |
| Fecha y hora UTC, fotograma B | **TODO** |
| Release e ID de observación A / B | **TODO** |
| Banda aproximada (centro ± tolerancia, µm) | **TODO** |
| Enlaces de fuente (IRSA) A / B | **TODO** |
| URL de la demo y SHA publicado por Isaac | **TODO** |
| ¿Es caso preparado o consulta en vivo? | **TODO** (la UI debe rotularlo) |

## Guion en castellano

Tiempos acumulados sobre ≈2:45. El orden es: problema → coordenada → dos fechas reales → qué se observa → límites y fuentes.

| Bloque | Tiempo | En pantalla | Qué se dice |
| --- | --- | --- | --- |
| 1. Problema | 0:00–0:20 (20 s) | Página de inicio en ventana de incógnito (sin cuenta). | «SPHEREx observa el cielo en infrarrojo. Para alguien sin experiencia en astronomía es difícil juntar imágenes de la misma zona en distintas fechas y saber si algo cambió o si sólo cambiaron las condiciones de observación. Planet X es un visor para comparar esa misma región en otra fecha y ver de dónde sale cada imagen.» |
| 2. Coordenada | 0:20–0:50 (30 s) | Escribir RA y Dec en grados decimales; pulsar **Comparar** (o un caso preparado). Se ve el estado de carga y el resultado. | «Introduzco una coordenada: **TODO ra_deg, dec_deg**, en grados decimales ICRS. El campo es un cuadrado de 0,10°. [Si es preparado:] Este es un caso preparado, con su fecha de preparación; [si es en vivo:] esta consulta se hace ahora al archivo.» |
| 3. Dos fechas reales | 0:50–1:30 (40 s) | Alternar A/B; luego Reproducir/Pausar. Señalar fecha y hora UTC de cada fotograma. | «Aquí hay dos observaciones reales de la misma región, **TODO fecha A** y **TODO fecha B** (UTC). Alterno entre ellas y también puedo reproducirlas. Misma escala, centro y contraste, sin interpolar ni inventar fotogramas.» |
| 4. Qué se observa | 1:30–2:00 (30 s) | Imágenes A y B; aviso de que un cambio visible no es un hallazgo. | «**TODO: describir sólo lo que se ve y se validó** (con Alexis y César). Un cambio aparente puede deberse a movimiento, variabilidad, ruido, alineación, banda o artefactos. Esta herramienta no afirma ningún descubrimiento.» |
| 5. Límites y fuentes | 2:00–2:45 (45 s) | Panel de procedencia: banda, ID, release y enlaces; luego un estado de cobertura insuficiente o sin cobertura. | «Cada fotograma indica fecha, banda aproximada, ID y enlace de origen en IRSA. Las imágenes tienen la resolución y el filtro de SPHEREx; no son mediciones fotométricas. Si pido una región sin pares comparables, la herramienta dice **cobertura insuficiente** o **sin cobertura**, y distingue eso de un fallo temporal.» |

Reglas de la demo: no prometer más de lo verificado (cinco objetos del reto, cobertura general, movimientos o variaciones sin validar); nombrar los resultados negativos como lo que son; no mostrar nunca «Datos de prueba» como si fuera NASA/SPHEREx.

### Qué recortar si el tiempo es menor

1. Quitar el bloque 4 salvo el aviso de no-hallazgo.
2. Reducir el bloque 1 a una frase.
3. Mantener siempre: coordenada, dos fechas, y fuentes/límites.

## English version (draft)

**TODO: confirm with the venue the required language(s), subtitles, maximum length and final format.** Until then: if the video is recorded in Spanish, prepare English subtitles; otherwise use the script below. Same timings and same TODO placeholders.

| Block | Time | Script |
| --- | --- | --- |
| 1. Problem | 0:00–0:20 | "SPHEREx observes the sky in infrared. For someone without an astronomy background, it is hard to gather images of the same area on different dates and tell whether something changed or only the observing conditions did. Planet X is a viewer that compares the same region at another date and shows where each image comes from." |
| 2. Coordinate | 0:20–0:50 | "I enter a coordinate: **TODO ra_deg, dec_deg**, in decimal degrees (ICRS). The field is a 0.10° square. [If prepared:] This is a prepared case with its preparation date; [if live:] this query goes to the archive now." |
| 3. Two real dates | 0:50–1:30 | "Here are two real observations of the same region, **TODO date A** and **TODO date B** (UTC). I can switch between them or play them. Same scale, center and contrast; no interpolation and no invented frames." |
| 4. What we see | 1:30–2:00 | "**TODO: describe only what is visible and validated.** An apparent change may come from motion, variability, noise, alignment, band or artifacts. This tool does not claim a discovery." |
| 5. Limits and sources | 2:00–2:45 | "Each frame shows its date, approximate band, ID and a link to the source at IRSA. The images are limited by SPHEREx resolution and filter; they are not photometric measurements. If I query a region without comparable pairs, the tool says *insufficient coverage* or *no coverage*, and distinguishes that from a temporary failure." |

## Plan B · si falla la red o la demo

Todo material de respaldo se rotula **RESPALDO** en pantalla y en voz alta («esto es una grabación de respaldo»), y **no sustituye** la prueba real: la matriz debe seguir indicando qué se comprobó en vivo.

| Qué | Contenido | Dónde vive | Enlace |
| --- | --- | --- | --- |
| Grabación RESPALDO de la comparación real | El recorrido completo con el caso real del bloque 2–5, con el SHA visible. | **Fuera de Git** (no subir vídeos al repositorio). | **TODO: enlace** |
| Capturas RESPALDO | Resultado `ready` (A y B), panel de procedencia con IDs y fuentes, estado de cobertura insuficiente o sin cobertura, y un fallo temporal. | **Fuera de Git** | **TODO: enlace** |
| Registro de IDs y fechas del caso | Texto con IDs, fechas UTC, banda y enlaces del caso, copiado de la matriz de César. | `docs/entrega/` o hoja del equipo | **TODO** |

Orden de contingencia (de la guía §10.4): 1) si cae IRSA, mostrar el caso preparado exacto con su fecha y procedencia; 2) si cae el navegador o el visor, grabación/capturas RESPALDO con los IDs; 3) si falla AWS, escalar a Isaac y usar la alternativa aprobada o presentar el estado parcial. **TODO: confirmar con Isaac cuál es el respaldo estable de la demo.**

## Checklist de revisión

Cada revisor marca con fecha, el SHA evaluado y observaciones. Nadie da por hecho un punto que no vio.

**Santiago · vínculos e interacción**
- [ ] Todos los enlaces de la presentación y de la UI abren, en incógnito.
- [ ] Los controles que se enseñan (campos, Comparar, A/B, Play/Pausa) funcionan con ratón y teclado.
- [ ] El guion usa los nombres reales de los controles de la UI.
- [ ] Revisó permisos de acceso en incógnito (§10.3).

**Alexis · texto científico y qué se promete**
- [ ] Lo que se dice en «Qué se observa» está validado; no se afirman movimientos ni variaciones sin validar.
- [ ] Banda, campo y UTC se explican correctamente.
- [ ] El discurso no promete un hallazgo ni cobertura general; los límites están dichos.
- [ ] Citas y reconocimiento de IRSA presentes (DR1/QR3 sólo si se usaron).

**Isaac · recorrido técnico y SHA**
- [ ] La URL de la demo y el SHA desplegado coinciden con el SHA que se muestra y se registra.
- [ ] El recorrido se repite desde una red externa y en incógnito.
- [ ] El respaldo (preparado exacto con IRSA caído) está identificado y probado.
- [ ] El build público no muestra «Datos de prueba» ni fixtures.

**César · datos (para cerrar los TODO)**
- [ ] Confirma el caso, coordenadas, fechas, IDs, banda y enlaces de la tabla «Datos del caso».

## Envío

El envío lo hace el **titular de equipo autorizado**; Quintero prepara y acompaña, pero **no presupone tener permiso de enviar**.

| Campo | Valor |
| --- | --- |
| Titular autorizado que envía | **TODO: nombre** |
| Fecha y hora del envío (hora local) | **TODO** (confirmar cierre local con la sede; la plataforma publica el domingo 15 a las 23:59 hora local, pero el cierre de la sede se confirma aparte) |
| Material enviado y versión | **TODO**: URL, SHA, repositorio, vídeo o presentación |
| Dónde se registra la confirmación | **TODO**: Issue de GitHub / hoja del equipo (enlace) |
| Constancia de envío | **TODO**: captura o correo, guardados fuera de Git |

Antes de enviar: revisar permisos de la URL y el material en incógnito, README con pasos reproducibles, atribuciones y registro de herramientas de IA según el evento (§10.3), y que la demo corresponda al SHA registrado.
