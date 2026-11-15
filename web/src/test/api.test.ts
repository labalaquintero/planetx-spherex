import { describe, it, expect, beforeEach } from 'vitest';
import {
  fetchComparison,
  ApiValidationError,
  ArchiveUnavailableError,
  resetMockAttempts,
  setMockDelayMs,
} from '../features/viewer/api.ts';

describe('API client (mock)', () => {
  beforeEach(() => {
    resetMockAttempts();
    setMockDelayMs(10);
  });

  it('devuelve comparación ready para coordenadas estándar', async () => {
    const res = await fetchComparison(10.25, -12.5);
    expect(res.status).toBe('ready');
    expect(res.frames).toHaveLength(2);
    expect(res.query.ra_deg).toBe(10.25);
    expect(res.query.dec_deg).toBe(-12.5);
  });

  it('lanza ApiValidationError (422) si RA o Dec están fuera de rango', async () => {
    await expect(fetchComparison(360, 0)).rejects.toThrow(ApiValidationError);
    await expect(fetchComparison(-1, 0)).rejects.toThrow(ApiValidationError);
    await expect(fetchComparison(100, 95)).rejects.toThrow(ApiValidationError);
    await expect(fetchComparison(100, -95)).rejects.toThrow(ApiValidationError);
    await expect(fetchComparison(NaN, 0)).rejects.toThrow(ApiValidationError);
  });

  it('lanza ArchiveUnavailableError (503) en el primer intento para coordenadas de error y tiene éxito en el reintento', async () => {
    await expect(fetchComparison(0.5, 0.5)).rejects.toThrow(ArchiveUnavailableError);

    // Segundo intento (reintento)
    const retryRes = await fetchComparison(0.5, 0.5);
    expect(retryRes.status).toBe('ready');
  });

  it('respeta la cancelación mediante AbortSignal', async () => {
    const controller = new AbortController();
    setMockDelayMs(100);

    const promise = fetchComparison(10.25, -12.5, controller.signal);
    controller.abort();

    await expect(promise).rejects.toThrow();
  });
});
