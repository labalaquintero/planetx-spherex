import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useComparison } from '../features/viewer/hooks/useComparison.ts';
import { resetMockAttempts, setMockDelayMs } from '../features/viewer/api.ts';

describe('useComparison hook', () => {
  beforeEach(() => {
    resetMockAttempts();
    setMockDelayMs(10);
  });

  it('inicia en estado idle', () => {
    const { result } = renderHook(() => useComparison());
    expect(result.current.state.kind).toBe('idle');
  });

  it('transiciona a loading y luego a success con datos', async () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      void result.current.search(10.25, -12.5);
    });

    expect(result.current.state.kind).toBe('loading');

    await waitFor(() => {
      expect(result.current.state.kind).toBe('success');
    });

    if (result.current.state.kind === 'success') {
      expect(result.current.state.data.status).toBe('ready');
      expect(result.current.state.data.frames).toHaveLength(2);
    }
  });

  it('cancela la consulta anterior si se inicia una nueva antes de que termine', async () => {
    setMockDelayMs(80);
    const { result } = renderHook(() => useComparison());

    // Iniciar primera búsqueda (cobertura insuficiente)
    act(() => {
      void result.current.search(50, 70);
    });
    expect(result.current.state.kind).toBe('loading');

    // Iniciar de inmediato segunda búsqueda (ready) antes de que termine la primera
    act(() => {
      void result.current.search(10.25, -12.5);
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe('success');
    });

    if (result.current.state.kind === 'success') {
      // Debe reflejar la SEGUNDA búsqueda (10.25, -12.5), no la primera
      expect(result.current.state.data.query.ra_deg).toBe(10.25);
      expect(result.current.state.data.query.dec_deg).toBe(-12.5);
      expect(result.current.state.data.status).toBe('ready');
    }
  });

  it('maneja error 503 con retryable y reintento exitoso', async () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      void result.current.search(0.5, 0.5);
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe('error');
    });

    if (result.current.state.kind === 'error') {
      expect(result.current.state.retryable).toBe(true);
      expect(result.current.state.statusCode).toBe(503);
    }

    // Reintentar
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe('success');
    });

    if (result.current.state.kind === 'success') {
      expect(result.current.state.data.status).toBe('ready');
    }
  });

  it('maneja error 422 para coordenadas no válidas', async () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      void result.current.search(400, 0);
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe('error');
    });

    if (result.current.state.kind === 'error') {
      expect(result.current.state.retryable).toBe(false);
      expect(result.current.state.statusCode).toBe(422);
      expect(result.current.state.code).toBe('invalid_coordinates');
    }
  });
});
