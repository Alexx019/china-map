#!/usr/bin/env bash
# Publica china-map en la Raspberry.
#   scripts/deploy.sh          → compila y publica todo (app + datos + mapa) y arranca Caddy
#   scripts/deploy.sh --data   → solo datos y fotos (para añadir o corregir sitios durante el viaje)
# Necesita deploy/deploy.env (ver deploy/deploy.env.example) y acceso SSH a la Pi.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/deploy.env
: "${PI_SSH:?falta PI_SSH en deploy/deploy.env}" "${PI_DIR:?falta PI_DIR en deploy/deploy.env}"

if [[ "${1:-}" == "--data" ]]; then
  node scripts/thumbs.mjs
  node scripts/check-data.mjs
  rsync -az --info=stats1 public/data/ "$PI_SSH:$PI_DIR/site/data/"
  echo "Datos publicados. Los móviles los cogen al abrir la web con conexión."
  exit 0
fi

[[ -f public/map/trip.pmtiles ]] || { echo "Falta public/map/trip.pmtiles: ejecuta scripts/extract-tiles.sh"; exit 1; }
npm run build
ssh "$PI_SSH" "mkdir -p '$PI_DIR/site'"
rsync -az --delete --info=stats1 dist/ "$PI_SSH:$PI_DIR/site/"
rsync -az deploy/Caddyfile deploy/docker-compose.yml deploy/Dockerfile.api "$PI_SSH:$PI_DIR/"
rsync -az server/index.mjs "$PI_SSH:$PI_DIR/server/"
ssh "$PI_SSH" "cd '$PI_DIR' && test -f .env || { echo 'Falta $PI_DIR/.env (ver deploy/.env.example)'; exit 1; }; docker compose up -d --build && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile"
echo "Publicado."
