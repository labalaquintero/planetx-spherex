# Santiago · Visor, experiencia de uso y ritmo de trabajo

Lee el [contexto general](../00_Contexto_General.md). Tu primera entrega es **que un visitante pueda introducir coordenadas y alternar A/B en el navegador usando el contrato acordado**. Así el frontend se puede probar desde la primera hora sin esperar a FastAPI. Después conectas el servicio y completas la secuencia, sin programar backend.

| Arranque | Acuerdo |
| --- | --- |
| Rama | `santiago/f01-visor`. |
| Primera Issue | F01 · Entrada RA/Dec, comparación de dos fotogramas y estados con fixtures. Ayuda a poner F01 y sus seis subtareas en el tablero. |
| Revisión | Quintero prueba UX/teclado; Isaac verifica proxy/origen; DeValle y César sugieren datos/avisos y aportan componentes solo dentro de sus carpetas. |
| Herramientas | VS Code, React/TypeScript/Vite, Node, pnpm, DevTools, Vitest/Testing Library si están incluidos y GitHub Projects. TanStack Query, Tailwind CSS y shadcn/ui se usan si ya están listos o te ahorran trabajo. Aladin Lite se evalúa después de tener A/B fluido. |

## Qué haces primero

1. **Dibuja la pantalla útil.** Encabezado y ayuda mínima → RA/Dec con ejemplo y submit → estado → vista de tamaño estable → fechas, banda y procedencia. Distingue los controles de observar fechas de los de introducir coordenadas. Confirma lenguaje con Quintero y requisitos de metadatos con DeValle/César; no empieces con galería, pop-up, perfil ni Blog.
2. **Implementa una interfaz entre cliente y vista.** Empieza con los JSON de Alexis; si aún no están en tu rama, usa temporalmente el bloque JSON del general. Renderiza dos imágenes deliberadamente sintéticas solo en dev/test. Cubre carga, ready, una época, sin cobertura y 503 con reintento. Valida campos finitos y rangos; etiquétalos como grados ICRS. No calcules datos de ciencia en JavaScript.
3. **Conecta a producción.** Cambia a `GET /api/v1/comparisons` y rutas de imagen del mismo origen; en dev conserva el proxy Vite al puerto confirmado por Isaac. Cuida respuestas tardías cuando se hace una segunda búsqueda: descarta la anterior y para su reproducción. Muestra aviso de preparado, su fecha y enlaces de fuente. Evita que una respuesta de fixture pase a un build público.
4. **Completa el reproductor y acceso.** Play/Pause, pasos A/B o anteriores/siguientes y un control temporal sobre épocas disponibles. Usar mismas dimensiones del recorte, nada de estirar por frame ni encuadrar la imagen según el brillo. Teclado, foco visible, textos para estados y formato móvil. Informa a Quintero de roles/etiquetas de interacción estables.
5. **Coordina sin cargar con todo.** Mantén en GitHub Projects las vistas y el check-in cada 2 h. Cada quien actualiza su tarjeta. Al detectar dependencia, acuerda mock y deja dueño y hora de revisión. Si DeValle hace `ObservationDetails` o César `DataNotice`, entrega props esperadas y tú los integras. Si terminas antes del backend, valida con Quintero en otros tamaños, los estados, accesibilidad y la integración, en vez de abrir una página de P2.

## Permisos de escritura

- `web/src/{App.tsx,App.css,main.tsx,index.css}`, `web/src/app/**`, `web/src/components/**`, `web/src/shared/**`, `web/src/features/viewer/**`, `web/src/test/**` y `web/public/**`.
- `web/{package.json,pnpm-lock.yaml,index.html,vite.config.ts,README.md,.gitignore,.oxlintrc.json}`, `web/tsconfig*.json` y `web/eslint.config.*`.

**No edites** API, BD, lógica científica, CI, JSON canónicos, componente de DeValle/César ni E2E/configuración de Quintero. Eres dueño de las dependencias web y el lock; coordina pedidos y actualízalos juntos con pnpm. Si falta un archivo base, pide alineación de rutas antes de introducir otra raíz.

## Verificación y salida

`pnpm --dir web install --frozen-lockfile` → `pnpm --dir web dev` → probar recorrido y estados → `pnpm --dir web run build`, más el script de pruebas que exista. Al integrar, comprobar `/api/health` vía proxy y verificar al menos un caso con entrada manual, cambio A/B visible, fecha y fuente, móvil y teclado. Registra SHA y anomalías en F01.

**Listo cuando:** puedes mostrar el recorrido con datos preparados y comunicar de qué fuente salen los fotogramas, y Quintero puede repetirlo sin instrucciones ocultas. La UI estándar no depende de presets para aceptar coordenadas.

**Prompt para tu IA:** «Rol Santiago, F01 visor. Lee general y perfil. Primero mock y plan de paths. Solo frontend y tareas; deja API, E2E, contratos y carpetas de otros intactos. Usa pnpm, conserva estados, accesibilidad y datos de procedencia. Entrega pruebas, build y handoff a Isaac y Quintero».
