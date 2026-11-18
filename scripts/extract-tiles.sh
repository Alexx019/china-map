#!/usr/bin/env bash
# Extrae del build diario de Protomaps las teselas de las zonas del viaje (scripts/trip-region.geojson).
# Uso: scripts/extract-tiles.sh <ruta-al-binario-pmtiles> [AAAAMMDD] [--dry-run]
# Necesita el CLI de go-pmtiles: https://github.com/protomaps/go-pmtiles/releases
set -euo pipefail
PMTILES=${1:?ruta al binario pmtiles}
BUILD=${2:-$(curl -s https://build-metadata.protomaps.dev/builds.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s);console.log(b[b.length-1].key.replace('.pmtiles',''))})")}
shift 2 || true
cd "$(dirname "$0")/.."
mkdir -p public/map
"$PMTILES" extract "https://build.protomaps.com/${BUILD}.pmtiles" public/map/trip.pmtiles \
  --region=scripts/trip-region.geojson --maxzoom=14 "$@"
echo "Build ${BUILD} → public/map/trip.pmtiles"
