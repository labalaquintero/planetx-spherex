# Planet X / SPHEREx · Contexto general del equipo

**Versión 1.0 · 14 de noviembre de 2026 · Plan de implementación, no informe de avance.**  
**Equipo:** Alexis, Isaac, DeValle, Santiago, Quintero y César.  
**Repositorio esperado:** `planetx-spherex`. Isaac confirma el enlace y la rama base. Las rutas nuevas de este documento son el mapa de trabajo acordado para iniciar; no se supone que ya existan.

> **Decisión de MVP:** cualquier visitante puede introducir RA y Dec, abrir una región del cielo y alternar o reproducir al menos dos observaciones reales de SPHEREx de la misma zona, con fechas, procedencia y límites visibles. La plataforma de reportes del borrador queda como continuación de ese flujo.

**Empieza por aquí:** lee §1–2 para entender qué se construye, §3–5 para conocer el acuerdo técnico y §6–7 antes de tocar archivos. Abre solo el perfil que te corresponde: [Alexis](roles/01_Alexis.md) · [Isaac](roles/02_Isaac.md) · [DeValle](roles/03_DeValle.md) · [Santiago](roles/04_Santiago.md) · [Quintero](roles/05_Quintero.md) · [César](roles/06_Cesar.md).

## 1. Problema, idea pulida y origen de las decisiones

SPHEREx produce observaciones infrarrojas del cielo. Para una persona sin experiencia en astronomía es difícil obtener imágenes de un mismo campo y distinguir si un punto se movió, cambió de brillo o si las imágenes se ven distintas por factores de observación. Construiremos un **visor temporal de pequeñas regiones celestes**. Su pregunta guía es: *¿qué veo al compararlo en otra fecha y qué evidencia puedo consultar para entenderlo?*

El reto pide una herramienta **web pública**, con entrada de coordenadas —ascensión recta, RA, y declinación, Dec— y una **secuencia temporal** de imágenes de ese campo. También pide probar el visor con cinco objetos concretos. El PDF del equipo reproduce el reto (pp. 1–3), recoge los recursos (pp. 7–8) y describe una idea más amplia de galerías, comparación A/B, reportes, perfiles y administración (pp. 3–6). **A/B será el primer corte técnico y un modo de lectura del visor; dos imágenes fijas sin entrada de coordenadas ni reproductor no completan P0.**

**Usuario principal:** una persona curiosa o colaboradora de ciencia ciudadana. Entra sin cuenta, entiende las coordenadas mediante un ejemplo, reproduce la secuencia y puede identificar de dónde salió cada imagen. Un asesor o jurado puede repetir el mismo caso. El nombre «Planet X» identifica el reto; una detección eventual del hipotético Planeta Nueve no es el resultado prometido. Un cambio aparente puede deberse a movimiento, variabilidad, ruido, alineación, banda, saturación u otros artefactos.

| Fuente | Qué gobierna | Cómo resolver discrepancias |
| --- | --- | --- |
| Reto 2026, organización local y guía de entrega | Objetivos, recursos y reglas del evento | Los requisitos vigentes del evento tienen prioridad; Alexis anota las aclaraciones del asesor en la Issue principal. |
| `contextoinicial.pdf` | Visión del producto y detalles del diseño | Conservar cada idea en el alcance de esta entrega o en el backlog de §2. |
| Materiales previos del equipo y repo | Stack decidido; metodología y roles; estado del código | Mantener Python + FastAPI, React + pnpm y AWS. El estado real lo determina `origin/main`; las rutas propuestas se ajustan una vez con todos los dueños. |
| Este paquete | Alcance inicial, límites, contratos y trabajo paralelo | Es la referencia para el arranque. Un cambio transversal se trata por Issue; el dueño actualiza contrato y muestra en el mismo PR. |

## 2. Alcance y experiencia del usuario

### P0 · MVP demostrable

1. **Inicio y entrada.** Una sola página pública, en castellano de inicio, con nombre/logo, explicación breve, dos campos RA/Dec en grados decimales ICRS, botón **Comparar**, ejemplo y accesos a casos preparados. Validar coordenadas tanto en el navegador como en el servidor. Los botones preparados rellenan y ejecutan la misma búsqueda.
2. **Búsqueda y cobertura.** Aceptar cualquier par válido. Consultar exposiciones de IRSA para esa región con un límite de tiempo y un campo fijo de **0,10° × 0,10°**. Si hay una secuencia real previamente verificada para ese par, puede servirse indicando **Caso preparado**, su fecha de preparación y su procedencia. Que el formulario acepte coordenadas libres no implica que cada región tenga exposiciones utilizables.
3. **Comparador.** Entre **2 y 6** épocas comparables y cronológicamente ordenadas. Reproducir/pausar y avanzar/retroceder; con dos imágenes se obtiene el par A/B. Un control por posición temporal permite seleccionar imágenes disponibles; no interpolar fechas ni inventar fotogramas. Misma escala, orientación, centro, banda aproximada y ajuste de contraste para todos los fotogramas. No es un visualizador de catálogos de todo el cielo.
4. **Evidencia y claridad.** Mostrar fecha y hora observada en UTC, RA/Dec consultadas, campo, banda aproximada, datos de archivo, IDs y enlaces de origen por fotograma. Explicar en lenguaje simple qué limitan la resolución y el filtro. Un aviso indica que un cambio visible no prueba un hallazgo. Con un teclado se operan todos los controles, hay foco visible, etiquetas y estados comprensibles, sin reproducción automática y sin depender solo de colores. Vista usable en móvil.
5. **Estados y confianza.** Diferenciar cargando, resultado listo, sin cobertura, cobertura insuficiente y fallo temporal. Si solo hay una imagen válida, se puede ver individualmente sin habilitar la reproducción. No presentar imágenes de muestra como NASA, una descarga fallida como ausencia de datos ni una candidata fuera de banda como comparable.
6. **Prueba pública.** Publicar una URL navegable sin cuenta en HTTPS, con una secuencia real reproducible incluso si IRSA falla para ese caso preparado. Intentar los cinco objetos del reto y registrar resultados reales, incluidos los negativos. P0 completo requiere una prueba real entrando coordenadas manualmente y una consulta del flujo general, además del ejemplo preparado: si el flujo general no se logra, declarar la cobertura limitada de la demo.

