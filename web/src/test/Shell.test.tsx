import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Shell } from '../app/Shell.tsx';

describe('Menú de secciones (Shell)', () => {
  it('arranca en el visor, con el menú visible', () => {
    render(<Shell />);
    expect(screen.getByRole('heading', { name: 'Visor Temporal de Regiones Celestes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menú de secciones' })).toBeInTheDocument();
  });

  it('el menú lista Inicio y Explorar, con Inicio como actual', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(screen.getByRole('button', { name: 'Menú de secciones' }));
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    expect(within(nav).getByRole('button', { name: /Inicio/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: /Explorar/ })).not.toHaveAttribute('aria-current');
  });

  it('Explorar abre la selección de sector y el menú sigue ahí para volver al inicio', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(screen.getByRole('button', { name: 'Menú de secciones' }));
    await user.click(screen.getByRole('button', { name: /Explorar/ }));
    expect(await screen.findByRole('heading', { name: 'Elige un sector' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Visor Temporal de Regiones Celestes' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Menú de secciones' }));
    await user.click(screen.getByRole('button', { name: /Inicio/ }));
    expect(screen.getByRole('heading', { name: 'Visor Temporal de Regiones Celestes' })).toBeInTheDocument();
  });

  it('Esc cierra el menú', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(screen.getByRole('button', { name: 'Menú de secciones' }));
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
  });
});
