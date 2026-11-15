import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CoordinateForm } from '../features/viewer/components/CoordinateForm.tsx';

describe('CoordinateForm', () => {
  it('valida campos vacíos e impide el envío', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    const submitBtn = screen.getByTestId('submit-btn');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByTestId('ra-input')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('dec-input')).toHaveAttribute('aria-invalid', 'true');
  });

  it('valida que RA esté en el rango [0, 360)', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    const raInput = screen.getByTestId('ra-input');
    const decInput = screen.getByTestId('dec-input');
    const submitBtn = screen.getByTestId('submit-btn');

    // RA fuera de rango (> 360)
    await user.type(raInput, '365');
    await user.type(decInput, '0');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/RA debe estar entre 0 y 359/)).toBeInTheDocument();

    // RA negativo
    await user.clear(raInput);
    await user.type(raInput, '-5');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/RA debe estar entre 0 y 359/)).toBeInTheDocument();
  });

  it('valida que Dec esté en el rango [-90, 90]', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    const raInput = screen.getByTestId('ra-input');
    const decInput = screen.getByTestId('dec-input');
    const submitBtn = screen.getByTestId('submit-btn');

    await user.type(raInput, '180');
    await user.type(decInput, '95');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Dec debe estar entre −90° y \+90°/)).toBeInTheDocument();

    await user.clear(decInput);
    await user.type(decInput, '-95');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Dec debe estar entre −90° y \+90°/)).toBeInTheDocument();
  });

  it('acepta coma decimal y envía coordenadas numéricas correctas', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    const raInput = screen.getByTestId('ra-input');
    const decInput = screen.getByTestId('dec-input');
    const submitBtn = screen.getByTestId('submit-btn');

    await user.type(raInput, '10,25');
    await user.type(decInput, '-12,5');
    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith(10.25, -12.5);
  });

  it('aplica presets de coordenadas correctamente y limpia errores', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    // Provocar error primero
    await user.click(screen.getByTestId('submit-btn'));
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);

    // Clic en preset
    await user.click(screen.getByTestId('preset-ready'));

    expect(screen.getByTestId('ra-input')).toHaveValue('10.25');
    expect(screen.getByTestId('dec-input')).toHaveValue('-12.5');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Enviar tras preset
    await user.click(screen.getByTestId('submit-btn'));
    expect(handleSubmit).toHaveBeenCalledWith(10.25, -12.5);
  });

  it('deshabilita el botón de envío mientras carga', () => {
    render(<CoordinateForm onSubmit={vi.fn()} isLoading={true} />);
    const submitBtn = screen.getByTestId('submit-btn');
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('Buscando…');
  });
});
