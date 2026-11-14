# Quintero · Idea, aceptación, pruebas y demostración

Lee el [contexto general](../00_Contexto_General.md). Tu primera entrega es **un recorrido de aceptación que cualquiera pueda repetir**. Puedes empezarlo con el JSON de la guía y páginas/maquetas o interceptación de red. Tus pruebas no esperan a que DeValle termine su base ni a que Santiago termine la pantalla.

| Arranque | Acuerdo |
| --- | --- |
| Rama | `quintero/f01-aceptacion`. |
| Primera Issue | F01 · Criterios de uso, casos positivos/negativos y un guion de demo. |
| Revisión | César verifica datos de prueba y contraste de casos; Santiago confirma interacción/acceso; Isaac prepara contigo el respaldo; Alexis valida qué se promete. |
| Herramientas | GitHub Issues, VS Code, navegador y DevTools, Node/pnpm, Playwright con Chromium. Docker o AWS CLI solo para un ensayo autorizado de respaldo de Isaac. |

## Qué haces primero

1. **Convierte la idea en evidencia.** Describe a quién ayuda, qué necesita hacer y cómo sabremos que lo logró. Escribe «Dado / Cuando / Entonces» para: entrar sin cuenta, escribir coordenadas, reproducir dos épocas con misma región, entender fechas/banda/fuente, consulta inválida, una época, ninguna, IRSA caído y preparado. Incluye teclado y móvil. Cada uno tiene estado, pasos, resultado esperado y resultado observado.
2. **Prepara pruebas sin esperar módulos.** Para lo manual usa la especificación y el mock. En Playwright, cuando la infraestructura web esté disponible, intercepta `/api/v1/comparisons` y respuestas PNG con fixtures. Puedes preparar specs y expectativa sin dar por pasado un test con UI ausente. Usa roles/etiquetas con Santiago, y no introduzcas selectores sólo para maquillar una prueba.
3. **Valida la demo real con César.** Pide su matriz de observaciones y revisa que la demo reproduce un caso con datos de origen verificable y uso permitido; no reemplazas su prueba de WCS/bandas. Ejecuta en incógnito/red externa con el mismo SHA que Isaac publica. Si falla, crea una Issue con coordenadas no sensibles, pasos, hora, navegador y esperado/observado; devuelve a su dueño, no cambies tú el módulo.
4. **Ensaya y verifica entrega.** Prepara una historia breve: problema → coordenada → dos fechas reales → qué se observa → límites y fuentes. Lleva grabación/capturas de la comparación real si falla la red, marcada como respaldo. Confirma tiempos, inglés/subtítulos y formato final con la sede. Santiago verifica vínculos, Alexis texto científico e Isaac recorrido técnico. El titular de equipo autorizado envía y registra confirmación contigo.
5. **Sé respaldo operativo.** Sigue el runbook de Isaac con permisos propios, prueba el preparado aunque falle IRSA y registra cómo verificar restauración. Si no tienes acceso, prueba como usuario desde fuera y deriva el cambio de infraestructura a Isaac.

## Permisos de escritura

- `web/e2e/**` y `web/playwright.config.ts`.
- `docs/qa/aceptacion/**` y `docs/entrega/**`.

**No edites** aplicación productiva, CI, locks, manifiestos, fixtures canónicos, ciencia ni datos de César. Si falta Playwright como dependencia pide a Santiago que añada paquete/script; si falta integración CI, recurre a Isaac. No guardes tokens ni grabaciones grandes o datos personales en Git. Si la UI o el backend no están listos, sigue con casos, guion, datos sintéticos identificados y ejercicios de aceptación.

## Verificación y salida

Si Playwright está en el proyecto: `pnpm --dir web exec playwright install chromium` y `pnpm --dir web exec playwright test`, con la URL local o de demostración que figure en la configuración de tu Issue. Si QA detecta que un fixture pasó y la demo real falló, conserva ambos resultados separados. Adjunta matriz de aceptación, incidencias, versión y enlaces en GitHub.

**Listo cuando:** los recorridos principales y de fallo se probaron contra la misma versión de demo, hay evidencia de una persona ajena al autor y el equipo puede repetir presentación/entrega sin tu máquina. Anota estados no probados o parciales.

**Prompt para tu IA:** «Rol Quintero, aceptación F01. Lee el general y mi perfil. Escribe casos desde el contrato o Playwright con interceptación; no toques frontend/API/CI/locks. Separa simulado de real y registra pasos, esperado/observado y SHA. No publiques ni compartas por tu cuenta».
