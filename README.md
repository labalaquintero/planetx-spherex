# Planet X / SPHEREx

Visor web para comparar dos observaciones de una misma región del cielo y mostrar sus fechas y fuentes.

Frontend en web/: observatorio y espacio personal, con el vuelo de Explorar en React y TypeScript.
Backend: Python y FastAPI en api/.

## Contexto para el equipo y asistentes de IA

El [contexto general](docs/contexto/00_Contexto_General.md) describe la visión, el alcance, los contratos y el plan de trabajo. El paquete incluye [seis guías por rol](docs/contexto/roles/) para Alexis, Isaac, DeValle, Santiago, Quintero y César. [AGENTS.md](AGENTS.md) indica cómo consultar este material desde un asistente.

## Uso de SI

OpenAI Codex asistió en la planificación, la consulta de fuentes, el diseño de la interfaz, la implementación y las pruebas del visor, el procesamiento de datos y la documentación. La maqueta inicial del visor se creó en Google Stitch y sirvió como referencia de diseño. Claude Opus 5.5 asistió en el desarrollo del Mapa 3D y en el código de síntesis de sus efectos sonoros con Web Audio.

Los FITS de la comparación provienen del archivo NASA/IPAC IRSA. Los PNG y las diferencias de WISE 0855 y R Draconis derivan de esas observaciones mediante el procesamiento de Balax. El pie del sitio enlaza a **Uso de SI**, donde se pueden consultar los [metadatos por componente](web/public/si-usage.json).

## Ejecutar en local con Docker

Levanta el visor y la API en tu máquina. **No es un despliegue** a AWS ni a producción.

Necesitas Docker con Compose v2 (`docker compose version`).

1. **Datos.** La carpeta `data/` no se sube al repositorio (está en `.gitignore`). Crea el caso preparado así:

   ```text
   data/wise0855/manifest.json         # manifiesto del catálogo (casos preparados)
   data/wise0855/products/<id>.png     # un PNG por fotograma, nombrado con su frame_id
   ```

   Por ejemplo, si ya tienes la carpeta en otro sitio: `mkdir -p data && cp -r ~/planetx-data/wise0855 data/`.
   La API monta `./data` en `/data` **solo lectura**.

2. **Opciones (opcional).** `cp .env.example .env` y ajusta lo que necesites. Por defecto el web se publica en
   `http://localhost:80` (solo en loopback; `WEB_BIND=0.0.0.0` lo abre a tu red) y la API lee
   `PLANETX_CATALOG_MANIFEST=/data/wise0855/manifest.json` y `PLANETX_PRODUCTS_DIR=/data/wise0855/products`.

3. **Arrancar.**

   ```bash
   docker compose up --build
   ```

   Abre <http://localhost>. La API no publica puertos: nginx (servicio `web`) sirve el visor y reenvía `/api` a
   `http://api:8000`, de modo que el navegador usa siempre rutas relativas `/api`.

4. **Comprobar.**

   ```bash
   curl -fsS http://localhost/api/health
   curl -fsS "http://localhost/api/v1/comparisons?ra_deg=133.795129166667&dec_deg=-7.245147222222"
   curl -fsS -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost/api/v1/images/<frame_id>
   ```

   La búsqueda preparada coincide **exactamente** con el par de coordenadas del manifiesto. Con la configuración por
   defecto, una coordenada que no esté en el catálogo devuelve `503 archive_unavailable`.

5. **Parar.** `docker compose down`.

Para abrir **Ver diferencias** en el visor, usa el [caso preparado de comparación científica de WISE 0855](docs/decisiones/comparacion-cientifica-wise0855.md).

Para probar cuentas, fichas sincronizadas y revisión en el Blog, sigue la [guía del espacio compartido](docs/decisiones/colaboracion.md).

| Pieza | Imagen | Notas |
| --- | --- | --- |
| `api` | `api/Dockerfile` (Python 3.12 slim) | Uvicorn en `0.0.0.0:8000`, usuario sin privilegios, `/api/health` como healthcheck |
| `web` | `infra/web/Dockerfile` (Node 24, pnpm, nginx) | Compila `web/` y sirve `dist/`; la configuración está en `infra/web/nginx.conf` |

### Activar la búsqueda en vivo

Con el respaldo montado, añade `PLANETX_ENABLE_LIVE=1` a `.env` y vuelve a ejecutar `docker compose up --build`.
Para arrancar Uvicorn directamente, define la misma variable en el entorno del proceso de la API.

La API consulta primero el catálogo. Si la clave no está preparada, busca exposiciones en IRSA, procesa los recortes
y publica sus PNG mediante `/api/v1/images/{frame_id}`. Los FITS de trabajo se guardan en un directorio temporal por
consulta. El plazo HTTP es de 25 segundos y el límite predeterminado es de dos búsquedas en vivo simultáneas.
`no_coverage` corresponde a una búsqueda completa sin observaciones. Una caída de IRSA o el agotamiento del plazo
devuelven un `503` reintentable.

### Recorridos en el navegador

- **Inicio → Comparar WISE 0855.** La portada incluye la vista previa. Al abrir el visor, la API devuelve el caso preparado con los PNG, las fechas UTC y el FITS de cada época. Puedes alternar, deslizar, reproducir, usar pantalla completa o abrir una imagen para ampliarla y marcarla.
- **Galería.** Filtra los cinco campos del reto, selecciónalos en el mapa ICRS o abre su ficha y consulta sus coordenadas en el visor.
- **Ficha de observación.** Escribe un reporte o adjunta un PDF. Guarda un borrador, recupera las marcas del campo y exporta la evidencia en JSON o Markdown.
- **Mi espacio → Ajustes.** Cambia tu alias o foto y consulta tus fichas. Si habilitas el espacio compartido, puedes acceder con tu cuenta desde otro navegador. **Ver fichas de este navegador** permite recuperar los borradores locales.
- **Blog y Revisión.** Lee las guías y las observaciones publicadas. La bandeja de revisión del pie de página usa cuentas con permisos si el espacio compartido está habilitado.
- **Mapa → Sector β.** Selecciona el sector y prueba el vuelo con `W`, `A`, `S` y `D`, o con los controles táctiles.
