// F01 · Estados 200 del contrato (SIMULADO). Todos pendientes (test.fixme): @playwright/test aún no
// está instalado en web/. Selectores = nombres REALES del visor en main (SHA ae983c9), por rol y
// nombre accesible; sin data-testid. Ver docs/qa/aceptacion/selectores-propuestos.md.
// Casos y criterios: docs/qa/aceptacion/F01-criterios.md
import { expect, test, type Page } from "@playwright/test";
import { buscar, mockComparisons, mockImages } from "./support";

// «Sin cobertura» también es el texto de un botón preset («Probar:»): el estado se busca SIEMPRE
// dentro de role=status.
const estado = (page: Page) => page.getByRole("status");
const estadoSinCobertura = (page: Page) => estado(page).filter({ hasText: "Sin cobertura" });
const comparador = (page: Page) => page.getByRole("region", { name: "Comparador de épocas" });
const controles = (page: Page) => page.getByRole("toolbar", { name: "Controles de reproducción" });
const imagenes = (page: Page) => page.getByRole("img", { name: /Observación del/ });

test.describe("F01 estados 200 [SIMULADO]", () => {
  test.fixme("F01-C01 · ready con 2 fotogramas @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "comparacion-ready"); // canónico de Alexis
    await buscar(page);

    await expect(comparador(page)).toBeVisible();
    await expect(controles(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reproducir secuencia" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Mostrar época A" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Mostrar época B" })).toBeEnabled();
    // Procedencia: fecha UTC (atributo del <time>), ID de observación y fuente.
    await expect(comparador(page).getByText("Procedencia y metadatos")).toBeVisible();
    await expect(comparador(page).locator('time[datetime="2026-01-05T00:00:00Z"]')).toBeVisible();
    await expect(comparador(page).getByText("fixture-obs-a")).toBeVisible();
    await expect(comparador(page).getByText("No disponible (fixture)")).toBeVisible(); // source_url null
    // Aviso de no-hallazgo (también está en el pie: se acota a la región del comparador).
    await expect(comparador(page).getByText(/no constituye por sí solo evidencia de un hallazgo/)).toBeVisible();
    // Sin reproducción automática.
    await expect(page.getByRole("button", { name: "Pausar reproducción" })).toHaveCount(0);
  });

  test.fixme("F01-C02 · ready con 6 fotogramas @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "sintetico-ready-6");
    await buscar(page);

    await expect(page.getByRole("button", { name: /^Mostrar época / })).toHaveCount(6);
    await page.getByRole("button", { name: "Época siguiente" }).click();
    await expect(page.getByRole("img", { name: /Época B — 2 de 6/ })).toBeVisible();
    await page.getByRole("button", { name: "Reproducir secuencia" }).click();
    await expect(page.getByRole("button", { name: "Pausar reproducción" })).toBeVisible();
  });

  test.fixme("F01-C03 · insufficient single_epoch @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "comparacion-insufficient"); // canónico de Alexis
    await buscar(page);

    await expect(estado(page)).toContainText("Cobertura insuficiente");
    await expect(estado(page)).toContainText("Solo se encontró una época");
    await expect(page.getByRole("img", { name: /Época A — 1 de 1/ })).toBeVisible();
    // Con un solo fotograma los controles NO EXISTEN (no están deshabilitados).
    await expect(controles(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reproducir secuencia" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Mostrar época / })).toHaveCount(0);
  });

  test.fixme("F01-C04 · insufficient no_common_band @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-insufficient-no-common-band");
    await buscar(page);

    await expect(estado(page)).toContainText("Cobertura insuficiente");
    await expect(estado(page)).toContainText("banda espectral comparable");
    await expect(estadoSinCobertura(page)).toHaveCount(0);
    await expect(imagenes(page)).toHaveCount(0);
    await expect(controles(page)).toHaveCount(0);
  });

  test.fixme("F01-C05 · insufficient no_usable_frames @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-insufficient-no-usable-frames");
    await buscar(page);

    await expect(estado(page)).toContainText("Cobertura insuficiente");
    await expect(estado(page)).toContainText("fotogramas válidos");
    await expect(estadoSinCobertura(page)).toHaveCount(0);
    await expect(controles(page)).toHaveCount(0);
  });

  // search_limit_reached sin fotograma validado: frames [] y band null.
  test.fixme("F01-C06 · insufficient search_limit_reached sin fotograma (frames [] y band null) @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-insufficient-search-limit-reached-0-frames");
    await buscar(page);

    await expect(estado(page)).toContainText("Cobertura insuficiente");
    await expect(estado(page)).toContainText("límite de búsqueda");
    await expect(estadoSinCobertura(page)).toHaveCount(0);
    await expect(imagenes(page)).toHaveCount(0);
    await expect(controles(page)).toHaveCount(0);
  });

  // search_limit_reached con un fotograma validado: 1 frame y band con valor.
  test.fixme("F01-C20 · insufficient search_limit_reached con 1 fotograma validado (band con valor) @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "sintetico-insufficient-search-limit-reached-1-frame");
    await buscar(page);

    await expect(estado(page)).toContainText("Cobertura insuficiente");
    await expect(estado(page)).toContainText("límite de búsqueda");
    await expect(page.getByRole("img", { name: /Época A — 1 de 1/ })).toBeVisible();
    await expect(page.getByText(/1\.25 ± 0\.02/)).toBeVisible(); // banda presentada
    await expect(controles(page)).toHaveCount(0);
  });

  // search_limit_reached como warning con secuencia válida: status ready.
  // PENDIENTE DE SANTIAGO: hoy la UI muestra el código en bruto («search_limit_reached») en «Avisos:».
  // Este spec espera un texto legible; se mantiene fixme hasta que se acuerde el texto.
  test.fixme("F01-C21 · ready con warning search_limit_reached, texto legible (pendiente de Santiago) @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "sintetico-ready-search-limit-warning");
    await buscar(page);

    await expect(comparador(page).getByText(/límite de búsqueda|búsqueda (recortada|acotada)/i)).toBeVisible();
    await expect(comparador(page).getByText("search_limit_reached")).toHaveCount(0); // no el código en bruto
    await expect(page.getByRole("button", { name: "Reproducir secuencia" })).toBeEnabled(); // no bloquea
    await expect(estado(page).filter({ hasText: "Cobertura insuficiente" })).toHaveCount(0);
  });

  test.fixme("F01-C07 · no_coverage no_observations @simulado", async ({ page }) => {
    await mockComparisons(page, "comparacion-no-coverage"); // canónico de Alexis
    await buscar(page);

    await expect(estadoSinCobertura(page)).toBeVisible();
    await expect(imagenes(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reintentar búsqueda" })).toHaveCount(0);
  });

  test.fixme("F01-C08 · mode prepared @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "sintetico-prepared");
    await buscar(page);

    await expect(comparador(page).getByText("Caso preparado", { exact: true })).toBeVisible();
    await expect(comparador(page).locator('time[datetime="2026-11-14T12:00:00Z"]').first()).toBeVisible(); // fecha de preparación
    // Regla 2: release dr1/qr3 y source_url por fotograma. En este fixture sintético el source_url es
    // https://example.invalid/... a propósito (NO verificable); que uno real abre en IRSA es F01-R08/R14.
    await expect(comparador(page).getByText("dr1", { exact: true })).toBeVisible();
    await expect(comparador(page).getByRole("link", { name: "Enlace al archivo" })).toHaveAttribute(
      "href",
      "https://example.invalid/irsa/sintetico-prep-obs-a",
    );
    // En el build de producción la insignia sólo sale con mode "fixture": aquí NO debe aparecer.
    await expect(page.getByText("Datos de prueba", { exact: true })).toHaveCount(0);
  });

  test.fixme("F01-C16 · etiqueta «Datos de prueba» con mode fixture @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "comparacion-ready");
    await buscar(page);

    // exact: el panel de procedencia también dice «Datos de prueba (fixture)» en «Modo».
    await expect(page.getByText("Datos de prueba", { exact: true })).toBeVisible();
  });
});
