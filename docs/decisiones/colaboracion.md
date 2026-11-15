# Cuentas y fichas compartidas

El visor y el Blog se pueden consultar sin cuenta. Con el espacio compartido habilitado, cada colaborador guarda fichas privadas en **Mi espacio** y decide cuándo enviarlas a revisión. Las fichas guardadas antes en el navegador siguen en **Ver fichas de este navegador**. Abre un borrador local y elige **Copiar a mi cuenta** para iniciar una copia compartida.

Una ficha en revisión es visible para su autor y el equipo revisor. Una cuenta `reviewer` o `admin` puede aceptar o rechazar una ficha ajena; para rechazarla tiene que dejar el motivo. El autor puede corregirla y reenviarla. Solo una cuenta `admin` puede publicar una ficha aceptada en el Blog. El informe público incluye la firma, el texto, las imágenes con sus marcas y el PDF adjunto. El correo y los comentarios de revisión se reservan al espacio privado.

Al guardar por primera vez, la API toma las fechas, la banda, las fuentes y los recortes de una comparación que entregó al visor. Si esas imágenes ya no están disponibles, vuelve a abrir el campo y guarda desde allí. La ficha guarda una copia propia de las imágenes, incluidas las de una consulta en vivo. El alias y la foto del perfil son privados por defecto. **Ajustes** permite compartirlos junto con la lista de fichas publicadas.

## Probar con Docker

1. Coloca el catálogo preparado y los productos en las rutas indicadas por `PLANETX_CATALOG_MANIFEST` y `PLANETX_PRODUCTS_DIR` en `.env`.
2. Agrega `PLANETX_WORKSPACE_DB=/app/data/workspace.sqlite3` a `.env` y ejecuta `docker compose up --build -d`. Abre [Planet X local](http://localhost/) e ingresa en **Mi espacio**.
3. Registra tres cuentas de prueba. Desde otro terminal asigna los roles a dos de ellas. Usa los correos con los que las registraste.

   ```sh
   docker compose exec api env PYTHONPATH=/app/api python -m planetx.workspace set-role revisora@example.test reviewer
   docker compose exec api env PYTHONPATH=/app/api python -m planetx.workspace set-role publicador@example.test admin
   ```

4. Con la tercera cuenta abre WISE 0855 en el visor, prepara una ficha y delimita un área en una época. Guarda el borrador. En otro perfil del navegador inicia sesión con esa misma cuenta y comprueba que el borrador incluye el recorte y la marca. Envía la ficha.
5. Entra con la cuenta revisora, abre **Bandeja de revisión** y acepta la ficha, o recházala con un motivo para que el autor pueda corregirla. Con la cuenta administradora publica la ficha aceptada. Abre el Blog en una ventana sin sesión y comprueba que aparecen la ficha y sus imágenes.

## Operación en la instancia de Isaac

SQLite queda en el volumen `workspace_data` del proyecto de Compose. Está pensado para la instancia actual con una sola API. Conserva el volumen al reconstruir contenedores y respalda la base antes de migrarla. El Compose de producción activa las cookies seguras y Caddy expone el espacio compartido por HTTPS. El registro usa correo y contraseña. Confirma con cada integrante qué cuenta registró antes de asignar permisos; el correo todavía no se verifica automáticamente.

El restablecimiento de contraseña lo ejecuta quien opera el servidor, después de verificar la identidad de la persona. El comando pide la nueva contraseña sin eco y revoca las sesiones vigentes.

```sh
docker compose exec api env PYTHONPATH=/app/api python -m planetx.workspace reset-password persona@example.test
```

Con Uvicorn fuera de Docker puedes usar `PLANETX_WORKSPACE_DB=data/workspace.sqlite3` desde la raíz del repo, con el proxy de Vite y las rutas locales del catálogo preparado. Si la variable queda vacía, el visor ofrece el flujo de fichas locales.
