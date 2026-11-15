# infra

| Carpeta | Qué es |
| --- | --- |
| `web/` | Imagen del visor: compila `web/` y lo sirve con nginx (`compose.yaml`). |
| `caddy/` | `Caddyfile` del proxy HTTPS de producción (`compose.prod.yaml`). |

## HTTPS en la EC2 de la demo (balax.me)

Solo en la instancia de la demo, `compose.prod.yaml` añade **Caddy** delante de `web`.

- **Dominio:** `https://balax.me` y `https://www.balax.me`, con certificado automático de Let's Encrypt. El http
  del dominio redirige a https (308).
- **Respaldo:** `http://100.50.159.211` (la IP, o cualquier otro nombre) sirve la demo por http sin redirigir,
  por si el certificado falla.
- **Cabeceras y compresión:** HSTS corto (`max-age=300`, sin `includeSubDomains` ni `preload`) y compresión
  zstd/gzip. nginx ya añade `nosniff`, `X-Frame-Options` y `Referrer-Policy`.
- **Puertos:** `web` deja de publicar el puerto 80 del host; solo Caddy llega a él, por la red interna.

En local nada cambia: `docker compose up --build` solo lee `compose.yaml`.

### Requisitos

- **DNS:** registros `A` de `balax.me` y `www.balax.me` → `100.50.159.211`.
- **Grupo de seguridad:** entrada **TCP 80** y **TCP 443** desde `0.0.0.0/0`. Ambos son obligatorios: Let's
  Encrypt valida por el 80. **UDP 443** es opcional (HTTP/3); sin él, el navegador usa TCP.

### Activar (una vez, en la instancia)

En `~/planetx-spherex`, añade esta línea a `.env` (deja el resto igual, incluido `WEB_BIND=0.0.0.0`):

```bash
cd ~/planetx-spherex
grep -q '^COMPOSE_FILE=' .env || echo 'COMPOSE_FILE=compose.yaml:compose.prod.yaml' >> .env
docker compose config --services     # debe listar api, web y caddy
docker compose up -d --build
```

Los despliegues siguientes no cambian (`docker compose up -d --build`): Compose lee `COMPOSE_FILE` del `.env`.

Los certificados quedan en el volumen `planetx_caddy_data`. **No uses `docker compose down -v`**: borraría los
certificados y Let's Encrypt limita cuántos se pueden pedir por semana.

### Comprobar

```bash
curl -sI http://balax.me/            # 308, Location: https://balax.me/
curl -sI https://balax.me/           # 200, strict-transport-security: max-age=300
curl -sI https://www.balax.me/       # 200
curl -s  https://balax.me/api/health # {"status":"ok"}
curl -sI http://100.50.159.211/      # 200, sin redirección (respaldo)
```

### Logs

```bash
docker compose logs -f caddy                          # en vivo
docker compose logs caddy | grep -iE 'error|certificate obtained'
```

`certificate obtained successfully` confirma que el certificado se emitió. Si falla, revisa el DNS y que el
puerto 80 esté abierto. Mientras tanto, el respaldo por IP sigue funcionando.

### Volver al estado anterior (solo http con nginx en el 80)

```bash
cd ~/planetx-spherex
sed -i '/^COMPOSE_FILE=/d' .env
docker compose up -d --build --remove-orphans
curl -sI http://100.50.159.211/      # 200, servido por nginx
```

`--remove-orphans` es **necesario**: sin él, el contenedor de Caddy sigue ocupando el puerto 80 y `web` no
arranca.

- **Volúmenes:** se conservan, así que al reactivar se reutiliza el certificado.
- **HSTS:** un navegador que entró por https puede seguir forzando https en el dominio durante 5 minutos como
  máximo.
