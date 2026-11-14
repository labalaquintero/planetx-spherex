# Isaac · API, GitHub, DevOps y despliegue

Lee el [contexto general](../00_Contexto_General.md). Tu primera entrega es **un servicio que web pueda consumir enseguida y una ruta de publicación que se pueda repetir**. La API protege la interfaz de las esperas de IRSA y los cambios de almacenamiento.

| Arranque | Acuerdo |
| --- | --- |
| Rama | `isaac/f01-api`. Confirma remoto, permisos, base, presencia de `api/app.py` y PRs antes de modificar. |
| Primera Issue | F01 · FastAPI, health, comparación con stub y validación. Una subtarea aparte registra cuenta/servicios disponibles y respaldo. |
| Revisión | Alexis revisa el contrato y fallos científicos; DeValle las fronteras de catálogo; Santiago el proxy y Quintero el smoke/recuperación. |
| Herramientas | Git/GitHub, Actions y reglas de protección; Python/FastAPI/Pydantic/Uvicorn/pytest/HTTPX; Docker/Compose; AWS CLI/SSO, S3, ECR, ECS Fargate, ALB, CloudFront, CloudWatch y RDS si procede. |

## Qué haces primero

1. **Confirma la base y evita un cuello de botella.** Verifica con Alexis si se puede incorporar el trabajo de preparación. Comparte el enlace del repo autorizado, SHA y nombres de rama al equipo en el Project. No presumas que `chore/base-stack` se fusionó. Cierra cambios de archivos raíz/CI en PRs pequeños para no frenar F01.
2. **Sirve el contrato para integrar temprano.** Mantén `/api/health`. Implementa validación ICRS y respuesta `/api/v1/comparisons` y acceso controlado a PNG. Usa stubs inyectables para casos preparados y ciencia; consume los JSON de Alexis en pruebas. Distingue validación, cobertura y fallos upstream; no habilites fixtures como producto público. Avisa a Santiago cómo comprobar la ruta en el proxy y deja a Santiago `vite.config.ts`.
3. **Separa IO y ciencia.** Implementa adaptador IRSA de las dos colecciones wide con límites de recursos, timeouts y logs sin secretos. Entrega a Alexis paths de recortes y procedencia. Consume `build_sequence()` y el lector `get_prepared()` de DeValle. Si no están, simula sus resultados; el cambio de ruta funcional debe ser pequeño. Para imágenes usa el storage definido y comprueba que dos peticiones consecutivas pueden recuperar el mismo producto tras reinicio, si se promete persistencia.
4. **Monta primero un smoke reproducible, después AWS.** Web de prueba, API y PNG por el mismo origen; S3 Web privado tras CloudFront, API detrás de ALB/Fargate, imágenes en S3 Datos y aplicación en ECR. CI de PR solo con pruebas sin credenciales ni red hacia IRSA; publicación por identidad autorizada de mínimo privilegio y mecanismo aprobado. RDS es opcional en P0. Anota tiempos, versión, versión previa restaurable, logs y costo. Si hay bloqueo de cuenta/certificado, usa solo la alternativa que confirme el equipo y reserva la demo preparada.
5. **Traspasa operación.** Ensaya con Quintero el smoke, la restauración del último build/imagen válidos y qué se muestra cuando falla IRSA. Quintero puede verificar o seguir el procedimiento si está autorizado; no necesita editar tus workflows ni compartir tus credenciales.

## Permisos de escritura

- `AGENTS.md`, `README.md`, `.gitignore`, `.gitattributes`, `.env.example`, `compose.yaml`, `.github/**`, `infra/**`, `tools/check_role_paths.py`.
- `api/app.py`, `api/Dockerfile`, `api/requirements.txt`, `api/pytest.ini`, `api/planetx/__init__.py`, `api/planetx/http/**`, `api/planetx/irsa/**`, `api/tests/http/**`.

**Deja a sus dueños** el contrato y los fixtures, algoritmo científico, catálogo/migraciones, UI, dependencias web y E2E. Si hay que cambiar dos capas, coordina dos PRs con dependencias explícitas. Las solicitudes de paquetes Python se consolidan aquí; añade y verifica solo los que se usan.

## Cómo aplicar los límites por ruta

- Mapea los usuarios GitHub verificados a sus rutas con `.github/CODEOWNERS` y configura revisión obligatoria y checks para `main` si el repositorio lo permite. El prefijo de rama debe coincidir con el dueño de la tarjeta, no reemplaza verificar quién abrió el PR.
- Haz el chequeo `tools/check_role_paths.py` con el mapa de §6: archivos exactos, prefijos con barra para directorios y patrones solo donde se indican. Entrada: dueño/ticket y base confirmada; salida 1 si hay una ruta ajena, desconocida o se suministra un dueño inválido. En CI usa un mapa de la base revisada para que una rama no pueda darse permisos modificándolo; al editar el control, exige revisión de un segundo dueño.
- Para leer rutas en scripts, lista con `git diff --name-only -z --no-renames BASE...HEAD`. En local añade el diff sin stage, `--cached` y `git ls-files --others --exclude-standard -z`, preservando el separador NUL y usando rutas de Git sin barra inicial. `--no-renames` hace visible origen y destino. Valida con una ruta permitida y otra ajena; una sola fuera del mapa bloquea. Hasta que esto exista, revisa manualmente las rutas con el checklist de §7 y no apruebes una PR cruzada.

## Verificación y salida

Usa la receta local de §7. Con tests instalados: `.\.venv\Scripts\python.exe -m pytest api/tests/http` (Windows) o `.venv/bin/python -m pytest api/tests/http` (Linux). Verifica health, 422, timeout, ready/preparado, PNG accesible y ausencia de fuga de rutas/credenciales. Con Docker/AWS configurados: Compose validado, URL HTTPS en incógnito, API/PNG desde el mismo origen, rollback ensayado o alternativas documentadas.

**Listo cuando:** Santiago consume el mismo JSON sin usar nunca otros paths, Alexis y DeValle aceptan las interfaces, la prueba real tiene SHA e IDs y Quintero puede seguir el runbook. Reporta claramente si AWS o la consulta general siguen pendientes.

**Prompt para tu IA:** «Rol Isaac, Issue F01 API/infra. Lee el general y esta guía. Limita escritura a los paths de esta Issue; usa las interfaces y el fixture, no implementes módulos ajenos para llenar huecos. Sin secretos, push, merge, provisión ni despliegue sin instrucción. Muestra comandos de verificación y el handoff para UI y operaciones».
