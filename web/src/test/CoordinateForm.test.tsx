import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CoordinateForm } from '../features/viewer/components/CoordinateForm.tsx';

describe('CoordinateForm', () => {
  it('valida campos vacíos e impide el envío', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    const submitBtn = screen.getByRole('button', { name: 'Comparar' });
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByTestId('ra-input')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('dec-input')).toHaveAttribute('aria-invalid', 'true');
  });

  it('valida que RA esté en el rango 0 ≤ ra_deg < 360', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    const raInput = screen.getByTestId('ra-input');
    const decInput = screen.getByTestId('dec-input');
    const submitBtn = screen.getByRole('button', { name: 'Comparar' });

    // RA = 360 (inválido)
    await user.type(raInput, '360');
    await user.type(decInput, '0');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/RA debe estar entre 0° y 359/)).toBeInTheDocument();

    // RA < 0 (inválido)
    await user.clear(raInput);
    await user.type(raInput, '-5');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/RA debe estar entre 0° y 359/)).toBeInTheDocument();
  });

  it('valida que Dec esté en el rango -90 ≤ dec_deg ≤ 90', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    const raInput = screen.getByTestId('ra-input');
    const decInput = screen.getByTestId('dec-input');
    const submitBtn = screen.getByRole('button', { name: 'Comparar' });

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

  it('orienta al usuario sobre conversión si ingresa formato de horas sexagesimal', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    const raInput = screen.getByTestId('ra-input');
    const decInput = screen.getByTestId('dec-input');
    const submitBtn = screen.getByRole('button', { name: 'Comparar' });

    await user.type(raInput, '08h55m');
    await user.type(decInput, '10');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Para convertir desde horas: grados = \(h \+ m\/60 \+ s\/3600\) × 15/),
    ).toBeInTheDocument();
  });

  it('acepta coma decimal y envía coordenadas numéricas correctas', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    const raInput = screen.getByTestId('ra-input');
    const decInput = screen.getByTestId('dec-input');
    const submitBtn = screen.getByRole('button', { name: 'Comparar' });

    await user.type(raInput, '10,25');
    await user.type(decInput, '-12,5');
    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith(10.25, -12.5);
  });

  it('botón "Usar ejemplo" rellena y ejecuta la misma búsqueda', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<CoordinateForm onSubmit={handleSubmit} isLoading={false} />);

    // Clic en preset Usar ejemplo
    const ejemploBtn = screen.getByRole('button', { name: 'Usar ejemplo' });
    await user.click(ejemploBtn);

    expect(screen.getByTestId('ra-input')).toHaveValue('10.25');
    expect(screen.getByTestId('dec-input')).toHaveValue('-12.5');
    expect(handleSubmit).toHaveBeenCalledWith(10.25, -12.5);
  });

  it('deshabilita el botón de envío mientras carga manteniendo el texto Comparar', () => {
    render(<CoordinateForm onSubmit={vi.fn()} isLoading={true} />);
    const submitBtn = screen.getByRole('button', { name: 'Comparar' });
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('Comparar');
  });
});
