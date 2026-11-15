/**
 * Generador de data-URLs SVG sintéticas para desarrollo y pruebas.
 * No genera archivos físicos en web/public ni se empaqueta en dist/.
 */
export function createSyntheticFrameSvg(epoch: string, dotX: number, dotY: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#0b0f19"/>
    <!-- Estrellas de fondo -->
    <circle cx="12" cy="18" r="0.8" fill="#e2e8f0" opacity="0.7"/>
    <circle cx="48" cy="10" r="0.6" fill="#e2e8f0" opacity="0.6"/>
    <circle cx="52" cy="45" r="0.9" fill="#e2e8f0" opacity="0.8"/>
    <circle cx="20" cy="50" r="0.5" fill="#e2e8f0" opacity="0.5"/>
    <circle cx="38" cy="28" r="0.7" fill="#e2e8f0" opacity="0.7"/>
    <!-- Objeto objetivo con movimiento simulado -->
    <circle cx="${dotX}" cy="${dotY}" r="2.2" fill="#facc15"/>
    <circle cx="${dotX}" cy="${dotY}" r="4.5" fill="#facc15" opacity="0.3"/>
    <!-- Etiqueta Datos de prueba -->
    <rect x="0" y="52" width="64" height="12" fill="rgba(0,0,0,0.85)"/>
    <text x="32" y="60.5" fill="#38bdf8" font-size="4" font-family="sans-serif" font-weight="bold" text-anchor="middle">DATOS DE PRUEBA (${epoch})</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const TEST_FRAME_A = createSyntheticFrameSvg('Época A', 28, 30);
export const TEST_FRAME_B = createSyntheticFrameSvg('Época B', 34, 32);
export const TEST_FRAME_SINGLE = createSyntheticFrameSvg('Época Única', 32, 32);
