# Alexis · Producto, arquitectura y ciencia

Lee el [contexto general](../00_Contexto_General.md) antes de abrir tu rama. Tu primera entrega es **una decisión de alcance que todos puedan probar y un par real que Isaac pueda servir**. No necesitas esperar a la API ni a que se cree una base de datos.

| Arranque | Acuerdo |
| --- | --- |
| Rama | `alexis/f01-ciencia`, desde la base que Isaac confirme. |
| Primera Issue | F01 · Ciencia: regla de comparabilidad, par real y contrato v1. Publica el fixture antes de investigar el caso real en profundidad. |
| Revisión | César valida la trazabilidad; Isaac el punto de integración; Santiago comprueba que puede implementar la UI usando solo el contrato. |
| Herramientas | Git/VS Code, GitHub Projects, Python, Astropy/FITS/WCS, NumPy, pytest, Data Explorer/notebooks IRSA. Usa PyVO/Astroquery solo si hace falta en tu prueba y solicita dependencias comunes a Isaac. |

## Qué haces primero

1. **Cierra alcance con el equipo.** Confirma P0, P1 y las condiciones del evento. Abre F01 con aceptación exacta: un par real trazable, mismo centro/banda y dos fechas; F02 agrega el flujo general, reproductor, casos y URL. Dale a cada subtarea dueño y revisor; Santiago organiza estados. Acuerda la base autorizada con Isaac y registra hora T.
2. **Publica el contrato antes de esperar FITS.** Entrega `docs/contratos/comparacion-v1.md` y cuatro JSON en `web/src/contracts/fixtures/`. Comparte los links a la Issue. Trata campos, unidades, criterios de error y flags como interfaz pública. Acepta feedback de Isaac, DeValle, Santiago, César y Quintero antes de versionar cambios.
3. **Busca evidencia real.** Empieza en IRSA por una región de los cinco casos con mejor cobertura, con apoyo de César. Verifica centro, fechas de exposición, releases e IDs. Determina banda local compatible a partir de los recortes; deduplica épocas, enmascara píxeles inválidos y conserva orientación/escala al reproyectar. Fija y registra el umbral espectral y las reglas de flags desde los datos; si no hay par, deja el motivo con evidencia y cambia de región/época. No ajustar cada contraste para que algo parezca moverse.
4. **Construye una función pura.** En `planetx.science.build_sequence()` recibe coordenadas/campo y recortes locales con procedencia. Devuelve metadatos científicos, razón si no es viable y PNGs. No gestiones red, subida a S3, FastAPI ni configuración global. Mientras Isaac construye el adaptador, baja dos recortes pequeños desde IRSA manualmente e inicia desde la carpeta local ignorada por Git.
5. **Haz el handoff y arbitra.** Pasa a Isaac y DeValle un caso real listo para reproducir: inputs, metadatos, versiones, parámetros, ubicación permitida de productos y propuesta de prueba. César valida con criterios independientes y Quintero recibe una explicación clara de lo observable. Decide junto al dueño el recorte a +60 min si hay bloqueo; no absorbas su tarea escribiendo su código.

## Permisos de escritura

- `docs/contexto/**` · `docs/contratos/**` · `docs/decisiones/**`.
- `api/planetx/science/**` · `api/tests/science/**` · `web/src/contracts/fixtures/**`.

**Deja a sus dueños** `api/app.py`, `api/requirements.txt`, adaptador IRSA, persistencia, migraciones, aplicación React, locks y CI. Si otra capa necesita un ajuste, adjunta el contrato mínimo con ejemplo al ticket. No agregues empaquetado, IA o dashboard de análisis fuera de P0.

## Verificación y salida

Desde el clon, usa la `.venv` de §7. Con pytest/dependencias aprobadas y los tests de tu módulo: PowerShell `.\.venv\Scripts\python.exe -m pytest api/tests/science`; Linux `.venv/bin/python -m pytest api/tests/science`. Prueba orden cronológico, misma rejilla, máscara, escala común y caso sin banda. Una prueba sintética sirve para el método; anexa un replay con dos observaciones reales desde los archivos locales. No adjuntes FITS grandes al PR.

**Listo cuando:** contrato versionado, dos IDs/fechas verificadas para la misma región o bloqueo científico documentado, parámetros reproducibles, consumidores conformes con la frontera y ticket actualizado. Si todos los casos iniciales fallan, decide con la sede y César qué región usar para demostrar la herramienta y qué limitación declarar.

**Prompt para tu IA:** «Rol Alexis, Issue F01 de ciencia. Lee el general y esta guía. Planea dentro de mis rutas. Empieza por la especificación/fixture o por una prueba local de FITS/WCS. No inventes observaciones ni cambies la API/requirements/CI. Si una frontera necesita cambiar, presenta el antes/después para los consumidores. Devuelve paths, reproducibilidad y evidencia».
