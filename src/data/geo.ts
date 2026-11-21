import type { LngLatBoundsLike } from 'maplibre-gl';
import type { Place } from './types';
import coverage from '../../scripts/trip-region.geojson?raw';
import contextCoverage from '../../scripts/map-context.geojson?raw';

export type Located = Place & { lat: number; lng: number };
export const isLocated = (p: Place): p is Located => p.lat != null && p.lng != null;

/** Zona cubierta por el extracto de teselas (scripts/trip-region.geojson). */
const ring = JSON.parse(coverage).features[0].geometry.coordinates[0] as [number, number][];
export const TILE_BOUNDS: [[number, number], [number, number]] = [
  [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1]))],
  [Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))],
];
const contextRing = JSON.parse(contextCoverage).geometry.coordinates[0] as [number, number][];
export const CONTEXT_BOUNDS: [[number, number], [number, number]] = [
  [Math.min(...contextRing.map(p => p[0])), Math.min(...contextRing.map(p => p[1]))],
  [Math.max(...contextRing.map(p => p[0])), Math.max(...contextRing.map(p => p[1]))],
];

// Margen interior: el viewport se detiene antes del último borde de las teselas.
export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [TILE_BOUNDS[0][0] + 0.12, TILE_BOUNDS[0][1] + 0.12],
  [TILE_BOUNDS[1][0] - 0.12, TILE_BOUNDS[1][1] - 0.12],
];

/** Encuadre de un conjunto de sitios; null si ninguno tiene coordenadas. */
export function boundsOf(places: Place[]): LngLatBoundsLike | null {
  const pts = places.filter(isLocated);
  if (!pts.length) return null;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  // Un solo sitio: un margen mínimo para que el encuadre no sea un punto
  const pad = pts.length === 1 ? 0.004 : 0;
  return [
    [w - pad, s - pad],
    [e + pad, n + pad],
  ];
}
