# china-map

Guía privada de sitios con mapa para el viaje a Shenzhen, Guangzhou, Hong Kong y Yangshuo
(22 nov – 2 dic 2026). Qué tiene que hacer: [CLAUDE.md](CLAUDE.md) · Plan: [PLAN.md](PLAN.md) ·
Diseño: [docs/design/](docs/design/README.md) · Despliegue: [deploy/](deploy/README.md).

**Portainer + Cloudflare Tunnel desde Git:** [guía de instalación y actualizaciones](deploy/portainer/README.md).
Usa `docker-compose.yml` en la raíz: compila la web y la API y prepara el mapa
automáticamente en el primer arranque, con SQLite y mapa en volúmenes persistentes.

## Probarla en el ordenador

Requisitos: Node 22 o superior y el mapa descargado en `public/map/trip.pmtiles` (ver abajo).

```sh
npm install
npm run local            # web + API → http://localhost:5173
npm run local -- --prod  # build de producción → http://localhost:4173 (service worker y modo sin conexión)
```

Para verla como en un móvil: en Chrome o Edge, `F12` → icono de móvil (o `Ctrl+Shift+M`) y elegir
un iPhone o un Pixel. Para probar sin conexión: build de producción, «Guardar en el móvil» en la hoja
de la región, y en las herramientas de desarrollo → *Network* → *Offline*.

Desde WSL, `localhost` funciona igual en el navegador de Windows.

**En el móvil por la wifi de casa** se puede abrir con la IP del ordenador (`http://192.168.x.x:5173`),
pero sin HTTPS el navegador no activa el modo sin conexión ni deja copiar al portapapeles, y desde WSL
hace falta redirigir el puerto en Windows. Para probarla de verdad en el móvil, mejor esperar a la Pi.

## Datos

- `public/data/places.json`: sitios, con su información práctica y consejos (fuentes en `research/`).
- `npm run check-data`: valida el fichero (se ejecuta también antes de cada build).
- Coordenadas: `scripts/geocode.mjs` → revisar → `scripts/geocode-decisions.json` → `scripts/geocode-apply.mjs`.
- Mapa: `scripts/extract-tiles.sh <binario-pmtiles>` (44 MB, fuera de git).
- Miniaturas: `scripts/thumbs.mjs` (también antes de cada build).

## Comprobaciones

```sh
npm test            # URLs de Amap, navegación, fusión de estados
npm run build       # incluye check-data y la comprobación de tipos
```
