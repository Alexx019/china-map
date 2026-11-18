# china-map: plan de trabajo

Guía privada de sitios con un mapa real para el viaje del 22 nov al 2 dic de 2026 (Shenzhen, Guangzhou,
Hong Kong y Yangshuo). **La fuente de verdad sobre qué tiene que hacer la web es [CLAUDE.md](CLAUDE.md)**;
este fichero es el orden de trabajo y se va marcando según avanza.

- Diseño aprobado: maqueta «Cristal» de 7 pantallas → [docs/design/](docs/design/README.md).
- Investigación de información práctica y consejos: en paralelo, empezando por Shenzhen, que es donde empieza el viaje.

## Resumen

| Fase | Qué queda funcionando | Depende de |
|---|---|---|
| 0. Cimientos | Proyecto creado, este plan, esquema de datos y tokens de la maqueta | — |
| 1. Mapa real | Los 52 sitios sobre el mapa de OSM con el estilo de la maqueta, filtros, agrupación y búsqueda | Descarga del extracto |
| 2. Ficha | Ficha completa, «Ir con Amap», visor y mood board | Fase 1 |
| 3. Sin conexión y Pi | PWA que abre sin red, publicada en la Raspberry con HTTPS y contraseña | Respuesta de Alex |
| 4. Estados y rutas | Queremos ir / Quizá / Visitado y rutas con nombre, compartidos entre los 4 | Fase 3 |
| 5. Repaso | Probado en los móviles reales | Todo |
| Investigación | Información práctica y consejos locales de los 52 sitios, con fuentes | Esquema de la fase 0 |

Los datos (`public/data/`) van fuera del código: la investigación y los sitios nuevos se publican sin tocar la app.

## Fase 0. Cimientos

- [x] Este `PLAN.md` y la maqueta en `docs/design/`
- [x] Una línea en CLAUDE.md que apunte a la maqueta
- [x] Vite + React + TypeScript; tokens claro y oscuro de la maqueta; Geist autoalojada
- [x] Esquema de datos en `src/data/types.ts` (`geo`, `practical`, `tips`, estados)
- [x] `scripts/check-data.mjs`
- [x] `.gitignore` y primer commit
- [ ] Mensaje para Alex con lo que necesitamos de la Raspberry

## Fase 1. El mapa real

- [x] Geocodificación con Nominatim (`scripts/geocode.mjs`, 1 petición por segundo) y `geocode-review.md`
- [x] Revisión a mano: solo coincidencias claras; las dudosas se consultan y lo que no aparezca queda en `null`
- [x] Extracto PMTiles de Protomaps con detalle en las zonas del viaje (antes, `--dry-run` para ver el tamaño)
- [x] Estilo del mapa (`@protomaps/basemaps`) con los colores de la maqueta, claro y oscuro, sin POI de base
- [x] Marcadores por categoría, agrupación al alejar y miniatura con foto al acercar
- [x] Pantalla Explorar: buscador (español y chino), región, filtros por categoría, hoja inferior y pestañas

## Fase 2. Ficha, Amap, visor y mood board

- [x] Ficha: galería con `scroll-snap`, nombre chino con «Copiar», estados, modo y «Ir con Amap»
- [x] Información práctica (con la fecha de verificación y las fuentes) y consejos locales
- [x] `src/data/amap.ts` con tests (`coordinate=wgs84`, `src=china-map`; sin coordenadas, `amap_search`)
- [x] Visor a pantalla completa y mood board por zona o región
- [x] Miniaturas y color dominante de cada foto (`scripts/thumbs.mjs`)
- [ ] Prueba en un móvil real con Amap: un sitio de Shenzhen y otro de Hong Kong

## Fase 3. Sin conexión y despliegue

- [x] PWA (`vite-plugin-pwa`): app, datos y fuentes precargados; fotos y mapa con «Preparar sin conexión»
- [x] El mapa sin conexión: `.pmtiles` en caché servido por trozos (plan B: OPFS)
- [x] `deploy/`: Docker Compose con Caddy (HTTPS, contraseña, `noindex`) y la API; `scripts/deploy.sh`
- [ ] `/security-review` y despliegue en la Pi

## Fase 4. Estados y rutas compartidos

- [ ] API en Node con SQLite: `status` y `routes`
- [ ] Sincronización con cola local (funciona sin conexión; gana el último cambio)
- [ ] Estados en el marcador, la ficha, los filtros y la pestaña Guardados
- [ ] Rutas con nombre: crear, ordenar arrastrando, dibujarlas en el mapa y abrir cada tramo en Amap.
  La app nunca propone rutas.

## Fase 5. Repaso antes de salir

- [ ] Capturas de Playwright comparadas con la maqueta, en claro y en oscuro
- [ ] Lista de comprobación en cada móvil: instalar, preparar sin conexión, modo avión, Amap en Shenzhen y
  Hong Kong, y un estado y una ruta que aparezcan en otro móvil

## Investigación: información práctica y consejos locales

Agentes en paralelo, uno por zona o grupo de zonas pequeñas. Cada uno escribe solo su
`research/<zona>.json`; después se revisa, `scripts/merge-research.mjs` lo fusiona en `places.json` y
`check-data` lo valida.

- [x] Shenzhen: Bao'an y costa este · Nanshan · Futian · Huaqiangbei, Luohu y Longgang
- [x] Hong Kong: Kowloon e isla
- [x] Guangzhou: Liwan y Zhujiang
- [x] Yangshuo: Yulong, Xingping y el pueblo

Reglas (de CLAUDE.md): nada inventado, cada dato con fuente, `null` o «por confirmar» si no se encuentra
o las fuentes se contradicen, y consejos resumidos en español con su fuente.

## Por confirmar

- Raspberry: modelo, sistema de 64 bits, Docker, SSH desde fuera, dominio o DDNS, puertos 80/443, y que
  el dominio abra desde China.
- Móviles de los 4 (iPhone o Android), si tienen Amap y los 4 nombres.
- Tamaño del extracto PMTiles y cuánto deja guardar cada móvil sin conexión.
- Amap: si `coordinate=wgs84` acierta en Shenzhen y en Hong Kong.
- Si la contraseña de Caddy funciona con la PWA instalada en iPhone (si no, página de contraseña con cookie).
- Si Dianping y Xiaohongshu se dejan consultar. Fotos de Monkey Hill (`mky`) y Sham Shui Po (`ssp`).
