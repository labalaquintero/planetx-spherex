// Utilidades de los specs de aceptación F01 (SIMULADO).
// Los fixtures son sintéticos y provisionales: ver fixtures/README.md.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page, Route } from "@playwright/test";

// PNG de 1x1 de relleno: sólo evita imágenes rotas en los mocks. No es una imagen de SPHEREx.
const PNG_PLACEHOLDER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const COMPARISONS = /\/api\/v1\/comparisons(\?.*)?$/;
const IMAGES = /\/api\/v1\/images\/[^/?]+$/;

// Los fixtures `comparacion-*` son los CANÓNICOS de Alexis (web/src/contracts/fixtures/): sólo se
// leen, nunca se editan. El resto (`sintetico-*`) son míos y cubren lo que los canónicos no cubren.
export function loadFixture(name: string): string {
  const dir = name.startsWith("comparacion-") ? "../src/contracts/fixtures/" : "./fixtures/";
  return readFileSync(
    fileURLToPath(new URL(`${dir}${name}.json`, import.meta.url)),
    "utf-8",
  );
}

/** Intercepta /api/v1/comparisons y responde con un fixture sintético. */
export async function mockComparisons(
  page: Page,
  fixtureName: string,
  status = 200,
  onRoute?: (route: Route) => Promise<void> | void,
): Promise<void> {
  await page.route(COMPARISONS, async (route) => {
    await onRoute?.(route);
    await route.fulfill({
      status,
      contentType: "application/json",
      body: loadFixture(fixtureName),
    });
  });
}

/** Intercepta /api/v1/images/{id}: PNG de relleno, o 404 image_not_found para `missingIds`. */
export async function mockImages(
  page: Page,
  missingIds: string[] = [],
): Promise<void> {
  await page.route(IMAGES, async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    if (missingIds.includes(id)) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: loadFixture("sintetico-error-404-image"),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: PNG_PLACEHOLDER,
    });
  });
}
