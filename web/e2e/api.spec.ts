// F01 · API directa (REAL, sin UI y SIN mocks). Todos pendientes (test.fixme): la API de comparaciones
// aún no existe en el repo.
// Confirmado por Alexis: RA/Dec se validan en el navegador y también en la API. Aquí se prueba la API.
// Se ejecuta contra E2E_BASE_URL (API local de Isaac o demo desplegada): anotar URL y SHA evaluados
// en docs/qa/aceptacion/F01-matriz.csv. Esto NO es un resultado simulado.
import { expect, test } from "@playwright/test";

const RUTA = "/api/v1/comparisons";

async function esperar422(request: import("@playwright/test").APIRequestContext, query: string) {
  const respuesta = await request.get(`${RUTA}${query}`);
  expect(respuesta.status(), `GET ${RUTA}${query}`).toBe(422);
  const cuerpo = await respuesta.json();
  expect(cuerpo.error.code).toBe("invalid_coordinates");
  expect(typeof cuerpo.error.message).toBe("string");
}

test.describe("F01 API directa · 422 invalid_coordinates [REAL]", () => {
  for (const query of [
    "",                              // ambos ausentes
    "?ra_deg=10.25",                 // dec_deg ausente
    "?dec_deg=-12.5",                // ra_deg ausente
    "?ra_deg=10.25&dec_deg=",        // dec_deg vacío
    "?ra_deg=&dec_deg=-12.5",        // ra_deg vacío
  ]) {
    test.fixme(`F01-R03a · 422 parámetro faltante o vacío ${query || "(sin parámetros)"} @real`, async ({ request }) => {
      await esperar422(request, query);
    });
  }

  for (const query of [
    "?ra_deg=NaN&dec_deg=-12.5",
    "?ra_deg=10.25&dec_deg=NaN",
    "?ra_deg=Infinity&dec_deg=-12.5",
    "?ra_deg=10.25&dec_deg=-Infinity",
  ]) {
    test.fixme(`F01-R03b · 422 NaN/Infinity ${query} @real`, async ({ request }) => {
      await esperar422(request, query);
    });
  }

  for (const query of [
    "?ra_deg=360&dec_deg=-12.5",     // ra < 360: 360 es inválido
    "?ra_deg=-0.1&dec_deg=-12.5",
    "?ra_deg=10.25&dec_deg=90.1",
    "?ra_deg=10.25&dec_deg=-90.1",
  ]) {
    test.fixme(`F01-R03c · 422 fuera de rango ${query} @real`, async ({ request }) => {
      await esperar422(request, query);
    });
  }

  // Parámetro repetido: ra_deg (o dec_deg) indicado más de una vez es ambiguo y debe rechazarse.
  // La API de Isaac ya lo valida (api/planetx/http/coordinates.py); aquí se comprueba desde fuera.
  for (const query of [
    "?ra_deg=10.25&ra_deg=11&dec_deg=-12.5",
    "?ra_deg=10.25&dec_deg=-12.5&dec_deg=-13",
  ]) {
    test.fixme(`F01-R03d · 422 parámetro repetido ${query} @real`, async ({ request }) => {
      await esperar422(request, query);
    });
  }

  // Límite válido: ra=0 y dec=90 NO deben dar 422 (pueden dar 200 o 503 según el archivo).
  // Nota: puede disparar una consulta real al archivo; ejecutar con criterio.
  test.fixme("F01-R03c · límites válidos ra=0 dec=90 no devuelven 422 @real", async ({ request }) => {
    const respuesta = await request.get(`${RUTA}?ra_deg=0&dec_deg=90`);
    expect(respuesta.status()).not.toBe(422);
  });
});
