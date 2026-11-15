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

**Borde exterior (amplía el área del sector):** cuatro planetas fuera de la vista inicial, cuya superficie
usa los mapas globales de la NASA que también trae α, solo por su luminancia y con paletas propias: **Brasa**
(Ío, rojos de brasa con brillo propio), **Jade** (Ganímedes, verdes), **Ceniza** (radar de Venus, grises) y
**Marea** (Marte, turquesas). Cada uno tiene su ficha con la imagen de origen. El relleno de cuerpos pequeños
también se reparte por toda el área.

**En 360° y en altura:** los planetas fuera del boceto se colocan con `around(rumbo, altura, distancia)` desde la
entrada, así que hay planetas delante, detrás, a los lados, arriba y abajo. Además de los anteriores:
**Escarcha** (Europa, lila, arriba), **Hollín** (Fobos, debajo de la entrada), **Argento** (Saturno, con anillo
plateado), **Abisal** (mapa del cielo de SPHEREx, azul), y siete con mapas globales de NASA/JPL
(`tools/texturas_nasa_beta.py`): **Cobalto** (Neptuno), **Nácar** (Encélado), **Jano** (Japeto), **Ónix** (Calisto),
**Grieta** (Tetis), **Vigía** (Mimas) y **Pangea** (relieve de la Tierra). Se descartaron Tritón, Miranda y las
demás lunas de Urano, Mercurio y Titán porque sus mapas tienen grandes huecos o son planos.

Las fichas dan solo el contexto del objeto y la imagen de la que parte; no dicen que sea inventado (lo comprueba
`sectors.test.ts`). El aviso general del HUD sigue siendo «Representación ilustrativa, no son datos reales de
SPHEREx».

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
