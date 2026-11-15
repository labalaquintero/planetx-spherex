# Explorar (integrado en el visor)

Sección «Explorar» del visor: selección de sector y vuelo libre por el sector β. Es una
**representación ilustrativa**, no son datos reales de SPHEREx. Se entra solo desde el menú ☰ de
secciones (`src/app/Shell.tsx`), y el mismo menú vuelve a «Inicio».

- Punto de entrada: `index.ts` exporta `<Explorar />`. Shell lo carga con `React.lazy`, así que ni
  este código ni three pesan en el visor hasta abrir la sección.
- Estilos encapsulados: todo cuelga de `.explorar` y de clases `ex-*`.
- Dependencias: `three` y `@react-three/fiber` (MIT), en `web/package.json`.
- Texturas empaquetadas en `scene/assets/` (NASA SVS y Solar System Scope); licencias en
  `ATTRIBUTIONS.md` y en el panel «Créditos».
- `data/layout.ts` es la copia en TypeScript de las medidas de los bocetos. El original y las
  herramientas de medición están en `experimental/explorar/` (`docs/referencias/layout.json` y
  `tools/`).
- Parámetros de URL: `?quality=low|high` y `?debug` (contador de FPS).

Origen: es una copia de `experimental/explorar/src`, sin la app independiente (`App.tsx`,
`main.tsx`, `app.css`) ni la prueba de encapsulación del CSS, que necesita `test.css: true` en la
configuración de Vitest. La documentación completa (controles, decisiones, rendimiento, lista de
comprobación para la demo) está en `experimental/explorar/README.md`.
