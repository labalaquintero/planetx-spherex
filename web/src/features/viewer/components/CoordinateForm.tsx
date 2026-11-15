import { useState } from 'react';

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

  if (ra.trim() === '') {
    errs.ra = 'Ingrese la coordenada RA en grados decimales.';
  } else if (/^[0-9]+h/i.test(ra.trim())) {
    errs.ra = 'Formato no soportado. Para convertir desde horas: grados = (h + m/60 + s/3600) × 15.';
  } else {
    const raNum = parseCoord(ra);
    if (!Number.isFinite(raNum)) {
      errs.ra = 'RA debe ser un número finito.';
    } else if (raNum < 0 || raNum >= 360) {
      errs.ra = 'RA debe estar entre 0° y 359.999…° (0 ≤ ra_deg < 360).';
    }
  }

  if (dec.trim() === '') {
    errs.dec = 'Ingrese la coordenada Dec en grados decimales.';
  } else if (/^[+-]?[0-9]+[d°]/i.test(dec.trim())) {
    errs.dec = 'Formato no soportado. Para convertir desde sexagesimal: grados = d + m/60 + s/3600.';
  } else {
    const decNum = parseCoord(dec);
    if (!Number.isFinite(decNum)) {
      errs.dec = 'Dec debe ser un número finito.';
    } else if (decNum < -90 || decNum > 90) {
      errs.dec = 'Dec debe estar entre −90° y +90° (−90 ≤ dec_deg ≤ 90).';
    }
  }

  return errs;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CoordinateFormProps {
  onSubmit: (raDeg: number, decDeg: number) => void;
  isLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export function CoordinateForm({ onSubmit, isLoading }: CoordinateFormProps) {
  const [ra, setRa] = useState('');
  const [dec, setDec] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(ra, dec);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSubmit(parseCoord(ra), parseCoord(dec));
    }
  }

  function applyPresetAndSubmit(raVal: string, decVal: string) {
    setRa(raVal);
    setDec(decVal);
    setErrors({});
    onSubmit(parseCoord(raVal), parseCoord(decVal));
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Búsqueda de coordenadas celestes"
      className="coord-form"
    >
      <div className="coord-help" id="coord-help">
        Coordenadas en grados decimales ICRS. Para convertir desde horas: <code>grados = (h + m/60) × 15</code>.
      </div>

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
          aria-describedby={errors.ra ? 'ra-error' : 'coord-help'}
          placeholder="Ej: 10.25"
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
          aria-describedby={errors.dec ? 'dec-error' : 'coord-help'}
          placeholder="Ej: −12.5"
          data-testid="dec-input"
        />
        {errors.dec && (
          <span id="dec-error" className="field-error" role="alert">
            {errors.dec}
          </span>
        )}
      </div>

      {/* Submit con texto accesible exacto "Comparar" */}
      <div className="form-actions">
        <button
          type="submit"
          disabled={isLoading}
          aria-label="Comparar"
          data-testid="submit-btn"
        >
          Comparar
        </button>
      </div>

      {/* Presets alineados con QA / Quintero */}
      <div className="presets" role="group" aria-label="Ejemplos de coordenadas">
        <span className="presets-label">Acceso rápido:</span>
        <button
          type="button"
          onClick={() => applyPresetAndSubmit('133.795129166667', '-7.245147222222')}
          data-testid="preset-wise-0855"
        >
          WISE 0855
        </button>
        <button
          type="button"
          onClick={() => applyPresetAndSubmit('10.25', '-12.5')}
          data-testid="preset-ready"
        >
          Usar ejemplo
        </button>
        <button
          type="button"
          onClick={() => applyPresetAndSubmit('50', '70')}
          data-testid="preset-insufficient"
        >
          Caso preparado: Insuficiente
        </button>
        <button
          type="button"
          onClick={() => applyPresetAndSubmit('200', '89')}
          data-testid="preset-no-coverage"
        >
          Caso preparado: Sin cobertura
        </button>
        <button
          type="button"
          onClick={() => applyPresetAndSubmit('0.5', '0.5')}
          data-testid="preset-error"
        >
          Caso preparado: Fallo temporal
        </button>
      </div>
    </form>
  );
}
