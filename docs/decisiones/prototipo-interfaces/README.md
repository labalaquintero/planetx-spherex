# Planet X · Prototipo de interfaces

Descarga o clona la rama y abre `index.html` en un navegador. Los estilos, las fuentes y las imágenes se cargan desde la misma carpeta. La comparación preparada y los recorridos de prueba funcionan con los archivos locales.

## Recorridos

| Vista | Qué se puede probar |
| --- | --- |
| Inicio | Deslizar el divisor sobre el par de WISE 0855 o abrir el visor, la galería y las fichas. |
| Visor | Introducir RA y Dec, comparar lado a lado, alternar, deslizar o reproducir. Seleccionar una fecha actualiza su procedencia. |
| Galería y ficha de objetivo | Buscar y filtrar los cinco campos del reto por tarjetas o ubicarlos en el mapa ICRS. WISE 0855 tiene dos observaciones preparadas. Los otros cuatro conservan sus coordenadas de referencia. |
| Imagen ampliada | Elegir una fecha, ampliar el recorte, dibujar y delimitar una región en la capa de anotaciones. |
| Ficha de observación | Escribir o seleccionar un PDF, guardar un borrador, exportar evidencia en JSON o Markdown y enviar a la bandeja de prueba. |
| Blog | Leer las guías y abrir reportes publicados en el prototipo. |
| Acceso y perfil | Usar un perfil de prueba, editar alias y foto, previsualizar el perfil público y consultar el historial. |
| Administración | Revisar, aceptar o rechazar con un mensaje, publicar en la vista local y cambiar el estado del usuario de prueba. |
| Estados del visor | Recorrer la carga, el par preparado, los resultados sin cobertura, la cobertura insuficiente y los fallos simulados. El enlace está al pie de página. |

La consulta a coordenadas distintas del respaldo indica que requiere la API. Los reportes, perfiles, marcas y acciones de revisión se guardan localmente en el navegador. El formulario de PDF comprueba extensión, encabezado y tamaño, y conserva el nombre del archivo. Las cuentas utilizan credenciales de ejemplo.

## Controles del visor

- **Editar coordenadas** abre el formulario mientras ves un resultado. Al elegir A o B en la línea de tiempo puedes consultar la fecha, el ID y la fuente de esa época.
- **Deslizar** revela ambas épocas en la misma cuadrícula. El divisor funciona con ratón, tacto y teclado. **Reproducir** alterna el par con un clic.
- **Pantalla completa** amplía el comparador en navegadores compatibles. **Ctrl+K** o **⌘+K** abren el buscador.
- La interfaz respeta la preferencia de movimiento reducido. La reproducción de las observaciones empieza al pulsar el control.

## Estándar visual

- **Tipografía.** Instrument Serif en títulos, Inter en texto e interacción e IBM Plex Mono en coordenadas, fechas e identificadores.
- **Color.** Fondo `#080B17`, panel `#111829`, texto `#F9F6F2` y dorado `#F4CEA3` para acciones principales y selección. Cada estado se identifica mediante texto, además de su color.
- **Componentes.** Encabezado común, títulos de página, paneles con bordes discretos, botones principales y secundarios, controles con foco visible y mensajes junto a la acción correspondiente.
- **Imágenes científicas.** Los dos recortes mantienen escala, orientación y contraste. La cuadrícula indica píxeles enmascarados. El visor conserva la fecha UTC y enlaza al FITS de cada exposición.

`styles.css` reúne las variables y los componentes. `datos.js` contiene las observaciones y las referencias. Las capturas de [inicio](capturas/01-inicio.png), [visor](capturas/02-visor.png), [mapa](capturas/14-mapa.png), [modo deslizar](capturas/15-deslizar.png) y [visor móvil](capturas/movil-02-visor.png) están en [capturas](capturas/).

## Créditos

- Las vistas WebP de WISE 0855 se generaron sin pérdida a partir del respaldo F01 del equipo. Los productos originales son de SPHEREx DR1 y sus enlaces individuales se muestran en el visor. [NASA/IPAC Infrared Science Archive](https://irsa.ipac.caltech.edu/Missions/spherex.html) · [SPHEREx DR1 Spectral Images](https://doi.org/10.26131/IRSA678).
- El mosaico infrarrojo de la portada y la imagen de la región molecular de Vela son de NASA/JPL-Caltech. [Mapa infrarrojo del cielo de SPHEREx](https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/) · [SPHEREx Vela Molecular Ridge](https://www.jpl.nasa.gov/images/pia26354-spherex-vela-molecular-ridge/).
- Inter, Instrument Serif e IBM Plex Mono se distribuyen con sus licencias SIL Open Font License en `assets/`.
