import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from '../App.tsx';
import { resetMockAttempts, setMockDelayMs } from '../features/viewer/api.ts';

describe('Visor F01 — Pruebas de integración y componentes', () => {
  beforeEach(() => {
    resetMockAttempts();
    setMockDelayMs(10);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /* ------------------------------------------------------------------ */
  /*  1. Validación en cliente de RA y Dec en grados ICRS                */
  /* ------------------------------------------------------------------ */
  describe('Validación en cliente de coordenadas ICRS', () => {
    it('rechaza campos vacíos e impide la consulta', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByTestId('submit-btn'));

      expect(screen.getAllByRole('alert')).toHaveLength(2);
      expect(screen.getByTestId('ra-input')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('dec-input')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('status-loading')).not.toBeInTheDocument();
    });

    it('valida que RA cumpla 0 ≤ ra_deg < 360', async () => {
      const user = userEvent.setup();
      render(<App />);

      const raInput = screen.getByTestId('ra-input');
      const decInput = screen.getByTestId('dec-input');
      const submitBtn = screen.getByTestId('submit-btn');

      // RA = 360 (inválido: debe ser estrictamente menor a 360)
      await user.type(raInput, '360');
      await user.type(decInput, '0');
      await user.click(submitBtn);

      expect(screen.getByText(/RA debe estar entre 0 y 359/)).toBeInTheDocument();
      expect(screen.queryByTestId('status-loading')).not.toBeInTheDocument();

      // RA = -0.5 (inválido)
      await user.clear(raInput);
      await user.type(raInput, '-0.5');
      await user.click(submitBtn);

      expect(screen.getByText(/RA debe estar entre 0 y 359/)).toBeInTheDocument();

      // RA = 359.99 (válido)
      await user.clear(raInput);
      await user.type(raInput, '359.99');
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('valida que Dec cumpla -90 ≤ dec_deg ≤ 90', async () => {
      const user = userEvent.setup();
      render(<App />);

      const raInput = screen.getByTestId('ra-input');
      const decInput = screen.getByTestId('dec-input');
      const submitBtn = screen.getByTestId('submit-btn');

      await user.type(raInput, '180');

      // Dec = 90.5 (inválido)
      await user.type(decInput, '90.5');
      await user.click(submitBtn);

      expect(screen.getByText(/Dec debe estar entre −90° y \+90°/)).toBeInTheDocument();
      expect(screen.queryByTestId('status-loading')).not.toBeInTheDocument();

      // Dec = -91 (inválido)
      await user.clear(decInput);
      await user.type(decInput, '-91');
      await user.click(submitBtn);

      expect(screen.getByText(/Dec debe estar entre −90° y \+90°/)).toBeInTheDocument();

      // Dec = -90 (límite válido)
      await user.clear(decInput);
      await user.type(decInput, '-90');
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  2. Alternancia A/B, Anterior/Siguiente y Reproducir/Pausar        */
  /* ------------------------------------------------------------------ */
  describe('Alternancia entre fotogramas y controles de reproducción', () => {
    it('no reproduce automáticamente al cargar y permite alternar entre A/B, anterior/siguiente y play/pause', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      // Cargar caso ready
      await user.click(screen.getByTestId('preset-ready'));
      await user.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
      });

      // 1. Sin reproducción automática al cargar:
      const playBtn = screen.getByTestId('btn-play');
      expect(playBtn).toHaveTextContent('Play');
      expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();
      expect(screen.getByTestId('btn-epoch-a')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('btn-epoch-b')).toHaveAttribute('aria-pressed', 'false');

      // 2. Alternancia manual mediante botones de época A / B:
      await user.click(screen.getByTestId('btn-epoch-b'));
      expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();
      expect(screen.getByTestId('btn-epoch-b')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('btn-epoch-a')).toHaveAttribute('aria-pressed', 'false');

      await user.click(screen.getByTestId('btn-epoch-a'));
      expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();

      // 3. Botones Anterior y Siguiente:
      await user.click(screen.getByTestId('btn-next'));
      expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();

      await user.click(screen.getByTestId('btn-next'));
      expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();

      await user.click(screen.getByTestId('btn-prev'));
      expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();

      // 4. Reproducir / Pausar:
      await user.click(playBtn);
      expect(screen.getByTestId('btn-play')).toHaveTextContent('Pausa');

      // Avanzar timer 1500ms
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();

      // Pausar
      await user.click(screen.getByTestId('btn-play'));
      expect(screen.getByTestId('btn-play')).toHaveTextContent('Play');

      // Al avanzar tiempo, permanece fijo
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  3. Cancelación de consulta previa y detención de reproducción     */
  /* ------------------------------------------------------------------ */
  describe('Cancelación y control de concurrencia', () => {
    it('cancela la consulta anterior y detiene la reproducción si se inicia una segunda búsqueda', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      // Primera búsqueda (ready)
      await user.click(screen.getByTestId('preset-ready'));
      await user.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
      });

      // Iniciar reproducción
      await user.click(screen.getByTestId('btn-play'));
      expect(screen.getByTestId('btn-play')).toHaveTextContent('Pausa');

      // Segunda búsqueda inmediata con mayor delay simulado
      setMockDelayMs(100);
      await user.click(screen.getByTestId('preset-no-coverage'));
      await user.click(screen.getByTestId('submit-btn'));

      // Debe mostrar loading inmediatamente
      expect(screen.getByTestId('status-loading')).toBeInTheDocument();

      // Al completarse la segunda consulta, muestra el resultado de la segunda búsqueda
      await waitFor(() => {
        expect(screen.getByTestId('status-no-coverage')).toBeInTheDocument();
      });

      // El visor previo y su reproducción ya no existen
      expect(screen.queryByTestId('comparison-viewer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-play')).not.toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  4. Renderizado correcto de estados                                */
  /* ------------------------------------------------------------------ */
  describe('Renderizado de estados del visor', () => {
    it('estado ready: muestra fecha UTC, banda, IDs, source_url y aviso de límites', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByTestId('preset-ready'));
      await user.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
      });

      // Panel de procedencia
      const provenance = screen.getByTestId('provenance-panel');
      expect(provenance).toBeInTheDocument();

      // Fecha UTC y formato
      expect(provenance).toHaveTextContent(/UTC/);

      // Banda
      expect(provenance).toHaveTextContent(/1.25 ± 0.02 µm/);

      // IDs de observación y de fotograma
      expect(provenance).toHaveTextContent('fixture-obs-a');
      expect(provenance).toHaveTextContent('fixture-a');

      // Enlace de origen (source_url)
      const sourceLink = screen.getByRole('link', { name: /Enlace al archivo/i });
      expect(sourceLink).toHaveAttribute(
        'href',
        'https://irsa.ipac.caltech.edu/data/SPHEREx/overview_dr1.html',
      );
      expect(sourceLink).toHaveAttribute('target', '_blank');

      // Aviso de límites científicos
      expect(
        screen.getByText(
          /Un cambio visible entre épocas no constituye por sí solo evidencia de un hallazgo/i,
        ),
      ).toBeInTheDocument();

      // Etiqueta visible de datos de prueba
      expect(screen.getByTestId('test-data-badge')).toHaveTextContent('Datos de prueba');
    });

    it('estado insufficient: muestra 1 fotograma fijo sin controles de reproducción', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByTestId('preset-insufficient'));
      await user.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('status-insufficient')).toBeInTheDocument();
      });

      // Mensaje con razón explicativa
      const statusInsuf = screen.getByTestId('status-insufficient');
      expect(statusInsuf).toHaveTextContent(/Cobertura insuficiente/);
      expect(statusInsuf).toHaveTextContent(
        /Solo se encontró una época de observación para esta región/,
      );

      // 1 fotograma fijo mostrado
      expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
      expect(screen.getByText(/Época A — 1 de 1/)).toBeInTheDocument();

      // Sin controles de reproducción
      expect(screen.queryByTestId('btn-play')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-prev')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-next')).not.toBeInTheDocument();
    });

    it('estado no_coverage: explica la ausencia sin afirmar ausencia global', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByTestId('preset-no-coverage'));
      await user.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('status-no-coverage')).toBeInTheDocument();
      });

      const statusNoCov = screen.getByTestId('status-no-coverage');
      expect(statusNoCov).toHaveTextContent(/Sin cobertura/);
      expect(statusNoCov).toHaveTextContent(
        /La ausencia de resultados en esta consulta no implica ausencia global de datos/,
      );
      expect(screen.queryByTestId('comparison-viewer')).not.toBeInTheDocument();
    });

    it('estado error 503 con botón Reintentar', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Preset de error temporal (0.5, 0.5)
      await user.click(screen.getByTestId('preset-error'));
      await user.click(screen.getByTestId('submit-btn'));

      // Error 503 inicial
      await waitFor(() => {
        expect(screen.getByTestId('status-error')).toBeInTheDocument();
      });

      const statusError = screen.getByTestId('status-error');
      expect(statusError).toHaveTextContent(/Error \(503\)/);
      expect(statusError).toHaveTextContent(
        /El servicio de archivo no está disponible temporalmente/,
      );

      // Botón Reintentar visible y funcional
      const retryBtn = screen.getByTestId('retry-btn');
      expect(retryBtn).toHaveTextContent(/Reintentar búsqueda/i);

      // Clic en reintentar
      await user.click(retryBtn);

      // Segundo intento tiene éxito y muestra estado ready
      await waitFor(() => {
        expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('status-error')).not.toBeInTheDocument();
    });
  });
});
