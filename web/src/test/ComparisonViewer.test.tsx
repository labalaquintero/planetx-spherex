import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComparisonViewer } from '../features/viewer/components/ComparisonViewer.tsx';
import { readyFixture } from '../features/viewer/fixtures/comparison-ready.ts';
import { insufficientFixture } from '../features/viewer/fixtures/comparison-insufficient.ts';

describe('ComparisonViewer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('muestra la primera época por defecto con su imagen y procedencia', () => {
    render(<ComparisonViewer data={readyFixture} />);

    expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
    expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();
    expect(screen.getByTestId('btn-epoch-a')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('btn-epoch-b')).toHaveAttribute('aria-pressed', 'false');

    // Metadatos de procedencia visibles
    expect(screen.getByTestId('provenance-panel')).toBeInTheDocument();
    expect(screen.getByText('fixture-obs-a')).toBeInTheDocument();
  });

  it('permite alternar entre épocas A y B mediante los botones de época', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComparisonViewer data={readyFixture} />);

    // Alternar a B
    const btnB = screen.getByTestId('btn-epoch-b');
    await user.click(btnB);

    expect(btnB).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('btn-epoch-a')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();
    expect(screen.getByText('fixture-obs-b')).toBeInTheDocument();

    // Alternar a A
    const btnA = screen.getByTestId('btn-epoch-a');
    await user.click(btnA);

    expect(btnA).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();
  });

  it('avanza y retrocede épocas con los botones previo y siguiente', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComparisonViewer data={readyFixture} />);

    const nextBtn = screen.getByTestId('btn-next');
    const prevBtn = screen.getByTestId('btn-prev');

    // Siguiente -> B
    await user.click(nextBtn);
    expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();

    // Siguiente cicla -> A
    await user.click(nextBtn);
    expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();

    // Previo cicla -> B
    await user.click(prevBtn);
    expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();
  });

  it('inicia y pausa la reproducción automática mediante el botón Play/Pausa', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComparisonViewer data={readyFixture} />);

    const playBtn = screen.getByTestId('btn-play');
    expect(playBtn).toHaveTextContent('Play');

    // Iniciar reproducción
    await user.click(playBtn);
    expect(playBtn).toHaveTextContent('Pausa');

    // Avanza a B después de 1500ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();

    // Avanza de nuevo a A después de otros 1500ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();

    // Pausar
    await user.click(playBtn);
    expect(playBtn).toHaveTextContent('Play');

    // Al avanzar el tiempo no cambia
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();
  });

  it('permite navegación accesible por teclado (flechas y espacio)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComparisonViewer data={readyFixture} />);

    const viewer = screen.getByTestId('comparison-viewer');
    viewer.focus();

    // Flecha derecha avanza
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText(/Época B — 2 de 2/)).toBeInTheDocument();

    // Flecha izquierda retrocede
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText(/Época A — 1 de 2/)).toBeInTheDocument();

    // Espacio inicia Play
    await user.keyboard(' ');
    expect(screen.getByTestId('btn-play')).toHaveTextContent('Pausa');

    // Espacio pausa
    await user.keyboard(' ');
    expect(screen.getByTestId('btn-play')).toHaveTextContent('Play');
  });

  it('si hay un solo fotograma (insuficiente), se muestra sin controles de reproducción', () => {
    render(<ComparisonViewer data={insufficientFixture} />);

    expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
    expect(screen.getByText(/Época A — 1 de 1/)).toBeInTheDocument();

    // No debe haber controles de reproducción (canPlay = false)
    expect(screen.queryByTestId('btn-play')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-prev')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-next')).not.toBeInTheDocument();
  });
});
