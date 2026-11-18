# China Map: guía privada de sitios para el viaje

Mapa real con los sitios que merecen la pena en Shenzhen, Guangzhou, Hong Kong y Yangshuo:
comida, sitios visuales, espectáculos, parques, tiendas, miradores, lo que sea. Cada sitio
tiene su ficha con fotos, toda la información práctica y el enlace para ir con Amap.

**No es una web de planificación.** Nada de «plan del día», itinerarios ni «hoy toca
esto + esto». Los 4 abrimos el mapa, vemos qué hay cerca o qué nos apetece, leemos la ficha
y decidimos nosotros.

Viaje: del 22 de noviembre al 2 de diciembre de 2026. Se aloja en una **Raspberry Pi en
España** (casa de Alex) y se usa **desde China en el móvil**.

## Material de partida (`public/data/`)

- `public/data/places.json`: 52 sitios agrupados en 4 regiones y 14 zonas. Cada sitio lleva nombre,
  nombre en chino, categoría, por qué ir, mejor momento, consejo de grabación, fotos y un
  enlace de búsqueda en Amap. **`lat` y `lng` están a `null`**: hay que geocodificarlos.
  Las zonas traen un campo `plan` de la versión anterior: **no se usa**.
- `public/data/photos/`: 141 fotos de referencia (900 px, JPEG), de 1 a 4 por sitio. Son de Baidu
  Imágenes y **solo para uso privado**: el repo es privado y no se publican.

## Qué tiene que hacer

1. **Mapa real** con todos los sitios como marcadores por categoría. Filtros por categoría
   y por región. Agrupar marcadores cercanos al alejar.
2. **Ficha de cada sitio**, con aire de artículo de guía:
   - galería de fotos deslizable (de una en una) y visor a pantalla completa;
   - por qué merece la pena;
   - **información práctica** (ver abajo);
   - **consejos de gente local** (ver abajo);
   - botón «copiar nombre en chino» y botón grande **«Ir con Amap»**.
3. **Mood board** por zona o región: cuadrícula tipo Instagram con todas las fotos.
4. **Estado de cada sitio**, compartido entre los 4: Queremos ir / Quizá / Visitado.
   Y poder filtrar el mapa por estado.
5. **Rutas que creamos nosotros.** Cualquiera de los 4 elige sitios del mapa, los ordena
   (arrastrando) y guarda la ruta con un nombre. La ruta se dibuja en el mapa, se comparte
   entre los 4 y se puede abrir en Amap tramo a tramo. **La web nunca propone ni genera
   rutas ni planes por su cuenta**: solo es la herramienta para hacerlas.
6. **Añadir sitios nuevos** a partir de enlaces (TikTok, Xiaohongshu, webs de restaurantes y
   de eventos de luces). Por ahora se añaden pidiéndoselo a Claude Code, que investiga el
   sitio y lo mete en los datos con su ficha completa.

## Información práctica (obligatoria)

Según el tipo de sitio:
- **Restaurantes y cafés:** precio medio por persona, horario, si hace falta reservar, platos
  recomendados, si hay carta en inglés o con fotos.
- **Museos, atracciones, miradores, noria, parques:** precio de cada tipo de entrada,
  horario, días de cierre, si hay que reservar (dónde y con cuánta antelación), duración
  típica de la visita, mejor hora.
- **Espectáculos y eventos de luces:** días y horas de los pases, si hace falta reserva,
  mejor sitio para verlo.
- **Para todos:** cómo llegar (metro y salida), formas de pago (Alipay, WeChat, efectivo,
  tarjeta extranjera), si piden pasaporte, normas (grabar, mochilas, etc.) y lo que hay que
  saber antes de ir (por ejemplo, si para entrar a un sitio hay que consumir o comprar algo).

Reglas:
- Guardarlo en cada sitio en un bloque `practical`, con `sources` (URLs) y `verified_at` (fecha).
- Investigar con búsqueda web, priorizando fuentes oficiales y guías chinas recientes
  (2025-2026).
- **No inventar nada.** Si un dato no se encuentra o las fuentes se contradicen, dejarlo en
  `null` o «por confirmar». Un dato falso nos puede hacer perder una mañana allí.
- En la ficha, mostrar la fecha de verificación y los enlaces a las fuentes.

## Consejos de gente local

Para cada sitio, 2 a 5 consejos útiles que da la gente que ha ido, sacados de reseñas
recientes de Dianping (大众点评), Xiaohongshu (小红书), Meituan o foros: a qué hora ir para
evitar colas, qué pedir, qué no merece la pena, trucos para la foto, etc.
- Resumirlos con nuestras palabras, en español, sin copiar reseñas literales.
- Guardar la fuente de cada uno. Si no se encuentra nada fiable, dejarlo vacío.

## Navegación con Amap (obligatoria)

El mapa de la web es para ver qué hay; Amap (高德地图) es para llegar. El botón «Ir con Amap»
abre la app de Amap con la ruta ya puesta hasta ese sitio.

- Con coordenadas: `https://uri.amap.com/navigation?to=<lng>,<lat>,<nombre_zh>&mode=walk&coordinate=wgs84&callnative=1&src=china-map`
  - `callnative=1` abre la app si está instalada; si no, la web de Amap.
  - Nuestras coordenadas son WGS-84 (las de OSM), por eso `coordinate=wgs84`. Si en las
    pruebas el destino sale desplazado unos cientos de metros, convertir a GCJ-02 y usar
    `coordinate=gaode`.
  - Selector de modo junto al botón: a pie (`walk`), transporte público (`bus`), coche o taxi (`car`).
- Sin coordenadas todavía: buscar por el nombre en chino (`amap_search` en los datos).
- **Probarlo en un móvil real** con Amap instalado, con un sitio de Shenzhen y otro de Hong Kong.

## Restricciones

- **Funcionar en China.** Nada de Google (Fonts, Maps, Analytics) ni CDNs externos: todo
  servido desde la Raspberry. Fuentes auto-hospedadas.
- **Funcionar sin conexión (PWA).** Guardar la app, los datos, las fotos y las teselas del
  mapa de las zonas del viaje. Desde China, la conexión a un servidor en España puede ser
  lenta o fallar, y la web tiene que seguir abriendo.
- **Mapa:** MapLibre GL JS con teselas vectoriales de OpenStreetMap **alojadas en la
  Raspberry** (extracto PMTiles de Protomaps para Guangdong, Hong Kong y Guilin).
  Coordenadas en **WGS-84**. Amap usa GCJ-02: no mezclar coordenadas sin convertirlas.
- **Privada.** Protegida con contraseña. No se indexa en buscadores.
- **Rápida y fluida en el móvil:** animaciones cuidadas, sin parpadeos, galerías con scroll-snap.

## Estética

**Profesional y editorial**, como una buena guía de viaje digital con mapa. Nada infantil ni
«cuqui», nada de tonos pastel ni colores chillones. Tipografía cuidada, fotos protagonistas,
mucho espacio, jerarquía clara y datos prácticos fáciles de escanear. Modo claro y oscuro.
Mapa sobrio a juego con la interfaz, no el estilo por defecto de OSM.

**Diseño aprobado:** maqueta «Cristal» con tokens y pantallas en [docs/design/](docs/design/README.md).
El orden de trabajo está en [PLAN.md](PLAN.md).

## Despliegue

Build estático y una API pequeña para los estados compartidos (por ejemplo, SQLite), detrás
de un servidor con HTTPS y contraseña, en Docker en la Raspberry. Con caché en el navegador
para cuando no haya conexión.
