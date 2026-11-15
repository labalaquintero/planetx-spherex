import { useState, useCallback, useRef } from 'react';
import { fetchComparison, ArchiveUnavailableError, ApiValidationError } from '../api.ts';
import type { ViewerState } from '../types.ts';

/**
 * Hook que gestiona la búsqueda de comparaciones.
 *
 * - Aborta la petición anterior si se lanza una nueva consulta.
 * - Distingue errores 503 (reintentables) y 422 (validación).
 * - Expone `retry()` para repetir la última búsqueda fallida.
 */
export function useComparison() {
  const [state, setState] = useState<ViewerState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<{ ra: number; dec: number } | null>(null);

  const search = useCallback(async (raDeg: number, decDeg: number) => {
    // Abortar búsqueda anterior activa
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastQueryRef.current = { ra: raDeg, dec: decDeg };

    setState({ kind: 'loading' });

    try {
      const data = await fetchComparison(raDeg, decDeg, controller.signal);
      if (!controller.signal.aborted) {
        setState({ kind: 'success', data });
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      if (err instanceof ArchiveUnavailableError) {
        setState({
          kind: 'error',
          message: err.message,
          retryable: true,
          statusCode: 503,
          code: 'archive_unavailable',
        });
      } else if (err instanceof ApiValidationError) {
        setState({
          kind: 'error',
          message: err.message,
          retryable: false,
          statusCode: 422,
          code: err.code,
        });
      } else {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Error inesperado',
          retryable: false,
        });
      }
    }
  }, []);

  const retry = useCallback(() => {
    const last = lastQueryRef.current;
    if (last) {
      void search(last.ra, last.dec);
    }
  }, [search]);

  return { state, search, retry } as const;
}
