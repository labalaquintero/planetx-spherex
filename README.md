# Planet X / SPHEREx

Visor web para comparar dos observaciones de una misma región del cielo y mostrar sus fechas y fuentes.

Frontend: React y TypeScript en web/.
Backend: Python y FastAPI en api/.

## Contexto para el equipo y asistentes de IA

El [contexto general](docs/contexto/00_Contexto_General.md) describe la visión, el alcance, los contratos y el plan de trabajo. El paquete incluye [seis guías por rol](docs/contexto/roles/) para Alexis, Isaac, DeValle, Santiago, Quintero y César. [AGENTS.md](AGENTS.md) indica cómo consultar este material desde un asistente.

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

   La búsqueda debe coincidir **exactamente** con el par de coordenadas del manifiesto. Un par que no esté en el catálogo
   responde `503 archive_unavailable`, porque la búsqueda en vivo en IRSA todavía no está habilitada.

5. **Parar.** `docker compose down`.

| Pieza | Imagen | Notas |
| --- | --- | --- |
| `api` | `api/Dockerfile` (Python 3.12 slim) | Uvicorn en `0.0.0.0:8000`, usuario sin privilegios, `/api/health` como healthcheck |
| `web` | `infra/web/Dockerfile` (Node 24, pnpm, nginx) | Compila `web/` y sirve `dist/`; la configuración está en `infra/web/nginx.conf` |
