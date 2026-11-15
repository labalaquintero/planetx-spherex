// F01 · Transversales: teclado, móvil y respuestas tardías (SIMULADO). Todos pendientes (test.fixme):
// @playwright/test aún no está instalado en web/. Selectores = nombres REALES del visor en main
// (SHA ae983c9), por rol y nombre accesible; sin data-testid.
// Ver docs/qa/aceptacion/selectores-propuestos.md · Casos: docs/qa/aceptacion/F01-criterios.md
import { expect, test } from "@playwright/test";
import { buscar, CAMPO_RA, mockComparisons, mockImages } from "./support";

test.describe("F01 transversales [SIMULADO]", () => {
  test.fixme("F01-C17 · teclado y foco @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "comparacion-ready");
    await page.goto("/");

    // Formulario sólo con teclado: RA → Dec → Comparar → Enter.
    await page.getByRole("textbox", { name: CAMPO_RA }).focus();
    await page.keyboard.type("10.25");
    await page.keyboard.press("Tab");
    await page.keyboard.type("-12.5");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Comparar" })).toBeFocused();
    await page.keyboard.press("Enter");

    // El comparador es una región enfocable: ←/→ cambian de época y Espacio reproduce/pausa.
    const region = page.getByRole("region", { name: "Comparador de épocas" });
    await expect(region).toBeVisible();
    await region.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("img", { name: /Época B — 2 de 2/ })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("img", { name: /Época A — 1 de 2/ })).toBeVisible();
    await page.keyboard.press(" ");
    await expect(page.getByRole("button", { name: "Pausar reproducción" })).toBeVisible();
    await page.keyboard.press(" ");
    await expect(page.getByRole("button", { name: "Reproducir secuencia" })).toBeVisible();

    // Botones de la barra: Enter y Espacio.
    const reproducir = page.getByRole("button", { name: "Reproducir secuencia" });
    await reproducir.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Pausar reproducción" })).toBeFocused();
    // Pendiente: comprobar foco visible (indicador de foco) con Santiago.
  });

  test.fixme("F01-C18 · vista móvil sin scroll horizontal @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "comparacion-ready");
    await page.setViewportSize({ width: 390, height: 844 });
    await buscar(page);

    await expect(page.getByRole("region", { name: "Comparador de épocas" })).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "Controles de reproducción" })).toBeVisible();
    await expect(page.getByText("Procedencia y metadatos")).toBeVisible();
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sobra).toBeLessThanOrEqual(0);
  });

  // PENDIENTE DE SANTIAGO: en la UI actual el botón «Comparar» se deshabilita (y pasa a «Buscando…») mientras
  // hay una búsqueda en curso, así que desde la interfaz NO se puede lanzar una segunda consulta antes de
  // que termine la primera. El descarte de la respuesta antigua sí está cubierto a nivel de hook en Vitest
  // (web/src/test/useComparison.test.ts y viewer.test.tsx). Este spec comprueba lo que sí es observable y
  // queda fixme hasta decidir si se permite una nueva consulta durante la carga.
  test.fixme("F01-C19 · respuesta tardía descartada (pendiente de Santiago) @simulado", async ({ page }) => {
    await mockImages(page);
    await mockComparisons(page, "comparacion-ready", 200, async () => {
      await new Promise((r) => setTimeout(r, 1500)); // respuesta lenta
    });
    await buscar(page);

    // Mientras carga: estado de carga y botón deshabilitado, sin resultado todavía.
    await expect(page.getByRole("status")).toContainText("Buscando observaciones…");
    await expect(page.getByRole("button", { name: "Buscando…" })).toBeDisabled();
    await expect(page.getByRole("region", { name: "Comparador de épocas" })).toHaveCount(0);
    // Cuando llega la respuesta, se muestra una sola vez el resultado de esa consulta.
    await expect(page.getByRole("region", { name: "Comparador de épocas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pausar reproducción" })).toHaveCount(0); // sin autoplay
    // Si se permitiera una segunda consulta durante la carga: la respuesta antigua no debe sobrescribir
    // a la nueva y su reproducción debe detenerse (criterio C19 de F01-criterios.md).
  });
});
