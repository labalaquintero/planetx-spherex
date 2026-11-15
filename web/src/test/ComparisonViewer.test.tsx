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

    expect(screen.getByRole('region', { name: 'Comparación' })).toBeInTheDocument();
    expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver A' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ver B' })).toHaveAttribute('aria-pressed', 'false');

    // Metadatos de procedencia visibles
    expect(screen.getByTestId('provenance-panel')).toBeInTheDocument();
    expect(screen.getByText('fixture-obs-a')).toBeInTheDocument();
  });

  it('permite alternar entre épocas A y B mediante los botones Ver A / Ver B', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComparisonViewer data={readyFixture} />);

    // Alternar a B
    const btnB = screen.getByRole('button', { name: 'Ver B' });
    await user.click(btnB);

    expect(btnB).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ver A' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();
    expect(screen.getByText('fixture-obs-b')).toBeInTheDocument();

    // Alternar a A
    const btnA = screen.getByRole('button', { name: 'Ver A' });
    await user.click(btnA);

    expect(btnA).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();
  });

  it('avanza y retrocede fotogramas con los botones Anterior y Siguiente', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComparisonViewer data={readyFixture} />);

    const nextBtn = screen.getByRole('button', { name: 'Fotograma siguiente' });
    const prevBtn = screen.getByRole('button', { name: 'Fotograma anterior' });

    // Siguiente -> B
    await user.click(nextBtn);
    expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();

    // Siguiente cicla -> A
    await user.click(nextBtn);
    expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();

    // Previo cicla -> B
    await user.click(prevBtn);
    expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();
  });

  it('inicia y pausa la reproducción automática mediante el botón Reproducir / Pausar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComparisonViewer data={readyFixture} />);

    const playBtn = screen.getByRole('button', { name: 'Reproducir' });
    expect(playBtn).toBeInTheDocument();

    // Iniciar reproducción
    await user.click(playBtn);
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();

    // Avanza a B después de 1500ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();

    // Avanza de nuevo a A después de otros 1500ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();

    // Pausar
    const pauseBtn = screen.getByRole('button', { name: 'Pausar' });
    await user.click(pauseBtn);
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();

    // Al avanzar el tiempo no cambia
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();
  });

  it('permite navegación accesible por teclado (flechas y espacio)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComparisonViewer data={readyFixture} />);

    const viewer = screen.getByRole('region', { name: 'Comparación' });
    viewer.focus();

    // Flecha derecha avanza
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText(/Fotograma 2 de 2/)).toBeInTheDocument();

    // Flecha izquierda retrocede
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText(/Fotograma 1 de 2/)).toBeInTheDocument();

    // Espacio inicia Play
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();

    // Espacio pausa
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();
  });

  it('si hay un solo fotograma (insuficiente), se muestra sin controles de reproducción', () => {
    render(<ComparisonViewer data={insufficientFixture} />);

    expect(screen.getByRole('region', { name: 'Comparación' })).toBeInTheDocument();
    expect(screen.getByText(/Fotograma 1 de 1/)).toBeInTheDocument();

    // No debe haber controles de reproducción
    expect(screen.queryByRole('button', { name: 'Reproducir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fotograma anterior' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fotograma siguiente' })).not.toBeInTheDocument();
  });
});
