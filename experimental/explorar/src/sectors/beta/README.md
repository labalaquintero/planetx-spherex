# Sector β

Escena completa y navegable: es el sector de referencia de Explorar. Es una **representación ilustrativa**;
no son datos reales de SPHEREx.

## Composición

La posición y el tamaño aparente de cada objeto salen del boceto de navegación, medido en
`docs/referencias/layout.json` (`boceto.ts` y `objects.ts`). Desde la entrada, la vista reproduce el boceto
(lo comprueba `composicion.test.ts`).

| Objeto | Qué es | Aspecto |
| --- | --- | --- |
| **Ilmara** | Mundo oscuro y frío inspirado en **WISE 0855**, la enana marrón fría que es la referencia real del sector | Procedural, sin textura: violetas y magentas apagados sobre marrón profundo, zonas muy suaves, tres vórtices sutiles, brillo propio tenue (más visible en el lado nocturno) y atmósfera fina con efecto Fresnel. **No** es un gigante de bandas tipo Júpiter |
| **Veshta** | Planeta rocoso | Color y relieve lunares de NASA SVS (dominio público) coloreados con su paleta azul grisácea |
| **Orun** | Planeta con anillo | Texturas de Saturno y de su anillo (Solar System Scope, CC BY 4.0) teñidas hacia su paleta; sombra mutua entre planeta y anillo |
| **Estación Ancla** | Cilindro con asa (anillo de atraque) en un extremo | Casco con paneles y ventanas, luces de posición |
| **Esfera menor** y cuerpos pequeños | Del boceto, más un relleno sembrado | Textura lunar con relieve; el relleno no aparece en la vista inicial |

`waypoints.ts` define el grafo de puntos de ruta. La entrada es el punto de salida; los demás sirven
como zonas despejadas y como puntos de salida alternativos con `?punto=<id>`.

## Nave

Procedural, dentro de la envolvente medida del boceto (`engine/shipSpec.ts`):

- fuselaje torneado de metal con barniz y paneles (albedo, rugosidad y relieve generados en `scene/hullTextures.ts`);
- cabina de vidrio oscuro que refleja el cielo;
- alas delta con diedro y aletas en las puntas;
- dos góndolas de motor con toberas que brillan según el empuje y una estela de partículas cada una;
- luces de navegación (roja a babor, verde a estribor, estroboscópica blanca en la cola).

## Render

- **Iluminación:** luz clave de la estrella, relleno frío del cielo y una contraluz delante de la nave
  que dibuja su silueta. Reflejos del propio cielo (mapa de entorno generado).
- **Postproceso:** tono AgX, MSAA, bloom suave y un pase de lente con aberración cromática ligera, grano
  fino y viñeta (según calidad).
- **Cielo:** cielo lejano con la estrella clave, estrellas cercanas fijas en el sector (paralaje al volar) y
  capas de nebulosa a distancia finita; polvo cercano que se estira con la velocidad.
- **Cámara:** persecución con inercia, ligera inclinación con el alabeo, anticipación al girar y oscilación
  muy leve. Con movimiento reducido, nada de eso.

## Créditos

- Texturas de Saturno y su anillo: Solar System Scope (INOVE), CC BY 4.0.
- Color y relieve lunares: NASA's Scientific Visualization Studio, CGI Moon Kit, dominio público.
- Nave, Ilmara, estación, cielo, nebulosas y efectos: código propio del proyecto.

Detalle completo en `ATTRIBUTIONS.md` y en el panel «Créditos».
