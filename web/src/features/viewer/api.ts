/**
 * Cliente de comparación — consume GET /api/v1/comparisons.
 *
 * En modo desarrollo/test (!import.meta.env.PROD) intercepta las llamadas
 * con fixtures locales y data-URLs SVG sintéticas para que el visor funcione sin backend.
 */
import type { ComparisonResponse } from './types.ts';
import { readyFixture } from './fixtures/comparison-ready.ts';
import { insufficientFixture } from './fixtures/comparison-insufficient.ts';
import { noCoverageFixture } from './fixtures/comparison-no-coverage.ts';

/* ------------------------------------------------------------------ */
/*  Errores HTTP específicos                                           */
/* ------------------------------------------------------------------ */

export class ArchiveUnavailableError extends Error {
  override name = 'ArchiveUnavailableError';
  readonly statusCode = 503;
}

export class ApiValidationError extends Error {
  override name = 'ApiValidationError';
  readonly statusCode = 422;
  readonly code: string;

  constructor(message: string, code = 'invalid_coordinates') {
    super(message);
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/*  Fetch real (producción / proxy Vite)                               */
/* ------------------------------------------------------------------ */

async function realFetch(
  raDeg: number | string,
  decDeg: number | string,
  signal?: AbortSignal,
): Promise<ComparisonResponse> {
  // Ruta relativa (/api/v1/..., sin localhost:8000) enviando ra_deg y dec_deg exactos sin redondear
  const url = `/api/v1/comparisons?ra_deg=${encodeURIComponent(raDeg)}&dec_deg=${encodeURIComponent(decDeg)}`;
  const res = await fetch(url, { signal });

  if (res.status === 503) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ArchiveUnavailableError(
      body?.error?.message ?? 'El servicio de archivo no está disponible temporalmente.',
    );
  }

  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiValidationError(
      body?.error?.message ?? 'Coordenadas inválidas. RA debe estar en [0, 360) y Dec en [-90, 90].',
      body?.error?.code ?? 'invalid_coordinates',
    );
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Error HTTP ${res.status}`);
  }

  return res.json() as Promise<ComparisonResponse>;
}

/* ------------------------------------------------------------------ */
/*  Mock para desarrollo / pruebas                                     */
/* ------------------------------------------------------------------ */

export let mockDelayMs = 250;

export function setMockDelayMs(ms: number): void {
  mockDelayMs = ms;
}

/** Rastreo de intentos por par (ra, dec) para simular 503 con reintento. */
const mockAttempts = new Map<string, number>();

/** Reinicia el rastreo de intentos (útil en tests). */
export function resetMockAttempts(): void {
  mockAttempts.clear();
}

function cloneWithQuery(
  base: ComparisonResponse,
  ra: number,
  dec: number,
): ComparisonResponse {
  return {
    ...base,
    query: { ...base.query, ra_deg: ra, dec_deg: dec },
    checked_at: new Date().toISOString(),
  };
}

async function mockFetch(
  raDeg: number | string,
  decDeg: number | string,
  signal?: AbortSignal,
): Promise<ComparisonResponse> {
  const numRa = typeof raDeg === 'string' ? parseFloat(raDeg) : raDeg;
  const numDec = typeof decDeg === 'string' ? parseFloat(decDeg) : decDeg;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, mockDelayMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('This operation was aborted', 'AbortError'));
    });
  });

  // Validación 422: Coordenadas inválidas
  if (
    !Number.isFinite(numRa) ||
    !Number.isFinite(numDec) ||
    numRa < 0 ||
    numRa >= 360 ||
    numDec < -90 ||
    numDec > 90
  ) {
    throw new ApiValidationError(
      'Coordenadas fuera de rango: RA debe estar en [0, 360) y Dec en [-90, 90].',
      'invalid_coordinates',
    );
  }

  const key = `${raDeg},${decDeg}`;
  const attempts = (mockAttempts.get(key) ?? 0) + 1;
  mockAttempts.set(key, attempts);

  // Región de error 503: simula fallo temporal en el primer intento, reintento devuelve ready
  if (numRa >= 0 && numRa < 1 && numDec >= 0 && numDec < 1 && attempts === 1) {
    throw new ArchiveUnavailableError(
      'El servicio de archivo no está disponible temporalmente. Intente de nuevo.',
    );
  }

  // Región sin cobertura (polos)
  if (numDec > 85 || numDec < -85) {
    return cloneWithQuery(noCoverageFixture, numRa, numDec);
  }

  // Región insuficiente (una sola época)
  if ((numDec > 60 && numDec <= 85) || (numDec < -60 && numDec >= -85)) {
    return cloneWithQuery(insufficientFixture, numRa, numDec);
  }

  // Ready (A/B disponible)
  return cloneWithQuery(readyFixture, numRa, numDec);
}

/* ------------------------------------------------------------------ */
/*  Exportación principal                                              */
/* ------------------------------------------------------------------ */

export async function fetchComparison(
  raDeg: number | string,
  decDeg: number | string,
  signal?: AbortSignal,
): Promise<ComparisonResponse> {
  if (!import.meta.env.PROD) {
    return mockFetch(raDeg, decDeg, signal);
  }
  return realFetch(raDeg, decDeg, signal);
}
