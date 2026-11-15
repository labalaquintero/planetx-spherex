// F01 · Estados 200 del contrato (SIMULADO). Todos pendientes (test.fixme): no hay UI todavía.
// Selectores = PROPUESTA, ver docs/qa/aceptacion/selectores-propuestos.md.
// Casos y criterios: docs/qa/aceptacion/F01-criterios.md
import { expect, test, type Page } from "@playwright/test";
import { mockComparisons, mockImages } from "./support";

async function buscar(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "RA (grados)" }).fill("10.25");
  await page.getByRole("textbox", { name: "Dec (grados)" }).fill("-12.5");
  await page.getByRole("button", { name: "Comparar" }).click();
}

test.describe("F01 estados 200 [SIMULADO]", () => {
  test.fixme("F01-C01 · ready con 2 fotogramas @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "sintetico-ready-2");
    await buscar(page);

    await expect(page.getByRole("heading", { name: "Resultado" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reproducir" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Ver A" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Ver B" })).toBeEnabled();
    await expect(page.getByText("2026-01-05")).toBeVisible();
    await expect(page.getByText("sintetico-obs-a")).toBeVisible();
    await expect(page.getByRole("note")).toContainText("no prueba un hallazgo");
    // Sin reproducción automática: sigue ofreciendo «Reproducir», no «Pausar».
    await expect(page.getByRole("button", { name: "Pausar" })).toHaveCount(0);
  });

  test.fixme("F01-C02 · ready con 6 fotogramas @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "sintetico-ready-6");
    await buscar(page);

    const epoca = page.getByRole("slider", { name: "Época" });
    await expect(epoca).toHaveAttribute("aria-valuemax", "6");
    await page.getByRole("button", { name: "Fotograma siguiente" }).click();
    await expect(page.getByRole("img", { name: /Fotograma 2 de 6/ })).toBeVisible();
    await page.getByRole("button", { name: "Reproducir" }).click();
    await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
  });

  test.fixme("F01-C03 · insufficient single_epoch @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "sintetico-insufficient-single-epoch");
    await buscar(page);

    await expect(page.getByRole("img", { name: /Fotograma 1 de 1/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reproducir" })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Cobertura insuficiente");
  });

  test.fixme("F01-C04 · insufficient no_common_band @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-insufficient-no-common-band");
    await buscar(page);

    await expect(page.getByRole("status")).toContainText("Cobertura insuficiente");
    await expect(page.getByRole("status")).not.toContainText("Sin cobertura");
    await expect(page.getByRole("img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reproducir" })).toBeDisabled();
  });

  test.fixme("F01-C05 · insufficient no_usable_frames @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-insufficient-no-usable-frames");
    await buscar(page);

    await expect(page.getByRole("status")).toContainText("Cobertura insuficiente");
    await expect(page.getByRole("status")).not.toContainText("Sin cobertura");
    await expect(page.getByRole("button", { name: "Reproducir" })).toBeDisabled();
  });

  test.fixme("F01-C06 · insufficient search_limit_reached @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-insufficient-search-limit-reached");
    await buscar(page);

    await expect(page.getByRole("status")).toContainText("Cobertura insuficiente");
    await expect(page.getByRole("status")).not.toContainText("Sin cobertura");
    await expect(page.getByRole("button", { name: "Reproducir" })).toBeDisabled();
  });

  test.fixme("F01-C07 · no_coverage no_observations @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-no-coverage");
    await buscar(page);

    await expect(page.getByRole("status")).toContainText("Sin cobertura");
    await expect(page.getByRole("img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
  });

  test.fixme("F01-C08 · mode prepared @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "sintetico-prepared");
    await buscar(page);

    await expect(page.getByText("Caso preparado")).toBeVisible();
    await expect(page.getByText("2026-11-14")).toBeVisible(); // checked_at = fecha de preparación
  });

  test.fixme("F01-C16 · etiqueta «Datos de prueba» con mode fixture @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "sintetico-ready-2");
    await buscar(page);

    await expect(page.getByText("Datos de prueba")).toBeVisible();
  });
});
