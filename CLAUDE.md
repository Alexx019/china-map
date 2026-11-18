# Cuaderno del Sur: mapa del viaje a China

Web privada para 4 amigos durante un viaje del 22 nov al 3 dic de 2026: Shenzhen,
Guangzhou, Hong Kong y Yangshuo. Sustituye a un mapa dibujado a mano (`cuaderno-sur.html`)
por un **mapa real** con los mismos sitios, fichas y fotos.

Se aloja en una **Raspberry Pi en España** (casa de Alex) y se usa **desde China en el móvil**.

## Lo que ya existe en esta carpeta

- `places.json`: 4 regiones, 14 zonas (con su plan del día) y 52 sitios. Cada sitio lleva
  nombre, nombre en chino, categoría, por qué ir, cuándo, qué grabar, consejo, fotos y
  un enlace de búsqueda en Amap. **`lat` y `lng` están a `null`**: hay que geocodificarlos.
- `photos/`: 141 fotos de referencia (900 px, JPEG), de 1 a 4 por sitio. Son de Baidu
  Imágenes y **solo para uso privado**: no se publican ni se suben a un repo público.

## Objetivo de la v1 (el viaje empieza el 22 de noviembre)

1. Mapa real con todos los sitios como marcadores por categoría; zoom a región y zona.
2. Ficha por sitio: galería de fotos deslizable (de una en una), visor a pantalla completa,
   textos, botón "copiar nombre en chino" y botón "Ir con Amap" (ver abajo).
3. Mood board por zona: cuadrícula tipo Instagram con todas las fotos de la zona.
4. Estado por sitio: Vamos / Quizá / Mejor no / **Visitado**, compartido entre los 4.
5. Ruta del día: elegir y ordenar sitios, dibujarlos unidos en el mapa y abrir la ruta en Amap.
6. Añadir sitios nuevos (desde enlaces de TikTok, Xiaohongshu, webs de comida y de eventos de
   luces). En la v1, se añaden pidiéndoselo a Claude Code, que edita `places.json`.

Fuera de la v1: cuentas de usuario, extracción automática de enlaces con IA, cálculo de rutas a pie.

## Navegación con Amap (obligatorio)

Cada ficha tiene un botón grande **«Ir con Amap»** que abre la app de Amap (高德地图) con la
ruta ya puesta hasta ese sitio. Es como vamos a movernos allí: el mapa de la web es para ver
y planificar, Amap para llegar.

- Con coordenadas: `https://uri.amap.com/navigation?to=<lng>,<lat>,<nombre_zh>&mode=walk&coordinate=wgs84&callnative=1&src=cuaderno-sur`
  - `callnative=1` abre la app si está instalada; si no, la web de Amap.
  - Nuestras coordenadas son WGS-84 (las de OSM), por eso `coordinate=wgs84`. Si en las
    pruebas el destino sale desplazado unos cientos de metros, convertir a GCJ-02 y usar
    `coordinate=gaode`.
  - Selector de modo junto al botón: a pie (`walk`), transporte público (`bus`), coche/taxi (`car`).
- Sin coordenadas todavía: usar la búsqueda por nombre en chino, que ya está en `amap_search`
  dentro de `places.json`.
- La ruta del día también se abre en Amap: el primer sitio como destino y los siguientes
  como paradas (`via`), o sitio a sitio si Amap no admite tantas paradas.
- **Probarlo en un móvil real** con Amap instalado antes del viaje, con un sitio de Shenzhen
  y otro de Hong Kong.

## Restricciones importantes

- **Funcionar en China.** Nada de Google (Fonts, Maps, Analytics) ni CDNs externos: todo
  servido desde la Raspberry. Fuentes auto-hospedadas.
- **Funcionar sin conexión (PWA).** Service worker que guarde la app, los datos, las fotos y
  las teselas del mapa de las zonas del viaje. La conexión desde China a un servidor en España
  puede ser lenta o fallar; la web tiene que seguir abriendo.
- **Mapa:** MapLibre GL JS con teselas vectoriales de OpenStreetMap **alojadas en la
  Raspberry** (un extracto PMTiles de Protomaps para Guangdong, Hong Kong y Guilin).
  Coordenadas en **WGS-84**. Ojo: Amap usa GCJ-02, así que no mezclar coordenadas de Amap
  con el mapa de OSM sin convertirlas.
- **Privada.** Protegida con contraseña (por ejemplo, autenticación básica en Caddy o nginx).
  No se indexa en buscadores.
- **Rápida y fluida en el móvil.** Animaciones cuidadas, sin parpadeos, galerías con scroll-snap.

## Stack sugerido

- Vite + React + TypeScript.
- MapLibre GL JS + PMTiles.
- Estado compartido: un backend mínimo en la Raspberry (por ejemplo, SQLite con una API
  pequeña en Node o Python), con caché local en el navegador para cuando no hay conexión.
- Despliegue: build estático + API detrás de Caddy (HTTPS automático) en Docker en la Pi.

## Estética

Partir del aire de cuaderno del mapa antiguo: papel crema, tinta cacao-ciruela, rosa como
acento, serif de alto contraste para títulos (Bodoni Moda, auto-hospedada) y sans del
sistema para el cuerpo. Estilo del mapa ajustado a esa paleta, no el estilo por defecto de OSM.

## Primeras tareas

1. Crear el proyecto con Vite y mostrar los 52 sitios en el mapa.
2. Geocodificar `places.json`: buscar cada sitio por su nombre en chino con Nominatim
   (respetando su límite de 1 petición por segundo) y **revisar a mano** los que no salgan o
   salgan lejos. Mejor dejar `null` que inventar una coordenada.
3. Fichas, galería, visor y mood board.
4. Estados compartidos y ruta del día.
5. PWA sin conexión y despliegue en la Raspberry.
