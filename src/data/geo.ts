import type { LngLatBoundsLike } from 'maplibre-gl';
import type { Place } from './types';

export type Located = Place & { lat: number; lng: number };
export const isLocated = (p: Place): p is Located => p.lat != null && p.lng != null;

/** Zona cubierta por el extracto de teselas (scripts/trip-region.geojson). */
export const TILE_BOUNDS: [[number, number], [number, number]] = [
  [110.3, 22.15],
  [114.65, 25.05],
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
