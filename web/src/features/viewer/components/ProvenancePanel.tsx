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
      hourCycle: 'h23',
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

const bandFormat = new Intl.NumberFormat('es-MX', { maximumSignificantDigits: 4 });

export function ProvenancePanel({ data, currentIndex }: ProvenancePanelProps) {
  const frame = data.frames[currentIndex];
  const { query, band, mode, checked_at, science_version, warnings } = data;

  return (
    <details
      className="provenance"
      open
      data-testid="provenance-panel"
    >
      <summary>Procedencia</summary>
      <p className="provenance-mode">
        <span className="release-badge">{MODE_LABELS[mode] ?? mode}</span>
      </p>

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
                <dd title={`${band.center_um} ± ${band.tolerance_um} µm`}>
                  {bandFormat.format(band.center_um)} ± {bandFormat.format(band.tolerance_um)}&nbsp;µm
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
              <dt>Publicación</dt>
              <dd>{frame.release}</dd>
              <dt>ID de observación</dt>
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
                    Enlace al archivo
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

      {/* Avisos generales */}
      {warnings.length > 0 && (
        <div className="provenance-warnings">
          <strong>Avisos:</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="provenance-disclaimer">
        Un cambio visible entre épocas no constituye por sí solo evidencia de un
        hallazgo. Diferencias de brillo, posición o apariencia pueden deberse a
        ruido, alineación, banda, saturación u otros factores de observación.
      </p>
    </details>
  );
}
