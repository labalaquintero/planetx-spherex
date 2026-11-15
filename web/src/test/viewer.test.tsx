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

      await user.click(screen.getByRole('button', { name: 'Comparar' }));

      expect(screen.getAllByRole('alert')).toHaveLength(2);
      expect(screen.getByTestId('ra-input')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('dec-input')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('valida que RA cumpla 0 ≤ ra_deg < 360', async () => {
      const user = userEvent.setup();
      render(<App />);

      const raInput = screen.getByTestId('ra-input');
      const decInput = screen.getByTestId('dec-input');
      const submitBtn = screen.getByRole('button', { name: 'Comparar' });

      // RA = 360 (inválido: debe ser estrictamente menor a 360)
      await user.type(raInput, '360');
      await user.type(decInput, '0');
      await user.click(submitBtn);

      expect(screen.getByText(/RA debe estar entre 0° y 359/)).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      // RA = -0.5 (inválido)
      await user.clear(raInput);
      await user.type(raInput, '-0.5');
      await user.click(submitBtn);

      expect(screen.getByText(/RA debe estar entre 0° y 359/)).toBeInTheDocument();

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
      const submitBtn = screen.getByRole('button', { name: 'Comparar' });

      await user.type(raInput, '180');

      // Dec = 90.5 (inválido)
      await user.type(decInput, '90.5');
      await user.click(submitBtn);

      expect(screen.getByText(/Dec debe estar entre −90° y \+90°/)).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

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

      // Cargar caso ready con el botón "Usar ejemplo"
      await user.click(screen.getByRole('button', { name: 'Usar ejemplo' }));

      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'Comparación' })).toBeInTheDocument();
      });

      // 1. Sin reproducción automática al cargar:
      const playBtn = screen.getByRole('button', { name: 'Reproducir' });
      expect(playBtn).toBeInTheDocument();
      expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver A' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Ver B' })).toHaveAttribute('aria-pressed', 'false');

      // 2. Alternancia manual mediante botones de época Ver A / Ver B:
      await user.click(screen.getByRole('button', { name: 'Ver B' }));
      expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver B' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Ver A' })).toHaveAttribute('aria-pressed', 'false');

      await user.click(screen.getByRole('button', { name: 'Ver A' }));
      expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();

      // 3. Botones Anterior y Siguiente:
      await user.click(screen.getByRole('button', { name: 'Fotograma siguiente' }));
      expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Fotograma siguiente' }));
      expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Fotograma anterior' }));
      expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();

      // 4. Reproducir / Pausar:
      await user.click(screen.getByRole('button', { name: 'Reproducir' }));
      expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();

      // Avanzar timer 1500ms
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();

      // Pausar
      await user.click(screen.getByRole('button', { name: 'Pausar' }));
      expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();

      // Al avanzar tiempo, permanece fijo
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  3. Cancelación de consulta previa y detención de reproducción     */
  /* ------------------------------------------------------------------ */
  describe('Cancelación y control de concurrencia', () => {
    it('cancela la consulta anterior y detiene la reproducción si se lanza una segunda búsqueda', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      // Primera búsqueda (ready)
      await user.click(screen.getByRole('button', { name: 'Usar ejemplo' }));

      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'Comparación' })).toBeInTheDocument();
      });

      // Iniciar reproducción
      await user.click(screen.getByRole('button', { name: 'Reproducir' }));
      expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();

      // Segunda búsqueda inmediata con mayor delay simulado
      setMockDelayMs(100);
      await user.click(screen.getByRole('button', { name: 'Caso preparado: Sin cobertura' }));

      // Debe mostrar loading inmediatamente
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Al completarse la segunda consulta, muestra el resultado de la segunda búsqueda
      await waitFor(() => {
        expect(screen.getByTestId('status-no-coverage')).toBeInTheDocument();
      });

      // El visor previo y su reproducción ya no existen
      expect(screen.queryByRole('region', { name: 'Comparación' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reproducir' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  4. Renderizado correcto de estados                                */
  /* ------------------------------------------------------------------ */
  describe('Renderizado de estados del visor', () => {
    it('estado ready: muestra fecha UTC, banda, IDs, source_url y aviso de límites', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Usar ejemplo' }));

      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'Comparación' })).toBeInTheDocument();
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

      // Enlace de origen (source_url con nombre accesible Fuente (IRSA))
      const sourceLink = screen.getByRole('link', { name: 'Fuente (IRSA)' });
      expect(sourceLink).toHaveAttribute(
        'href',
        'https://irsa.ipac.caltech.edu/data/SPHEREx/overview_dr1.html',
      );
      expect(sourceLink).toHaveAttribute('target', '_blank');

      // Aviso de límites científicos (un cambio visible no prueba un hallazgo)
      expect(
        screen.getByText(
          /Un cambio visible no prueba un hallazgo/i,
        ),
      ).toBeInTheDocument();

      // Etiqueta visible de datos de prueba
      expect(screen.getByTestId('test-data-badge')).toHaveTextContent('Datos de prueba');
    });

    it('estado insufficient: muestra 1 fotograma fijo sin controles de reproducción', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Caso preparado: Insuficiente' }));

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
      expect(screen.getByRole('region', { name: 'Comparación' })).toBeInTheDocument();
      expect(screen.getByText(/Fotograma 1 de 1/)).toBeInTheDocument();

      // Sin controles de reproducción
      expect(screen.queryByRole('button', { name: 'Reproducir' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Fotograma anterior' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Fotograma siguiente' })).not.toBeInTheDocument();
    });

    it('estado no_coverage: explica la ausencia sin afirmar ausencia global', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Caso preparado: Sin cobertura' }));

      await waitFor(() => {
        expect(screen.getByTestId('status-no-coverage')).toBeInTheDocument();
      });

      const statusNoCov = screen.getByTestId('status-no-coverage');
      expect(statusNoCov).toHaveTextContent(/Sin cobertura/);
      expect(statusNoCov).toHaveTextContent(
        /La ausencia de resultados en esta consulta no implica ausencia global de datos/,
      );
      expect(screen.queryByRole('region', { name: 'Comparación' })).not.toBeInTheDocument();
    });

    it('estado fallo temporal (503) con botón Reintentar', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Preset de error temporal (0.5, 0.5)
      await user.click(screen.getByRole('button', { name: 'Caso preparado: Fallo temporal' }));

      // Error 503 inicial
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const statusError = screen.getByRole('alert');
      expect(statusError).toHaveTextContent(/Fallo temporal/);
      expect(statusError).toHaveTextContent(
        /El servicio de archivo no está disponible temporalmente/,
      );

      // Botón Reintentar visible y funcional
      const retryBtn = screen.getByRole('button', { name: 'Reintentar' });
      expect(retryBtn).toBeInTheDocument();

      // Clic en reintentar
      await user.click(retryBtn);

      // Segundo intento tiene éxito y muestra estado ready
      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'Comparación' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
