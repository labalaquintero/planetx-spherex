# Planet X · Prototipo de interfaces

Descarga o clona la rama y abre `index.html` en un navegador. Conserva toda la carpeta para conservar los estilos, las fuentes y las imágenes. La comparación preparada y los recorridos de prueba funcionan con los archivos locales.

## Recorridos

| Vista | Qué se puede probar |
| --- | --- |
| Inicio | Comparar WISE 0855, abrir la galería o retomar una comparación. |
| Visor | Introducir RA y Dec, abrir el par preparado, comparar lado a lado o en alternancia, reproducir y elegir una época. |
| Galería y ficha de objetivo | Buscar y filtrar los cinco campos del reto. WISE 0855 tiene dos observaciones preparadas. Los otros cuatro conservan sus coordenadas de referencia. |
| Imagen ampliada | Elegir una fecha, ampliar el recorte, dibujar y delimitar una región en la capa de anotaciones. |
| Ficha de observación | Escribir o seleccionar un PDF, guardar un borrador, exportar evidencia en JSON o Markdown y enviar a la bandeja de prueba. |
| Blog | Leer las guías y abrir reportes publicados en el prototipo. |
| Acceso y perfil | Usar un perfil de prueba, editar alias y foto, previsualizar el perfil público y consultar el historial. |
| Administración | Revisar, aceptar o rechazar con un mensaje, publicar en la vista local y cambiar el estado del usuario de prueba. |
| Estados del visor | Recorrer la carga, el par preparado, los resultados sin cobertura, la cobertura insuficiente y los fallos simulados. El enlace está al pie de página. |

La consulta a coordenadas distintas del respaldo indica que requiere la API. Los reportes, perfiles, marcas y acciones de revisión se guardan localmente en el navegador. El formulario de PDF comprueba extensión, encabezado y tamaño, y conserva el nombre del archivo. Las cuentas utilizan credenciales de ejemplo.

## Estándar visual

- **Tipografía.** Instrument Serif en títulos, Inter en texto e interacción e IBM Plex Mono en coordenadas, fechas e identificadores.
- **Color.** Fondo grafito `#111216`, panel `#191B21`, texto `#F4F0EA` y ocre `#EFCB94` para acciones principales y selección. Cada estado se identifica mediante texto, además de su color.
- **Componentes.** Encabezado común, títulos de página, paneles con bordes discretos, botones principales y secundarios, controles con foco visible y mensajes junto a la acción correspondiente.
- **Imágenes científicas.** Los dos recortes mantienen escala, orientación y contraste. La cuadrícula indica píxeles enmascarados. El visor conserva la fecha UTC y enlaza al FITS de cada exposición.

`styles.css` reúne las variables y los componentes. `datos.js` contiene las observaciones y las referencias. Consulta las capturas de [inicio](capturas/01-inicio.png), [visor](capturas/02-visor.png), [galería](capturas/03-galeria.png) y [visor móvil](capturas/movil-02-visor.png). La [carpeta de capturas](capturas/) reúne las 16 muestras.

## Créditos

- Las vistas WebP de WISE 0855 se generaron sin pérdida a partir del respaldo F01 del equipo. Los productos originales son de SPHEREx DR1 y sus enlaces individuales se muestran en el visor. [NASA/IPAC Infrared Science Archive](https://irsa.ipac.caltech.edu/Missions/spherex.html) · [SPHEREx DR1 Spectral Images](https://doi.org/10.26131/IRSA678).
- La imagen de contexto de la región molecular de Vela es de NASA/JPL-Caltech. [SPHEREx Vela Molecular Ridge](https://www.jpl.nasa.gov/images/pia26354-spherex-vela-molecular-ridge/).
- Inter, Instrument Serif e IBM Plex Mono se distribuyen con sus licencias SIL Open Font License en `assets/`.
