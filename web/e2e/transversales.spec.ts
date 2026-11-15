// F01 · Transversales: teclado, móvil y respuestas tardías (SIMULADO). Todos pendientes (test.fixme).
// Selectores = PROPUESTA, ver docs/qa/aceptacion/selectores-propuestos.md.
// Casos y criterios: docs/qa/aceptacion/F01-criterios.md
import { expect, test } from "@playwright/test";
import { loadFixture, mockComparisons, mockImages } from "./support";

test.describe("F01 transversales [SIMULADO]", () => {
  test.fixme("F01-C17 · teclado y foco @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "comparacion-ready");
    await page.goto("/");

    await page.getByRole("textbox", { name: "RA (grados)" }).focus();
    await page.keyboard.type("10.25");
    await page.keyboard.press("Tab");
    await page.keyboard.type("-12.5");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Comparar" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Resultado" })).toBeVisible();
    await page.getByRole("button", { name: "Reproducir" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Pausar" })).toBeFocused();
    // Pendiente: comprobar foco visible (indicador de foco) con Santiago.
  });

  test.fixme("F01-C18 · vista móvil sin scroll horizontal @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "comparacion-ready");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("textbox", { name: "RA (grados)" }).fill("10.25");
    await page.getByRole("textbox", { name: "Dec (grados)" }).fill("-12.5");
    await page.getByRole("button", { name: "Comparar" }).click();

    await expect(page.getByRole("heading", { name: "Resultado" })).toBeVisible();
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sobra).toBeLessThanOrEqual(0);
    await expect(page.getByRole("link", { name: "Fuente (IRSA)" }).first()).toBeVisible();
  });

  test.fixme("F01-C19 · respuesta tardía descartada @simulado", async ({ page }) => {
    await mockImages(page);
    // Primera búsqueda: respuesta lenta con fixture A (comparacion-ready).
    // Segunda búsqueda: respuesta inmediata con fixture B (sintetico-prepared).
    let llamada = 0;
    await page.route(/\/api\/v1\/comparisons(\?.*)?$/, async (route) => {
      llamada += 1;
      const lenta = llamada === 1;
      if (lenta) await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: loadFixture(lenta ? "comparacion-ready" : "sintetico-prepared"),
      });
    });
    await page.goto("/");
    await page.getByRole("textbox", { name: "RA (grados)" }).fill("10.25");
    await page.getByRole("textbox", { name: "Dec (grados)" }).fill("-12.5");
    await page.getByRole("button", { name: "Comparar" }).click();
    await page.getByRole("textbox", { name: "RA (grados)" }).fill("11");
    await page.getByRole("button", { name: "Comparar" }).click();

    await expect(page.getByText("Caso preparado")).toBeVisible();
    await page.waitForTimeout(2000); // deja llegar la respuesta antigua
    await expect(page.getByText("Caso preparado")).toBeVisible(); // no fue sobrescrita
    await expect(page.getByText("fixture-obs-a")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pausar" })).toHaveCount(0);
  });
});
