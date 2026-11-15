// Configuración de aceptación F01 (Quintero). Playwright aún no está instalado en web/:
// Santiago debe añadir @playwright/test y el script test:e2e (ver docs/qa/aceptacion/).
//
// E2E_BASE_URL elige el objetivo:
//   - local/dev (SIMULADO, con interceptación): http://localhost:5173 (por defecto)
//   - demo desplegada (REAL): la URL pública que publique Isaac
// Los resultados SIMULADO y REAL se registran por separado en docs/qa/aceptacion/F01-matriz.csv.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts/results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "./e2e/.artifacts/report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  // Sin webServer: no se arranca nada por cuenta de la config; el objetivo ya debe estar levantado.
});
