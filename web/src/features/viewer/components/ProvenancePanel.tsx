import type { ComparisonResponse } from '../types.ts';

interface ProvenancePanelProps {
  data: ComparisonResponse;
  currentIndex: number;
}

function formatUTC(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

const MODE_LABELS: Record<string, string> = {
  fixture: 'Datos de prueba (fixture)',
  prepared: 'Caso preparado',
  live: 'Consulta en vivo',
};

export function ProvenancePanel({ data, currentIndex }: ProvenancePanelProps) {
  const frame = data.frames[currentIndex];
  const { query, band, mode, checked_at, science_version, warnings } = data;

  const hasSearchLimit = warnings.some(
    (w) => w.toLowerCase().includes('search_limit') || w.toLowerCase().includes('recortada'),
  );

  return (
    <details
      className="provenance"
      open
      data-testid="provenance-panel"
    >
      <summary>Procedencia y metadatos</summary>

      <div className="provenance-grid">
        {/* Consulta */}
        <section className="provenance-section">
          <h3>Consulta</h3>
          <dl>
            <dt>Coordenadas (ICRS)</dt>
            <dd>
              RA&nbsp;{query.ra_deg}°, Dec&nbsp;{query.dec_deg}°
            </dd>
            <dt>Campo</dt>
            <dd>{query.fov_deg}° × {query.fov_deg}°</dd>
            {band && (
              <>
                <dt>Banda</dt>
                <dd>
                  {band.center_um} ± {band.tolerance_um}&nbsp;µm
                </dd>
              </>
            )}
            <dt>Modo</dt>
            <dd>{MODE_LABELS[mode] ?? mode}</dd>
            {mode === 'prepared' && (
              <>
                <dt>Caso preparado</dt>
                <dd>
                  <time dateTime={checked_at}>{formatUTC(checked_at)}</time>
                </dd>
              </>
            )}
            <dt>Versión de procesamiento</dt>
            <dd>{science_version}</dd>
            <dt>Comprobado</dt>
            <dd>
              <time dateTime={checked_at}>{formatUTC(checked_at)}</time>
            </dd>
          </dl>
        </section>

        {/* Fotograma actual */}
        {frame && (
          <section className="provenance-section">
            <h3>
              Fotograma actual ({String.fromCharCode(65 + currentIndex)})
            </h3>
            <dl>
              <dt>Observado</dt>
              <dd>
                <time dateTime={frame.observed_at}>
                  {formatUTC(frame.observed_at)}
                </time>
              </dd>
              <dt>Release</dt>
              <dd>{frame.release}</dd>
              <dt>Observación</dt>
              <dd>
                <code>{frame.observation_id}</code>
              </dd>
              <dt>ID de fotograma</dt>
              <dd>
                <code>{frame.id}</code>
              </dd>
              <dt>Fuente</dt>
              <dd>
                {frame.source_url ? (
                  <a
                    href={frame.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fuente (IRSA)
                  </a>
                ) : (
                  <span className="text-muted">No disponible (fixture)</span>
                )}
              </dd>
              {frame.quality_flags.length > 0 && (
                <>
                  <dt>Avisos de calidad</dt>
                  <dd>{frame.quality_flags.join(', ')}</dd>
                </>
              )}
            </dl>
          </section>
        )}
      </div>

      {/* Avisos generales (ej. búsqueda recortada) */}
      {hasSearchLimit && (
        <div className="provenance-warnings" role="note" data-testid="warning-search-limit">
          <strong>Aviso:</strong> búsqueda recortada al alcanzarse el límite configurado de fotogramas.
        </div>
      )}

      {warnings.length > 0 && !hasSearchLimit && (
        <div className="provenance-warnings" role="note">
          <strong>Avisos:</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Aviso de no-hallazgo */}
      <p className="provenance-disclaimer" role="note">
        Un cambio visible no prueba un hallazgo. Diferencias de brillo, posición o
        apariencia pueden deberse a variabilidad intrínseca, movimiento propio, ruido,
        alineación, banda espectral, saturación u otros factores de observación.
      </p>
    </details>
  );
}
