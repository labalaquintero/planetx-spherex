import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App.tsx';
import * as comparisonApi from '../features/viewer/api.ts';

describe('Integración App — Visor F01', () => {
  beforeEach(() => {
    comparisonApi.resetMockAttempts();
    comparisonApi.setMockDelayMs(10); // Pruebas rápidas por defecto
  });

  it('inicia con el acceso al caso preparado y la búsqueda manual', () => {
    render(<App />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparar WISE 0855' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar coordenadas' })).toHaveAttribute('href', '#buscar');
  });

  it('consulta WISE 0855 con la precisión del catálogo y rellena el formulario', async () => {
    const fetchComparison = vi.spyOn(comparisonApi, 'fetchComparison');
    try {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: 'Comparar WISE 0855' }));

      expect(screen.getByTestId('ra-input')).toHaveValue('133.795129166667');
      expect(screen.getByTestId('dec-input')).toHaveValue('-7.245147222222');
      expect(fetchComparison).toHaveBeenCalledWith(133.795129166667, -7.245147222222, expect.any(AbortSignal));
    } finally {
      fetchComparison.mockRestore();
    }
  });

  it('muestra estado cargando mientras la petición está en curso', async () => {
    comparisonApi.setMockDelayMs(200);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('preset-ready'));
    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('status-loading')).toBeInTheDocument();
    expect(screen.getByText('Buscando observaciones…')).toBeInTheDocument();
  });

  it('flujo exitoso (ready): muestra visor A/B con procedencia UTC', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('preset-ready'));
    await user.click(screen.getByTestId('submit-btn'));

    // Llega a ready
    await waitFor(() => {
      expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
    });

    expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();
    expect(screen.getByTestId('btn-play')).toBeInTheDocument();

    // Metadatos de procedencia
    const provenance = screen.getByTestId('provenance-panel');
    expect(provenance).toBeInTheDocument();
    expect(provenance).toHaveTextContent(/RA 10.25°, Dec -12.5°/);
    expect(provenance).toHaveTextContent(/1.25 ± 0.02 µm/);
    expect(provenance).toHaveTextContent(/UTC/);
  });

  it('estado insufficient: muestra mensaje claro y fotograma único sin controles de play', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('preset-insufficient'));
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('status-insufficient')).toBeInTheDocument();
    });

    const statusEl = screen.getByTestId('status-insufficient');
    expect(statusEl).toHaveTextContent(/Cobertura insuficiente/);
    expect(statusEl).toHaveTextContent(
      /Solo se encontró una época de observación para esta región/,
    );

    // El fotograma único se muestra
    expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-play')).not.toBeInTheDocument();
  });

  it('estado no_coverage: muestra aviso sin afirmar ausencia global', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('preset-no-coverage'));
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('status-no-coverage')).toBeInTheDocument();
    });

    const statusEl = screen.getByTestId('status-no-coverage');
    expect(statusEl).toHaveTextContent(/Sin cobertura/);
    expect(statusEl).toHaveTextContent(
      /La ausencia de resultados en esta consulta no implica ausencia global/,
    );
    expect(screen.queryByTestId('comparison-viewer')).not.toBeInTheDocument();
  });

  it('estado error 503 con reintento exitoso', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Preset de error temporal (0.5, 0.5)
    await user.click(screen.getByTestId('preset-error'));
    await user.click(screen.getByTestId('submit-btn'));

    // Primer intento falla con 503
    await waitFor(() => {
      expect(screen.getByTestId('status-error')).toBeInTheDocument();
    });

    const errorEl = screen.getByTestId('status-error');
    expect(errorEl).toHaveTextContent(/Error \(503\)/);
    expect(errorEl).toHaveTextContent(
      /El servicio de archivo no está disponible temporalmente/,
    );

    // Botón de reintento visible
    const retryBtn = screen.getByTestId('retry-btn');
    expect(retryBtn).toBeInTheDocument();

    // Reintentar
    await user.click(retryBtn);

    // Segundo intento tiene éxito y muestra ready
    await waitFor(() => {
      expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('status-error')).not.toBeInTheDocument();
  });
});
