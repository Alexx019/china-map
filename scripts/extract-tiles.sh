#!/usr/bin/env bash
# Fondo regional 0–10 + detalle del viaje 11–14, sin teselas duplicadas.
# Uso: scripts/extract-tiles.sh <ruta-pmtiles> [AAAAMMDD] [--dry-run]
set -euo pipefail
PMTILES=${1:?ruta al binario pmtiles}
shift
BUILD=${1:-}
if [[ "$BUILD" =~ ^[0-9]{8}$ ]]; then shift; else BUILD=""; fi
if [[ -z "$BUILD" ]]; then
  BUILD=$(curl -fsS https://build-metadata.protomaps.dev/builds.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s);console.log(b[b.length-1].key.replace('.pmtiles',''))})")
fi
cd "$(dirname "$0")/.."
mkdir -p public/map
if [[ "${1:-}" == "--dry-run" ]]; then
  "$PMTILES" extract "https://build.protomaps.com/${BUILD}.pmtiles" public/map/context.partial.pmtiles --region=scripts/map-context.geojson --maxzoom=10 --dry-run
  "$PMTILES" extract "https://build.protomaps.com/${BUILD}.pmtiles" public/map/detail.partial.pmtiles --region=scripts/trip-region.geojson --minzoom=11 --maxzoom=14 --dry-run
  exit 0
fi
PMTILES_BIN="$PMTILES" MAP_BUILD="$BUILD" node --input-type=module -e '
import { prepareMap } from "./deploy/portainer/prepare-map.mjs";
await prepareMap({ directory: "public/map", region: "scripts/trip-region.geojson", context: "scripts/map-context.geojson" });
'
echo "Build ${BUILD} → public/map/trip.pmtiles"
