import { useState } from 'react';
import { WISE_0855 } from '../preparedTarget.ts';

/* ------------------------------------------------------------------ */
/*  Validación                                                         */
/* ------------------------------------------------------------------ */

interface FieldErrors {
  ra?: string;
  dec?: string;
}

/** Acepta punto y coma como separador decimal (es-MX). */
function parseCoord(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function validate(ra: string, dec: string): FieldErrors {
  const errs: FieldErrors = {};
  const raNum = parseCoord(ra);
  const decNum = parseCoord(dec);

  if (ra.trim() === '' || !Number.isFinite(raNum)) {
    errs.ra = 'Ingrese un valor numérico finito.';
  } else if (raNum < 0 || raNum >= 360) {
    errs.ra = 'RA debe estar entre 0 y 359.999…°';
  }

  if (dec.trim() === '' || !Number.isFinite(decNum)) {
    errs.dec = 'Ingrese un valor numérico finito.';
  } else if (decNum < -90 || decNum > 90) {
    errs.dec = 'Dec debe estar entre −90° y +90°';
  }

  return errs;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CoordinateFormProps {
  onSubmit: (raDeg: number, decDeg: number) => void;
  isLoading: boolean;
  initialCoordinates?: { ra: string; dec: string };
  showPreparedShortcut?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export function CoordinateForm({
  onSubmit, isLoading, initialCoordinates, showPreparedShortcut,
}: CoordinateFormProps) {
  const [ra, setRa] = useState(initialCoordinates?.ra ?? '');
  const [dec, setDec] = useState(initialCoordinates?.dec ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(ra, dec);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSubmit(parseCoord(ra), parseCoord(dec));
    }
  }

  function applyPreset(raVal: string, decVal: string) {
    setRa(raVal);
    setDec(decVal);
    setErrors({});
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Búsqueda de coordenadas celestes"
      className="coord-form"
    >
      {/* RA */}
      <div className="form-field">
        <label htmlFor="ra-input">RA (grados ICRS)</label>
        <input
          id="ra-input"
          type="text"
          inputMode="decimal"
          value={ra}
          onChange={(e) => {
            setRa(e.target.value);
            setErrors((prev) => ({ ...prev, ra: undefined }));
          }}
          aria-invalid={errors.ra ? true : undefined}
          aria-describedby={errors.ra ? 'ra-error' : undefined}
          placeholder="Ej. 133.795129"
          data-testid="ra-input"
        />
        {errors.ra && (
          <span id="ra-error" className="field-error" role="alert">
            {errors.ra}
          </span>
        )}
      </div>

      {/* Dec */}
      <div className="form-field">
        <label htmlFor="dec-input">Dec (grados ICRS)</label>
        <input
          id="dec-input"
          type="text"
          inputMode="decimal"
          value={dec}
          onChange={(e) => {
            setDec(e.target.value);
            setErrors((prev) => ({ ...prev, dec: undefined }));
          }}
          aria-invalid={errors.dec ? true : undefined}
          aria-describedby={errors.dec ? 'dec-error' : undefined}
          placeholder="Ej. -7.245147"
          data-testid="dec-input"
        />
        {errors.dec && (
          <span id="dec-error" className="field-error" role="alert">
            {errors.dec}
          </span>
        )}
      </div>

      {/* Submit */}
      <div className="form-actions">
        <button type="submit" className="action-primary" disabled={isLoading} data-testid="submit-btn">
          {isLoading ? 'Buscando…' : 'Comparar'}
        </button>
        {showPreparedShortcut && (
          <button
            type="button"
            className="action-secondary"
            disabled={isLoading}
            onClick={() => {
              applyPreset(WISE_0855.ra, WISE_0855.dec);
              onSubmit(Number(WISE_0855.ra), Number(WISE_0855.dec));
            }}
          >
            WISE 0855
          </button>
        )}
      </div>

      {/* Presets para pruebas con mock */}
      {import.meta.env.DEV && (
      <div className="presets" role="group" aria-label="Ejemplos de coordenadas">
        <span className="presets-label">Probar:</span>
        <button
          type="button"
          onClick={() => applyPreset('10.25', '-12.5')}
          data-testid="preset-ready"
        >
          Ejemplo listo
        </button>
        <button
          type="button"
          onClick={() => applyPreset('50', '70')}
          data-testid="preset-insufficient"
        >
          Insuficiente
        </button>
        <button
          type="button"
          onClick={() => applyPreset('200', '89')}
          data-testid="preset-no-coverage"
        >
          Sin cobertura
        </button>
        <button
          type="button"
          onClick={() => applyPreset('0.5', '0.5')}
          data-testid="preset-error"
        >
          Error temporal
        </button>
      </div>
      )}
    </form>
  );
}
