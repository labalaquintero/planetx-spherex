// F01 · Errores HTTP y validación (SIMULADO). Todos pendientes (test.fixme): no hay UI todavía.
// Selectores = PROPUESTA, ver docs/qa/aceptacion/selectores-propuestos.md.
// Casos y criterios: docs/qa/aceptacion/F01-criterios.md
import { expect, test, type Page } from "@playwright/test";
import { mockComparisons, mockImages } from "./support";

async function buscar(page: Page, ra: string, dec: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "RA (grados)" }).fill(ra);
  await page.getByRole("textbox", { name: "Dec (grados)" }).fill(dec);
  await page.getByRole("button", { name: "Comparar" }).click();
}

// Validación en navegador (§2.1). CONFIRMADO por Alexis: RA/Dec se validan en el navegador y también
// en la API; la UI NO envía la petición con coordenadas inválidas. El mock 422 sólo detecta que no sale.
// El 422 real de la API se prueba directamente en api.spec.ts (F01-R03a/b/c).
test.describe("F01 validación de coordenadas [SIMULADO]", () => {
  const sinPeticion = async (page: Page) => {
    let peticiones = 0;
    await mockComparisons(page, "sintetico-error-422", 422, () => {
      peticiones += 1;
    });
    return () => peticiones;
  };

  test.fixme("F01-C09 · 422 parámetro faltante @simulado", async ({ page }) => {
    const peticiones = await sinPeticion(page);
    await buscar(page, "10.25", "");

    await expect(page.getByRole("textbox", { name: "Dec (grados)" })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Sin cobertura")).toHaveCount(0);
    expect(peticiones()).toBe(0);
  });

  for (const [id, valor] of [["NaN", "NaN"], ["Infinity", "Infinity"]] as const) {
    test.fixme(`F01-C10 · 422 ${id} @simulado`, async ({ page }) => {
      const peticiones = await sinPeticion(page);
      await buscar(page, valor, "-12.5");

      await expect(page.getByRole("textbox", { name: "RA (grados)" })).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Sin cobertura")).toHaveCount(0);
      expect(peticiones()).toBe(0);
    });
  }

  for (const [ra, dec] of [["360", "-12.5"], ["-0.1", "-12.5"], ["10.25", "90.1"], ["10.25", "-90.1"]] as const) {
    test.fixme(`F01-C11 · 422 fuera de rango ra=${ra} dec=${dec} @simulado`, async ({ page }) => {
      const peticiones = await sinPeticion(page);
      await buscar(page, ra, dec);

      await expect(page.getByText(/0.*360|−90|-90/)).toBeVisible(); // orienta el rango válido
      await expect(page.getByText("Sin cobertura")).toHaveCount(0);
      expect(peticiones()).toBe(0);
    });
  }

  // Límites válidos: deben aceptarse y enviar la petición.
  test.fixme("F01-C11 · límites válidos ra=0 dec=90 se aceptan @simulado", async ({ page }) => {
    const peticiones = await sinPeticion(page);
    await buscar(page, "0", "90");

    await expect.poll(peticiones).toBe(1);
  });
});

test.describe("F01 errores de servicio [SIMULADO]", () => {
  for (const [id, fixture] of [
    ["F01-C12 · 503 archive_unavailable", "sintetico-error-503-archive-unavailable"],
    ["F01-C13 · 503 query_timeout", "sintetico-error-503-query-timeout"],
  ] as const) {
    test.fixme(`${id} @simulado`, async ({ page }) => {
      await mockComparisons(page, fixture, 503);
      await buscar(page, "10.25", "-12.5");

      await expect(page.getByRole("alert")).toContainText("Fallo temporal");
      await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
      await expect(page.getByText("Sin cobertura")).toHaveCount(0); // nunca un falso no_coverage
    });
  }

  test.fixme("F01-C14 · 500 internal_error @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-error-500", 500);
    await buscar(page, "10.25", "-12.5");

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).not.toContainText(/traceback|stack|exception/i);
    await expect(page.getByRole("button", { name: "Comparar" })).toBeEnabled(); // sigue operable
  });

  test.fixme("F01-C15 · 404 image_not_found en un fotograma @simulado", async ({ page }) => {
    await mockImages(page, ["sintetico-b"]);
    await mockComparisons(page, "sintetico-ready-2");
    await buscar(page, "10.25", "-12.5");

    await page.getByRole("button", { name: "Ver B" }).click();
    await expect(page.getByText("Imagen no disponible")).toBeVisible();
    await expect(page.getByText("sintetico-obs-b")).toBeVisible(); // metadatos siguen visibles
    await expect(page.getByText("Sin cobertura")).toHaveCount(0);
  });
});
