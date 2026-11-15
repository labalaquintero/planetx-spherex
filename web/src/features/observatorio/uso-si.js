import { pageHeading } from './ui.js';

export function siUsageView() {
  return `${pageHeading('Uso de SI', 'Cómo usamos herramientas de inteligencia artificial para crear Balax.', '', true)}
    <article class="panel reading">
      <section aria-labelledby="si-desarrollo">
        <h2 id="si-desarrollo">Diseño, código y documentación</h2>
        <p>OpenAI Codex ayudó a definir el alcance, consultar documentación de SPHEREx e IRSA, diseñar el visor, el Blog y las fichas, y escribir y probar código del comparador y del espacio de observación. También asistió en la documentación y en los artículos de ejemplo.</p>
        <p>La maqueta inicial del visor se creó en Google Stitch y sirvió como referencia de diseño.</p>
        <p>Claude Opus 5.5 asistió en el desarrollo del Mapa 3D, incluidos el vuelo, el escaneo y los efectos sonoros.</p>
      </section>
      <section aria-labelledby="si-datos">
        <h2 id="si-datos">Observaciones e imágenes</h2>
        <p>Los FITS del comparador son observaciones reales de SPHEREx que distribuye NASA/IPAC IRSA. Con código desarrollado con asistencia de Codex, alineamos y filtramos esas observaciones para obtener los PNG de cada época y las imágenes de diferencias B − A. Las fichas conservan las fechas y los enlaces a los FITS de origen.</p>
        <p>El Mapa presenta escenas ilustrativas con texturas acreditadas en su panel de Créditos. Los ejemplos sintéticos de prueba están identificados como tales.</p>
      </section>
      <section aria-labelledby="si-sonido">
        <h2 id="si-sonido">Sonido del Mapa</h2>
        <p>Los efectos de vuelo, escaneo y travesía se sintetizan en el navegador con Web Audio. Claude Opus 5.5 asistió en la creación del código de síntesis.</p>
      </section>
      <div class="row">
        <a class="button secondary" href="/si-usage.json">Metadatos de uso de SI (JSON)</a>
        <a class="text-link" href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">Archivo SPHEREx en IRSA <span aria-hidden="true">↗</span></a>
      </div>
    </article>`;
}