**Recorrido para la demo:** abrir la URL en incógnito → introducir RA/Dec o elegir un ejemplo → cargar → alternar A/B o reproducir → leer fechas, banda y procedencia → mostrar un estado de cobertura insuficiente o explicar un límite verificado.

### Después de P0 · preservar la visión del PDF

| Orden | Parte del borrador que se conserva | Decisión |
| --- | --- | --- |
| P1, solo tras validar P0 | **Ficha de observación local** como primer botón «Preparar reporte» al pie del comparador | Autor o alias explícito, título, notas y fecha automática; asociar región, par de imágenes, IDs, fechas, banda y fuentes. Copiar o descargar JSON/Markdown, con validación de campos vacíos y confirmación clara. Sin cuenta, envío, subida, evaluación por IA ni almacenamiento de datos personales en el servidor. |
| P1 | Navegación y galería ampliada | Mantener identidad visual común. Convertir las tarjetas de inicio, comparaciones recientes, búsqueda y galería filtrable en accesos útiles; luego vista de imagen ampliada con panel de metadatos y selección por fecha/slider. El zoom se evalúa; un recorte compartido debe conservar la coordenada y no cambiar una toma de forma independiente. |
| P2 | Reportar dentro del sitio o subir un PDF que cumpla el formato | Campos obligatorios del flujo original: autor, título, texto e imágenes o referencias a ellas; fecha automática. Añadir zoom/recorte y dibujo como **anotaciones** aparte de la captura original. Confirmación de envío o explicación de formato inválido. Definir tipos/tamaño permitidos, almacenamiento privado, controles de archivos, privacidad y atribución antes de aceptar PDFs. |
| P2 | Moderación, Blog y administración | Borrador → en revisión → aceptado/rechazado con mensaje → publicación explícita por admin. Registro de borradores y reportes del autor, filtros de calidad/abuso y revisión humana. IA opcional como apoyo; ningún rechazo o publicación automática por IA. El admin revisa, decide, publica y administra usuarios con permisos separados. |
| P2 | Cuentas, perfil y navegación completa | Correo/contraseña y roles, permisos, recuperación y privacidad; perfil público opcional, foto, insignias por aportes y ajustes. Menú expandible con Inicio, Galerías, Blog (llamado «Vlog» en un apartado del borrador), buscador y perfil. Bienvenida emergente opcional y no bloqueante; P0 usa un mensaje integrado. |
| P2 o exploración científica | Opcionales expresos del reto | Nuevas publicaciones de IRSA, 102 bandas, combinación por los seis detectores, espectros, sumar/restar épocas, campo configurable, Gaia/WISE como capas, coordenadas en URL/embeds, indicadores de contaminación más detallados. La información espectral y la calidad mínimas de P0 sí se conservan. |

**Regla de corte:** P1 entra solo si la secuencia real, los casos negativos y la URL de demo ya están verificados y todavía hay tiempo antes del congelamiento funcional, sin consumir la reserva para entregar. No crear un botón de reporte que no funcione. No abrir cuentas ni un CMS, ni integrar un LLM, como dependencia del visor.

## 3. Datos y criterio científico

**Fuente principal:** [NASA/IPAC IRSA – SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html). Consultar exposiciones individuales wide con [IRSA SIA2](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/): `spherex_dr1` y `spherex_qr3`. Juntas cubren las publicaciones actuales de esas imágenes; QR2 no se usa en búsquedas SIA2. Las colecciones `_deep` son una ampliación posible. Empezar con Data Explorer o notebooks de IRSA para obtener un par verificable; automatizar metadatos/recortes mediante el adaptador de Isaac. Un cubo integrado no reemplaza dos observaciones con fechas independientes.

