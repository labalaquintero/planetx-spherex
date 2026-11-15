// Configuración de aceptación F01 (Quintero). Playwright aún NO está instalado en web/:
// Santiago debe añadir @playwright/test y el script test:e2e (ver docs/qa/aceptacion/).
//
// Objetivo de las pruebas:
//   - Por defecto (SIMULADO, con interceptación): build de producción servido con `vite preview`
//     en http://127.0.0.1:4173. Lo levanta el webServer de abajo.
//   - Con E2E_BASE_URL (REAL): la URL de la demo desplegada; entonces NO se levanta ningún servidor.
// Los resultados SIMULADO y REAL se registran por separado en docs/qa/aceptacion/F01-matriz.csv.
import { defineConfig, devices } from "@playwright/test";

const PREVIEW_URL = "http://127.0.0.1:4173";
const baseURL = process.env.E2E_BASE_URL ?? PREVIEW_URL;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts/results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "./e2e/.artifacts/report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  // POR QUÉ build de producción + preview y no `pnpm dev`:
  //   en desarrollo (`vite dev`) la app NO llama a /api/v1/comparisons: web/src/features/viewer/api.ts
  //   usa un mock interno cuando `!import.meta.env.PROD`. Con ese mock, la interceptación de red de
  //   Playwright (page.route) nunca vería una petición y los fixtures no se aplicarían. Sólo el build
  //   de producción hace `fetch('/api/v1/comparisons…')`, que es lo que los specs interceptan. Además,
  //   en producción la insignia «Datos de prueba» sólo sale con `mode: "fixture"` (como pide el contrato).
  // Con E2E_BASE_URL (demo desplegada) no se levanta nada.
  // `cwd: ".."` (raíz del repo) porque el comando usa `pnpm --dir web`; `--host` fija IPv4 como en
  // vite.config.ts. Requiere pnpm en el PATH y las dependencias instaladas (`pnpm --dir web install`).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command:
          "pnpm --dir web build && pnpm --dir web preview --host 127.0.0.1 --port 4173 --strictPort",
        cwd: "..",
        url: PREVIEW_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
