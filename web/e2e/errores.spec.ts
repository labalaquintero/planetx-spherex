// F01 · Errores HTTP y validación (SIMULADO). Todos pendientes (test.fixme): @playwright/test aún no
// está instalado en web/. Selectores = nombres REALES del visor en main (SHA ae983c9), por rol y
// nombre accesible; sin data-testid. Ver docs/qa/aceptacion/selectores-propuestos.md.
// Casos y criterios: docs/qa/aceptacion/F01-criterios.md
import { expect, test, type Page } from "@playwright/test";
import { buscar, CAMPO_DEC, CAMPO_RA, loadFixture, mockComparisons, mockImages } from "./support";

// «Sin cobertura» también es el texto de un botón preset: el estado se busca dentro de role=status.
const estadoSinCobertura = (page: Page) =>
  page.getByRole("status").filter({ hasText: "Sin cobertura" });

// Validación en navegador (§2.1). CONFIRMADO por Alexis: RA/Dec se validan en el navegador y también
// en la API; la UI NO envía la petición con coordenadas inválidas. El mock 422 sólo detecta que no sale.
// El 422 real de la API se prueba directamente en api.spec.ts (F01-R03a/b/c/d).
// Nota: la UI acepta la coma decimal («10,25» → 10.25) y la notación con exponente («1e1» → 10) y envía
// el número ya normalizado; por eso esos formatos no dan 422 a través de la UI (sí en la API directa).
test.describe("F01 validación de coordenadas [SIMULADO]", () => {
  const sinPeticion = async (page: Page) => {
    let peticiones = 0;
    await mockComparisons(page, "sintetico-error-422", 422, () => {
      peticiones += 1;
    });
    return () => peticiones;
  };
  const VALOR_NO_FINITO = "Ingrese un valor numérico finito.";
  const RA_RANGO = /RA debe estar entre 0 y 359/;
  const DEC_RANGO = /Dec debe estar entre −90° y \+90°/;

  test.fixme("F01-C09 · validación: parámetro faltante @simulado", async ({ page }) => {
    const peticiones = await sinPeticion(page);
    await buscar(page, "10.25", "");

    await expect(page.getByRole("textbox", { name: CAMPO_DEC })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toContainText(VALOR_NO_FINITO);
    await expect(page.getByRole("status")).toHaveCount(0); // ni «Buscando observaciones…» ni resultado
    await expect(estadoSinCobertura(page)).toHaveCount(0);
    expect(peticiones()).toBe(0);
  });

  for (const valor of ["NaN", "Infinity"]) {
    test.fixme(`F01-C10 · validación: ${valor} @simulado`, async ({ page }) => {
      const peticiones = await sinPeticion(page);
      await buscar(page, valor, "-12.5");

      await expect(page.getByRole("textbox", { name: CAMPO_RA })).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("alert")).toContainText(VALOR_NO_FINITO);
      await expect(estadoSinCobertura(page)).toHaveCount(0);
      expect(peticiones()).toBe(0);
    });
  }

  for (const [ra, dec, campo, mensaje] of [
    ["360", "-12.5", CAMPO_RA, RA_RANGO],
    ["-0.1", "-12.5", CAMPO_RA, RA_RANGO],
    ["10.25", "90.1", CAMPO_DEC, DEC_RANGO],
    ["10.25", "-90.1", CAMPO_DEC, DEC_RANGO],
  ] as const) {
    test.fixme(`F01-C11 · validación: fuera de rango ra=${ra} dec=${dec} @simulado`, async ({ page }) => {
      const peticiones = await sinPeticion(page);
      await buscar(page, ra, dec);

      await expect(page.getByRole("textbox", { name: campo })).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("alert")).toContainText(mensaje); // orienta el rango válido
      await expect(estadoSinCobertura(page)).toHaveCount(0);
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
  test.fixme("F01-C12 · 503 archive_unavailable y reintento @simulado", async ({ page }) => {
    await mockImages(page);
    // Primera respuesta: 503 canónico de Alexis. Segunda (tras «Reintentar búsqueda»): ready canónico.
    let llamadas = 0;
    await page.route(/\/api\/v1\/comparisons(\?.*)?$/, async (route) => {
      llamadas += 1;
      const fallo = llamadas === 1;
      await route.fulfill({
        status: fallo ? 503 : 200,
        contentType: "application/json",
        body: loadFixture(fallo ? "comparacion-error-503" : "comparacion-ready"),
      });
    });
    await buscar(page);

    // La UI muestra un alert «Error (503): <mensaje>» (no dice «fallo temporal») con reintento.
    await expect(page.getByRole("alert")).toContainText("Error (503)");
    await expect(page.getByRole("alert")).toContainText("El archivo de observaciones no está disponible");
    await expect(estadoSinCobertura(page)).toHaveCount(0); // nunca un falso no_coverage
    await page.getByRole("button", { name: "Reintentar búsqueda" }).click();
    await expect(page.getByRole("region", { name: "Comparador de épocas" })).toBeVisible();
  });

  test.fixme("F01-C13 · 503 query_timeout @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-error-503-query-timeout", 503);
    await buscar(page);

    // La UI trata todo 503 igual (reintentable): el código query_timeout no cambia el texto.
    await expect(page.getByRole("alert")).toContainText("Error (503)");
    await expect(page.getByRole("alert")).toContainText("La consulta tardó demasiado");
    await expect(page.getByRole("button", { name: "Reintentar búsqueda" })).toBeVisible();
    await expect(estadoSinCobertura(page)).toHaveCount(0);
  });

  test.fixme("F01-C14 · 500 internal_error @simulado", async ({ page }) => {
    await mockComparisons(page, "sintetico-error-500", 500);
    await buscar(page);

    await expect(page.getByRole("alert")).toContainText("Ocurrió un error inesperado.");
    await expect(page.getByRole("alert")).not.toContainText(/traceback|stack|exception/i);
    await expect(page.getByRole("button", { name: "Reintentar búsqueda" })).toHaveCount(0); // no reintentable
    await expect(page.getByRole("button", { name: "Comparar" })).toBeEnabled(); // sigue operable
  });

  test.fixme("F01-C15 · 404 image_not_found en un fotograma @simulado", async ({ page }) => {
    await mockImages(page, ["fixture-b"]);
    await mockComparisons(page, "comparacion-ready");
    await buscar(page);

    await page.getByRole("button", { name: "Mostrar época B" }).click();
    await expect(page.getByRole("alert")).toContainText("No se pudo cargar la imagen.");
    await expect(page.getByText("fixture-obs-b")).toBeVisible(); // metadatos siguen visibles
    await expect(estadoSinCobertura(page)).toHaveCount(0);
  });
});