1. **Identificar candidatos.** Buscar espacialmente la región y deduplicar por observación, no por nombre de descarga o publicación. Priorizar épocas bien separadas cuando haya opciones comparables; documentar la separación efectiva y evitar presentar repeticiones de la misma visita como evidencia de un cambio a largo plazo. Conservar UTC de la exposición y referencias originales del archivo. Consultar solo URLs permitidas de IRSA, con límites de cantidad, tamaño, tiempo y concurrencia; sin aceptar URLs de usuarios.
2. **Validar recortes.** Obtener MEF/FITS pequeños mediante el servicio de recortes. Revisar capas de imagen y calidad (como `FLAGS`) según [la documentación de productos](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/). Excluir píxeles inválidos, no finitos y los flags que Alexis documente. Un hueco en la imagen se distingue de una intensidad de cero.
3. **Comparar en la misma banda.** El filtro varía con la posición del píxel. Revisar la longitud de onda efectiva y el ancho en la región (`WCS-WAVE` para visualización). No basta que coincida el detector. Elegir un solo grupo documentado de banda aproximada por secuencia, usando solapamiento y tolerancia fundada en el ancho de los recortes. Guardar la regla y la tolerancia efectiva; si no existe grupo comparable, responder `no_common_band`. Para mediciones científicas futuras, IRSA remite a `CWAVE` y `CBAND`.
4. **Alinear y renderizar.** Usar WCS celeste en una cuadrícula común centrada en la coordenada, con norte arriba y este a la izquierda, sin mover el centro entre tomas. Probar que la orientación y correspondencia de un punto de referencia se conservan. Trabajo inicial: rejilla cuadrada de **64 × 64 píxeles** (parámetro interno); un mismo rango de contraste derivado de píxeles válidos comparables y una escala de visualización común. No interpretar PNGs como medición fotométrica ni realzar cada época independientemente.
5. **Publicar con procedencia.** Guardar o servir PNGs derivados y metadatos con fecha de observación, centro, banda, máscara/cobertura, algoritmo/versión, fecha de preparación, ID y enlace de cada fuente. Guardar FITS/PNG de producción en storage, no en Git. Revisar que el visor y el README distingan datos reales, preparados y ejemplos sintéticos. Si se usa DR1 Spectral Images, citar [10.26131/IRSA678](https://doi.org/10.26131/IRSA678); para QR3, [10.26131/IRSA662](https://doi.org/10.26131/IRSA662). Añadir el [reconocimiento solicitado por IRSA](https://irsa.ipac.caltech.edu/Missions/spherex.html) en README/entrega. Citar solo los productos realmente utilizados.

| Caso pedido por el reto | Para qué sirve | Estado inicial |
| --- | --- | --- |
| Estrella de Barnard | Ejercitar la comparación de una fuente de movimiento propio | Pendiente; resolver coordenada, referencia y época. |
| Epsilon Indi B (par de enanas marrones) | Ejercitar búsqueda del componente correcto; no prometer que se resuelva el par | Pendiente; documentar catálogo/componente usado. |
| WISE 0855 | Reproducir la posición indicada en el reto: `08h55m10.831s, −07°14′42.53″` | Pendiente; convertir a grados ICRS y verificar con Astropy antes de integrar un preset. |
| RW Aurigae | Probar una variable y distinguir brillo de desplazamiento | Pendiente; resolver coordenada y cobertura. |
| R Draconis | Segundo caso de estrella variable | Pendiente; resolver coordenada y cobertura. |

César registra para cada intento coordenadas, fuente de posición, ventana o fechas disponibles, banda, Nº de candidatos/útiles, estado, razón, IDs, referencia de recorte y commit probado. Usar **verificado**, **sin cobertura**, **insuficiente**, **fallo de servicio** o **pendiente**, con evidencia. La ausencia de un desplazamiento visible no es error por sí sola. Si ningún objeto sirve para una secuencia verificable, consultar al asesor y elegir otro campo real para demostrar el método; mantener los cinco resultados tal como se obtuvieron.

## 4. Stack, arquitectura y atajos que conservan el producto

| Capa | Decisión del equipo | Uso en esta entrega |
| --- | --- | --- |
| Interfaz | React, TypeScript, Vite, Node 24, **pnpm**; TanStack Query, Tailwind CSS, shadcn/ui y Aladin Lite v3 en el stack | Comparador PNG y controles propios como mínimo. Usar TanStack Query y los estilos/componentes si ya están preparados o aceleran el trabajo. Aladin Lite entra si ayuda a ubicar el campo sin bloquear la secuencia. El visor no necesita cargar FITS en el navegador. En un mismo despliegue, UI y API se acceden por el mismo origen. |
| Ciencia | Python 3.12/3.13, Astropy, NumPy, reproject y Pillow para la preparación cuando se necesiten; PyVO como cliente SIA2 previsto (Astroquery si se justifica); notebooks/Jupyter para exploración | FITS/WCS, tiempos, control de calidad y recortes homologados. Usar una sola ruta de descubrimiento primero. No añadir IA ni procesamiento distribuido por volumen de catálogo. |
| API | Python, FastAPI, Pydantic, Uvicorn, OpenAPI; HTTPX o el cliente IRSA elegido, boto3 para integrar S3 | Validar consultas, resolver preparado/IRSA, ejecutar el procesamiento con límites, publicar el contrato JSON y acceder a productos PNG. Mantener `GET /api/health`. |
| Catálogo y datos | PostgreSQL, SQLAlchemy, Alembic, psycopg; archivos en S3 Datos | Primero manifiesto JSON reproducible de los casos preparados mediante interfaz de lectura. PostgreSQL local y RDS pueden reemplazar la implementación si aportan al P0 y están probados. No son requisito del contrato HTTP; no guardar bytes FITS en PostgreSQL. |
| Local y calidad | Git/GitHub, VS Code, Docker + Compose si está definido; pytest, Vitest/Testing Library y Playwright | Clon por persona. API/Web nativos sirven para el primer corte; Compose agrega servicios de integración. Probar con fixtures pequeños, luego contra recortes reales. CI no debe depender de llamadas a IRSA ni usar credenciales AWS para PRs. |
| Publicación | CloudFront, S3 Web (OAC), ECS Fargate tras ALB, ECR, ACM, GitHub Actions, S3 Datos; RDS cuando aplique | S3 Web entrega `dist/` por HTTPS con el origen privado; CloudFront dirige `/api/*` al ALB/FastAPI. S3 Datos se mantiene separado. Publicar primero los PNG y luego el manifiesto que los referencia; distinguir producto faltante de un campo sin datos. Isaac valida permisos mínimos, TLS/orígenes, logs CloudWatch, health checks y recuperación. Confirmar disponibilidad de la cuenta, región, DNS/certificados y gasto antes de crear recursos. |

~~~mermaid
flowchart TD
    U["Visitante: navegador"] --> C["CloudFront: HTTPS"]
    C --> W["S3 Web: React"]
    C --> A["ALB y FastAPI en ECS"]
    A --> D["S3 Datos: manifiestos e imágenes"]
    A --> I["IRSA: exposiciones y recortes"]
    A -. "Si se activa" .-> P["RDS: catálogo"]
~~~

**Orden de ejecución del servicio:** validar coordenada → buscar manifiesto preparado del par exacto → si no existe y está habilitado, consultar ambas colecciones de IRSA → filtrar/recortar/procesar en tiempo acotado → devolver los PNG y metadatos. El modo preparado conserva sus motivos y timestamps. Los PNG deben estar disponibles desde las tareas que sirven la API: en AWS, S3 Datos; localmente, directorio de productos ignorado por Git. Si la publicación de AWS no sale a tiempo, Isaac documenta y usa una alternativa pública aprobada para la demo; si solo hay vídeo o demo local, declarar que la URL pública no quedó lista. **P0 no depende de crear cuentas, RDS, workers, Redis, IA ni un pipeline masivo. Celery/SQS y Terraform quedan como opciones del stack para cuando exista una necesidad medida, no como instalaciones obligatorias.**

**Límites de operación para empezar, ajustables con evidencia:** máximo 6 fotogramas; ordenar/acotar candidatos y no descargar el barrido completo; presupuesto inicial de 20 s para intento en vivo y 2 s de objetivo para la respuesta JSON de caso preparado. Medir tiempos reales y cantidad de FITS; si hay un corte técnico, devolver un error temporal o advertencia según §5. Probar en una conexión fuera de la red del equipo antes de la entrega.

## 5. Contratos para que los módulos puedan trabajar separados

**Referencia v0.1 para F01.** Alexis materializa la especificación en `docs/contratos/comparacion-v1.md` y los JSON canónicos en `web/src/contracts/fixtures/`. Los responsables alinean sus módulos con esta versión en H0. El JSON de abajo es adrede sintético y puede usarse en cualquier prueba local; **no** es una captura ni una respuesta real de la misión.

**HTTP**

| Petición | Resultado | Regla |
| --- | --- | --- |
| `GET /api/health` | `200 {"status":"ok"}` | Estado básico del proceso. La comprobación de la demo se hace aparte. |
| `GET /api/v1/comparisons?ra_deg=10.25&dec_deg=-12.5` | `200` con estado y fotogramas | Grados decimales ICRS finitos; `0 ≤ ra_deg < 360`, `−90 ≤ dec_deg ≤ 90`. Aceptar punto decimal; la UI puede orientar sobre la conversión desde horas/minutos. Usar el mismo centro devuelto para todas las imágenes. |
| Misma comparación con un valor faltante o inválido | `422` `invalid_coordinates` | Forma de error: `{"error":{"code":"invalid_coordinates","message":"…"}}`. Tratar NaN/Infinity, campos vacíos y valores fuera de rango. |
| Comparación que no puede terminar por fallo externo o por tiempo | `503` `archive_unavailable` o `query_timeout` | Si existe respaldo real de esa misma coordenada, responder preparado. El error es reintentable; no devolver un falso `no_coverage`. |
| `GET /api/v1/images/{frame_id}` | `200 image/png` o `404` `image_not_found` | Solo IDs emitidos y validados; resolver objetos internos, no rutas o URLs que mande el cliente. |
| Error propio inesperado | `500` `internal_error` | Mensaje público breve, diagnóstico en logs internos. |

| Estado del `200` | `reason` | Regla de datos y UX |
| --- | --- | --- |
| `ready` | `null` | 2–6 versiones cronológicas de **fechas/instantes de observación distintos**; misma banda aproximada. Reproductor habilitado. |
| `insufficient` | `single_epoch`, `no_common_band`, `no_usable_frames` o `search_limit_reached` | Como máximo 1 fotograma cuando se pudo validar uno; si no, lista vacía. Sin reproducción. Explicar la razón. |
| `no_coverage` | `no_observations` | Lista vacía: tras una consulta espacial que terminó sin observaciones para el ámbito consultado. No afirmar ausencia global. |

**Semántica compartida.** `query.fov_deg` es el lado del cuadrado; `band` contiene el centro elegido y la tolerancia usada (µm, números positivos), o `null` si no se presenta ningún fotograma. `mode` es `live` o `prepared` en un resultado público; `fixture` se permite solo en dev/pruebas. `checked_at` es la fecha UTC de comprobación o preparación; `observed_at` siempre es la fecha UTC de la exposición. `release` es `dr1` o `qr3` (o `fixture` solo en pruebas); `source_url` apunta a un registro/archivo comprobable de IRSA y solo es `null` en mocks. `quality_flags` es una lista de avisos del producto, vacía si no aplica. `warnings` contiene códigos no bloqueantes acordados; empezar con `search_limit_reached` cuando ya hay par válido, pero se recortó la búsqueda. `image_url` es una ruta del mismo origen. IDs de fotogramas identifican el PNG derivado: incluir en su identidad el recorte y la escala/versión de render, porque un mismo FITS puede producir imágenes distintas. No reciclar IDs con otros bytes. Para replay exacto, usar el par numérico y los parámetros/versión de preparación, sin sustituir observaciones de coordenadas vecinas.

~~~json
{
  "schema_version": "1",
  "status": "ready",
  "reason": null,
  "mode": "fixture",
  "query": {"ra_deg": 10.25, "dec_deg": -12.5, "frame": "ICRS", "fov_deg": 0.1},
  "band": {"center_um": 1.25, "tolerance_um": 0.02},
  "checked_at": "2026-11-14T12:00:00Z",
  "science_version": "v1",
  "warnings": [],
  "frames": [
    {
      "id": "fixture-a",
      "observed_at": "2026-01-05T00:00:00Z",
      "release": "fixture",
      "observation_id": "fixture-obs-a",
      "source_url": null,
      "image_url": "/api/v1/images/fixture-a",
      "quality_flags": []
    },
    {
      "id": "fixture-b",
      "observed_at": "2026-07-05T00:00:00Z",
      "release": "fixture",
      "observation_id": "fixture-obs-b",
      "source_url": null,
      "image_url": "/api/v1/images/fixture-b",
      "quality_flags": []
    }
  ]
}
~~~

En F01 guardar cuatro fixtures: `comparacion-ready.json`, `comparacion-insufficient.json`, `comparacion-no-coverage.json` y `comparacion-error-503.json`. Alexis los mantiene; Santiago y Quintero pueden interceptar esas rutas o inyectar el cliente local. Los gráficos falsos se distinguen con etiqueta «Datos de prueba» y se conectan solo en dev/test. Lo que el test acepte en un fixture nunca reemplaza una prueba pública real.

**Handoffs internos.** Las firmas siguientes nombran las fronteras y sus resultados; acordar con sus dueños en F01 antes de mover módulos.

| Productor → consumidor | Frontera y dato compartido | Arranque sin depender de otro merge |
| --- | --- | --- |
| Isaac → Alexis | Adaptador IRSA entrega recortes locales + {`observation_id`, `release`, `source_url`, `local_path`}. Ciencia obtiene tiempo, banda y calidad de los productos. | Alexis baja una muestra pequeña con Data Explorer; Isaac prueba el transporte con metadatos simulados. |
| Alexis → Isaac | `planetx.science.build_sequence()` recibe centro, campo y recortes con procedencia; entrega resultado científico + mapa `frame_id → PNG bytes`. El servicio añade modo y maneja storage/API. | Isaac inyecta resultado fijo; Alexis prueba procesamiento local con pytest. |
| DeValle → Isaac y César | `planetx.catalog.get_prepared()` recibe centro, campo y versión; devuelve payload `prepared` compatible o `None`. Manifiesto por región + objetos referenciados; si hay BD, conserva la misma frontera. | DeValle usa manifiesto local; Isaac define un stub. César escribe consultas de control, no migraciones. |
| Isaac → Santiago y Quintero | Rutas HTTP y errores de arriba; la UI se conecta al proxy, no directamente a IRSA/S3. | JSON canónico y recursos sintéticos en desarrollo o interceptados por Playwright. |
| Santiago ↔ DeValle/César | Integración opcional de `ObservationDetails` y `DataNotice`, por props y en rutas propias; es suficiente empezar con metadatos/avisos en la pantalla de Santiago. | Los dos componentes se prueban con props simuladas; Santiago es el único que los monta en el recorrido. Sin duplicar la pantalla. |
| César y Quintero → equipo | Matriz verificable de datos y criterios de aceptación visibles. | César valida formato/observaciones; Quintero recorre entrada, reproducción y estados con mocks, luego ambos validan la misma URL y el mismo SHA real. |

Subir un cambio de contrato exige Issue, ejemplo de antes/después y aprobación de quien produce y quien consume. Alexis actualiza la especificación y el JSON; cada dueño adapta **sus** archivos. No se hace un cambio silencioso de unidad, nombre, fecha, estado ni alcance.


## 6. Dueños de archivos y límites para asistentes de IA

Los patrones siguientes son **permisos máximos**, no una lista de archivos que deban crearse todos hoy. Una Issue reduce el permiso a los archivos necesarios para su tarea. Se puede consultar el código de todos; solo se puede modificar, mover o borrar lo explícitamente asignado. Los directorios entre filas son disjuntos. Una ruta no listada se reserva hasta que el equipo le ponga dueño.

| Dueño y rama sugerida | Archivos que puede escribir para su tarea | Revisores y relación |
| --- | --- | --- |
| **Alexis** · `alexis/f01-ciencia` | `docs/contexto/**`, `docs/contratos/**`, `docs/decisiones/**`, `api/planetx/science/**`, `api/tests/science/**`, `web/src/contracts/fixtures/**` | Isaac revisa interfaces/operación; César comprueba ciencia y procedencia; Santiago revisa contrato de consumo. |
| **Isaac** · `isaac/f01-api` | `AGENTS.md`, `README.md`, `.gitignore`, `.gitattributes`, `.env.example`, `compose.yaml`, `.github/**`, `infra/**`, `tools/check_role_paths.py`, `api/app.py`, `api/Dockerfile`, `api/requirements.txt`, `api/pytest.ini`, `api/planetx/__init__.py`, `api/planetx/http/**`, `api/planetx/irsa/**`, `api/tests/http/**` | Alexis revisa contrato; DeValle revisa catálogo/conexión; Quintero ensaya y revisa recuperación y acceso. |
| **DeValle** · `devalle/f01-catalogo` | `api/planetx/catalog/**`, `api/migrations/**`, `api/alembic.ini`, `api/tests/catalog/**`, `docs/datos/modelo/**`, `web/src/features/observation-details/**` | Isaac prueba el lector; César revisa consultas y datos; Santiago revisa props si entra el panel. |
| **Santiago** · `santiago/f01-visor` | `web/src/{App.tsx,App.css,main.tsx,index.css}`, `web/src/app/**`, `web/src/components/**`, `web/src/shared/**`, `web/src/features/viewer/**`, `web/src/test/**`, `web/public/**`, `web/{package.json,pnpm-lock.yaml,index.html,vite.config.ts,README.md,.gitignore,.oxlintrc.json}`, `web/tsconfig*.json`, `web/eslint.config.*` | Quintero valida UX; Isaac verifica proxy/origen; DeValle y César proponen mejoras en sus carpetas. Sin programación backend. |
| **Quintero** · `quintero/f01-aceptacion` | `web/e2e/**`, `web/playwright.config.ts`, `docs/qa/aceptacion/**`, `docs/entrega/**` | César aporta matriz; Santiago revisa selectores/recorrido; Isaac enseña y mantiene el procedimiento de despliegue. |
| **César** · `cesar/f01-calidad-datos` | `docs/qa/datos/**`, `fixtures/data_qa/**`, `api/tests/data_qa/**`, `web/src/features/data-notice/**` | Alexis revisa criterio; DeValle valida esquema/consultas; Santiago revisa aviso UX; Quintero coteja aceptación. |

Las llaves en la tabla agrupan nombres explícitos, no autorizan toda la carpeta. **Archivos compartidos con un solo escritor:** Alexis: contratos, sus fixtures y decisiones; Isaac: arranque/API raíz, dependencias Python, infraestructura, CI y reglas Git; Santiago: entrada y configuración web, dependencias y lockfile pnpm. Si una dependencia nueva es imprescindible, se solicita al dueño con uso, prueba y versión; él cambia su manifiesto. El dueño de cada fixture lo publica, los demás lo consumen.

**Desde la primera Issue**

1. Isaac confirma el repo, el commit/base autorizado y las rutas reales que ya existen. Alexis publica este acuerdo en `docs/contexto/` si el equipo lo acepta. Si un alias o archivo no coincide, se corrige el mapa una vez antes de abrir PRs. El mapa no obliga a reorganizar lo ya funcional.
2. Cada persona usa su propio **clon**, su propia rama, su `.venv` y su base local si la necesita; ninguna IA apunta a un clon compartido de escritura. En una sola máquina, si se requiere más de una sesión que escriba, usar **un worktree y rama distintos por tarea**, cada uno con sus dependencias locales y puertos separados si se ejecutan al mismo tiempo. No abrir dos asistentes con escritura sobre el mismo worktree.
3. Dar a la IA este archivo, solo el perfil correspondiente, la Issue, el estado de Git y el contrato v1. Pedir primero archivos previstos y prueba. Si su herramienta permite restringir rutas, configurarlas para esa sesión; en caso contrario, usa modo lectura hasta revisar el plan y luego revisa el diff. Una instrucción en Markdown no concede ni impide permisos.
4. Si el cambio necesita un archivo ajeno, **no tocarlo**. Proponer en la Issue el archivo, el cambio mínimo y la interfaz; seguir con un mock o pedir un PR corto al dueño. Cuando dos ramas necesiten tocar una misma ruta, el dueño integra una de ellas primero. Un relevo por ausencia se anota con una única persona temporal y la otra pausa sus escrituras en esa ruta.
5. Al terminar, revisar cambios frente a la base, incluidos archivos sin seguimiento. Añadir archivos concretos; no ejecutar formateos de todo el repo, borrados, `git add .` ni comandos que reescriban historial para «arreglar» conflictos. Si ya había cambios ajenos, preservarlos y avisar; no revertir ni archivarlos automáticamente.
6. Isaac configura PR obligatoria, revisión por dueño y CI cuando el repositorio lo permita. `CODEOWNERS` pide revisiones; para bloquear la fusión se exige la revisión con una regla de rama. Añadir un chequeo de rutas a CI y usarlo localmente (ver [perfil de Isaac](roles/02_Isaac.md)); hasta que exista, comprobar las rutas manualmente en cada PR. Un prefijo de rama por sí solo no autoriza escritura. Los administradores y accesos AWS se limitan a quienes los necesitan.

**Prompt común para un asistente**

> Lee `docs/contexto/00_Contexto_General.md`, solo mi perfil y la Issue indicada. Si el paquete está fuera del repo, léelos en las rutas que te dé. Antes de editar, muestra propósito, archivos, contrato afectado y prueba. Tienes acceso de escritura solo a las rutas de mi Issue dentro de mi perfil. Puedes leer otras rutas. Si falta un contrato, usa el fixture; si necesitas una ruta ajena, deja una propuesta y espera al dueño de esa ruta. No cambies versiones, locks, configuración, datos reales, migraciones, ramas ni archivos compartidos fuera de lo asignado. Conserva cambios preexistentes. Al terminar, lista archivos cambiados, pruebas ejecutadas, límites y handoff. No hagas push, merge, despliegues ni publiques datos por tu cuenta.

## 7. Arranque por máquina y Git

**Lo visto en los mensajes:** Alexis trabajó en `E:\dev\PlanetX\planetx-spherex`; se vieron staging de `api/app.py`, `api/requirements.txt`, `web/vite.config.ts` y `web/pnpm-lock.yaml`, y se instaló Python 3.13 en una `.venv`. El endpoint de arranque acordado es `/api/health`. La fusión del PR, el remoto, los instaladores del resto y cualquier despliegue siguen sin comprobar. `PlanetX_Verificacion` era un laboratorio independiente; no copiar su entorno, mover su Git ni usarlo como repositorio oficial. Isaac verifica con la organización el uso de código de preparación previo al evento antes de traerlo a la rama de competencia.

### 7.1 Clonar o verificar el clon y abrir la rama

En un directorio de trabajo propio, reemplaza el texto de la URL por el enlace que confirme Isaac. Si ya tienes clon, entra ahí y empieza por `git status -sb`. Si hay cambios que no reconoces, para antes de cambiar de rama.

~~~bash
git clone "URL_REAL_CONFIRMADA_POR_ISAAC" planetx-spherex
cd planetx-spherex
git status -sb
git remote -v
git fetch origin
git branch -r
# Solo si origin/main es la base confirmada. Sustituye por la rama de tu fila:
git switch -c alexis/f01-ciencia origin/main
~~~

Alternativa con una segunda sesión local, desde un clon sin tocar la rama de otro. Solo crear una rama a la vez:

~~~bash
git fetch origin
git worktree add -b alexis/f01-aux ../planetx-alexis-aux origin/main
~~~

### 7.2 Dependencias y verificación mínima

Común a todos: `git --version`, `code --version` y acceso al repo/Project. Comprobar las versiones reales del proyecto antes de instalar: la guía del lab usó Node 24 desde 24.15 y pnpm 10.34.9; el campo `packageManager` y el lockfile del repo definen lo que se ejecuta ahora. La máquina puede necesitar solo frontend o solo Python según el perfil. En PowerShell, pegar los comandos en el orden mostrado.

**Windows · PowerShell · API** — solo desde la raíz con `api/requirements.txt` disponible y usando la versión Python acordada (ejemplo 3.13).

~~~powershell
py -3.13 --version
py -3.13 -m venv .venv
Test-Path .\.venv\Scripts\python.exe
.\.venv\Scripts\python.exe -m pip --version
.\.venv\Scripts\python.exe -m pip install -r .\api\requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m uvicorn app:app --app-dir api --host 127.0.0.1 --port 8000
~~~

En otra terminal: `Invoke-RestMethod http://127.0.0.1:8000/api/health`. Si falta el ejecutable de `.venv`, crearlo antes de instalar; no se necesita activar scripts de PowerShell.

**Linux · bash · API** — comprobar primero el intérprete seleccionado; en una distro con paquete `venv` separado, usar el que corresponde a ese intérprete.

~~~bash
python3 --version
python3 -m venv .venv
test -x .venv/bin/python
.venv/bin/python -m pip --version
.venv/bin/python -m pip install -r api/requirements.txt
.venv/bin/python -m pip check
.venv/bin/python -m uvicorn app:app --app-dir api --host 127.0.0.1 --port 8000
~~~

En otra terminal: `curl -fsS http://127.0.0.1:8000/api/health`.

**Windows o Linux · Web** — desde la raíz con `web/package.json` y `web/pnpm-lock.yaml`.

~~~bash
node --version
pnpm --version
pnpm --dir web install --frozen-lockfile
pnpm --dir web run
pnpm --dir web dev
~~~

Abrir `http://localhost:5173` o el puerto que indique Vite. Con el proxy API configurado, confirmar `http://localhost:5173/api/health` y comprobar el flujo real cuando estén los routers. Si falla el lockfile, Santiago verifica los dos archivos y versiones; no regenerarlo por cuenta propia. Si PowerShell bloquea el lanzador de pnpm, comprobar `Get-Command pnpm -All` y usar el ejecutable oficial disponible o `pnpm.cmd` si está instalado.

**Capas adicionales, solo donde aplique:** `docker version` y `docker compose version`; si existe `compose.yaml`, `docker compose config --quiet` y `docker compose ps`. Probar `pg_isready` o `SELECT 1` con el servicio y conexión configurados, no asumir el puerto del lab; las instalaciones opcionales de psql/cliente no sustituyen la comprobación de conexión. Con Playwright ya añadido al proyecto: `pnpm --dir web exec playwright install chromium` y las pruebas de §9. En AWS, solo operadores autorizados: `aws --version` y comprobar perfil/identidad por su sesión autorizada; no copiar resultados sensibles a las Issues. Revisar los archivos existentes antes de correr comandos de migración o de configurar infraestructura.

**Revisión antes de pedir merge** (PowerShell o bash, desde la raíz; `q` sale del visor de Git si se abrió sin `--no-pager`):

~~~bash
git status --short
git --no-pager diff --name-status --no-renames
git --no-pager diff --cached --name-status --no-renames
git --no-pager diff --name-status --no-renames origin/main...HEAD
git --no-pager diff --check
git --no-pager diff --cached --check
~~~

Revisa también las rutas `??` de `git status --short`. Después usa `git add --` seguido de archivos explícitos y abre PR contra la base confirmada. Cada commit cuenta lo que cambió; la PR enlaza Issue, paths, versión de contrato, pruebas y evidencia. Eliminar o renombrar un archivo ajeno también queda fuera de alcance. No subir `.env`, credenciales, claves, `.venv`, `node_modules`, artefactos de pruebas ni productos grandes FITS/PNG. Un cambio de dependencia se integra junto con su lock o requirements.

## 8. Método, tablero y secuencia de trabajo

**Kanban con entregas por recorrido.** GitHub Issues + Projects es la fuente de verdad; PR + Actions, donde se revisa el código. Usar el canal de texto/voz acordado (Discord es la propuesta previa; basta un canal de equipo, uno de bloqueos, uno de entregas y voz). Transcribir acuerdos al ticket. Santiago mantiene las vistas **Funciones** y **Subtareas**; cada autor mueve su tarjeta.

**Estados:** Por priorizar → Lista → En curso → En validación → Hecha. Una función tiene una Issue principal con resultado de usuario y subtareas de 30–90 min. Hay una subtarea de implementación activa por persona y hasta dos funciones abiertas en todo el equipo, incluyendo las bloqueadas y en validación. Terminar/revisar la función actual cuenta más que abrir otra. Cualquier espera técnica tiene un mock o una tarea inmediata útil para no perder tiempo.

| Corte | Objetivo y participantes | Evidencia que permite avanzar |
| --- | --- | --- |
| **H0–H0+30 min** | Alinear reglas y repo/base; abrir F01 y sus seis subtareas; confirmar dueño, revisor, versión de contrato y respaldo por persona. | Check de cada máquina, muestra copiable y decisiones registradas. |
| **F01 · primer corte, objetivo H0+2 h** | Alexis asegura coherencia del par; Isaac da la API mínima; DeValle prepara lectura; Santiago muestra A/B; César describe datos; Quintero realiza aceptación. Integrar temprano aunque la primera conexión sea con fixture. | Un navegador alterna A/B y comprueba los campos. Si solo usa fixture, es F01 técnico parcial, no aceptación científica. |
| **F01 real · objetivo H0+4 h** | Sustituir fixture por par auténtico validado y el lector preparado. Probar estado insuficiente/fallo externo y revisar desde máquinas distintas. | Par con IDs, fechas, fuentes, pruebas y SHA; respaldo de demo identificado. |
| **F02 · después de F01** | Búsqueda de coordenadas libres en IRSA, reproductor completo, cinco intentos registrados, URL de prueba y revisión de accesibilidad. Reutilizar contrato y componentes de F01. | Caso preparado y consulta real desde el formulario, errores diferenciados y va a validación, no a otro diseño. |
| **Congelar P0 y publicar** | Cuando P0 sea estable o **T−6 h**, lo que ocurra antes; reservar el tramo final para correcciones, verificación pública, demo y envío. Si hay menos margen, recortar P1 de inmediato. | Commit/build etiquetado en Issue, ruta de recuperación y prueba en incógnito. **T−2 h**: envío/confirmación como objetivo interno, ajustado al evento local. |

**H0** es el arranque de trabajo que permita la organización. **T** es el primer cierre operativo (pitch, registro o entrega aplicable) confirmado por el equipo. La sede de Saltillo anuncia **36 h de actividad** con inicio el sábado 14 a las 09:00; las 48 h de la planeación antigua no son el reloj local. La plataforma 2026 publica el domingo 15 a las 23:59 **hora local** como cierre de su envío. Confirmar horarios de pitch y cierre local; no deducirlos de la duración anunciada.

**Check-in** de 10 minutos cada 2 h: cada persona dice qué ya puede mostrar, qué bloquea y a quién necesita. Buscar una integración de 2–4 h y hacer rotación de descansos sin dejar publicación/QA sin respaldo. **Bloqueos:** marcar y avisar al detectarlo con pasos reproducibles; a **+15 min** pedir apoyo, a **+30 min** resolver junto al dueño o pasar a stub, a **+60 min** Alexis decide recorte o alternativa con el responsable. La tarjeta bloqueada sigue contando.

**Plantilla de tarjeta:** resultado verificable → prioridad → responsable y revisor → paths y no-go → entrada/muestra → salida/criterio de aceptación → dependencia y alternativa → prueba y evidencia → estado. El PR del autor no marca la función como hecha: Quintero y César prueban el recorrido integrado, con el dueño del módulo en caso de fallo.

## 9. Validación y definición de hecho

| Capa | Qué se prueba | Responsable / evidencia |
| --- | --- | --- |
| Ciencia | Orden por instante, deduplicación, WCS y orientación, filtro de calidad, banda local y contraste común; comparar el mismo recorte de dos épocas. | Alexis + César: pytest, archivos fuente identificados y prueba visual. |
| API/datos | Health, coordenadas límite/incorrectas, dos épocas, una, ninguna, banda incompatible, límite de candidatos, timeouts, falla IRSA, mismo centro, metadatos y PNG válidos. Probar manifiesto/BD con la misma frontera, si aplica. | Isaac + DeValle + César: pytest, consultas de control y respuesta real reproducible. |
| Frontend | Entrada manual y presets, fechas y procedencia, carga y reintento, Play/Pause/A/B, teclado/foco, ancho móvil, navegación sin cuenta y etiquetas de preparado/fixture. Si llega otra consulta, descartar respuestas antiguas y detener play de la anterior. | Santiago + Quintero: Vitest si está configurado, build y Playwright/validación visual. |
| Cinco casos del reto | Se intentaron los cinco y cada resultado explica qué se vio o qué limitó la prueba. Al menos un par real reproducible. No afirmar movimientos o variaciones no validados. | César registra evidencias; Alexis valida resultados; Quintero comprueba lo que se presenta. |
| Publicación | Incógnito y red externa; que carguen web, API, PNG y fuentes; comprobar fallo cubierto por replay; par real sin CDN roto; misma versión evaluada. | Isaac + Quintero + Santiago: URL, hora, commit y evidencia. |

Con paquetes ya aprobados e instalados: Windows `.\.venv\Scripts\python.exe -m pytest api/tests` o Linux `.venv/bin/python -m pytest api/tests`; `pnpm --dir web run build`, el script unitario definido en `package.json` y `pnpm --dir web exec playwright test` si existe su config. Mientras no existan carpetas/scripts/prerrequisitos, anotar **no disponible** en lugar de indicar que una prueba pasó. La CI separa las pruebas deterministas del smoke real. El smoke real registra fecha, commit, par de coordenadas, IDs, resultados y anexo/enlace al caso.

**P0 hecho:** requisitos de §2 cumplidos, CI/revisión según la regla disponible, casos y limitaciones registradas, URL que funciona desde fuera y versión reproducible. Si falta entrada general en vivo, acceso público o un par real, documentar entrega parcial y qué sí se comprobó. No se compensa con login, galería, IA ni slides.

## 10. Reglas del evento, entrega y preguntas pendientes

1. **Eventual código previo y uso de IA.** La organización global pide no empezar el proyecto antes de la apertura. Preparación, aprendizaje y selección de recursos no equivalen a permiso para reutilizar código de competencia. Isaac y Alexis confirman con la sede qué partes de la base o lab pueden usar, conservan historial y registran herramientas de IA, dependencias y aportes externos. Tratar el código previo dudoso como material de preparación hasta que haya respuesta.
2. **Verificar condiciones oficiales de entrega.** Quintero confirma en sitio/organización la duración, los idiomas, accesos, modo de entrega y titular que envía. La orientación publicada para 2026 menciona video de hasta 30 s o hasta 7 diapositivas; usarla como preparación y comprobarla con la guía vigente. El pitch local puede tener otro formato. Preparar una versión en inglés y subtítulos en inglés si se graba en español, conforme a lo que confirme el evento.
3. **Materiales.** Título y texto del proyecto con necesidad, aporte, usuarios, cómo usa datos NASA, los cinco casos, limitaciones, stack, fuentes y versión. README con pasos reproducibles, archivo de licencia/atribuciones según los recursos y registro de herramientas según el evento; URL, repo/materiales con acceso adecuado, video o presentación y contacto de equipo si se requiere. Santiago y Quintero revisan permisos en incógnito y constancia de envío; Quintero prepara/acompaña al titular autorizado, no presupone que tiene el permiso de enviar. Isaac mantiene un respaldo estable del demo.
4. **Contingencias.** Si cae IRSA, mostrar el preparado exacto, con fecha y fuente, y la limitación. Si el visor o navegador no cooperan, llevar una captura/video de la secuencia real y los IDs; declarar qué fue respaldo. Si falla AWS, escalar y usar alternativa aprobada o mostrar el estado parcial. Si cae una prueba de ciencia, no etiquetar el caso como éxito. El README explica cómo volver a la versión probada, sin perder evidencias.
5. **Cuatro preguntas a la sede/asesor para cerrar antes de construir:** (a) ¿qué pesa más en el visor y cómo documentar casos sin cobertura? (b) ¿hay recomendación para colección, época y banda de un caso que se vea bien? (c) ¿qué preparación, código previo y herramientas de IA podemos usar y cómo se declaran? (d) ¿cuál es la hora local de pitch/cierre y el formato exacto de la entrega, con qué accesos y quién envía?

## 11. Referencias y registro

- **Reto:** [página de Planet X and SPHEREx en Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/) y [reproducción de la sede oficial de Athlone](https://hackathlone.com/challenges/planet-x-and-spherex), consultada al no responder la página central. `contextoinicial.pdf` es el borrador entregado por el equipo.
- **Organización:** [Space Apps 2026 y fechas](https://www.spaceappschallenge.org/2026/), [Saltillo](https://spaceappsaltillo.site/), [guía de envío](https://www.spaceappschallenge.org/resources/project-submission-guide), [orientación sobre trabajo previo](https://github.com/nasa/spaceapps/discussions/1827) y [aclaraciones de formato](https://github.com/nasa/spaceapps/discussions/1947). [Planeta X / Planeta Nueve, NASA](https://science.nasa.gov/solar-system/planet-x/).
- **Datos y ayuda del reto:** [IRSA SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html), [acceso y notebooks de IRSA](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/), [productos FITS y WCS](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/), [DR1](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html), [Quick Releases](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html), [Astropy](https://docs.astropy.org/), [Aladin Lite](https://aladin.cds.unistra.fr/AladinLite/). WiseView es precedente, Gaia DR3 una capa futura. Los recursos de CSA —NEOSSat, tutorial/dataset y CADC— son complementarios, no sustituyen SPHEREx; se enlazan en la pestaña de recursos del reto.
- **Material interno previo:** `PlanetX_02_Del_Problema_al_Producto.html`, `PlanetX_03_Metodologia_General.html`, `PlanetX_05_Trabajo_en_Equipo.html`, `PlanetX_06_Ejecucion_y_Entrega.html`, mapa visual, flujo visual, guía Windows/Linux y kit de verificación. [Plan de trabajo en Google Slides](https://docs.google.com/presentation/d/1QPXnBePhDv9XpxNkc4H-LUOUFP_kBCA1FFhteWjYAIo) y [preguntas a asesores](https://docs.google.com/document/d/1XKvlxC2U6VWdV3HpjPuGHhH2vwnxWLdnQoYrFwozRVw). Este contexto concreta el nuevo borrador y la ejecución; no acredita código existente ni pruebas pasadas.
- **Registro de decisiones del arranque:** repo/base autorizada; pregunta a la sede y hora T; recorte real elegido y fuente; banda/criterio y versión; entorno y alojamiento realmente disponibles; ruta del manifiesto y responsables; bloqueos y cambios de alcance. Alexis conserva decisiones en `docs/decisiones/` e Issues. Todos consultan la misma versión antes de continuar.

