import type { Place } from './types';

/** Modos de la URL de Amap: a pie, transporte público y coche/taxi. */
export type AmapMode = 'walk' | 'bus' | 'car';

export const AMAP_MODES: { id: AmapMode; label: string }[] = [
  { id: 'walk', label: 'A pie' },
  { id: 'bus', label: 'Transporte' },
  { id: 'car', label: 'Taxi' },
];

/**
 * URL que abre Amap con la ruta hasta el sitio (formato de CLAUDE.md).
 * - Con coordenadas: navegación con `coordinate=wgs84` (las nuestras son de OSM).
 * - Sin coordenadas: la búsqueda por nombre en chino que ya trae places.json.
 */
export function amapUrl(place: Pick<Place, 'lat' | 'lng' | 'name_zh' | 'amap_search'>, mode: AmapMode): string {
  if (place.lat == null || place.lng == null) return place.amap_search;
  const to = `${place.lng},${place.lat},${encodeURIComponent(place.name_zh)}`;
  return `https://uri.amap.com/navigation?to=${to}&mode=${mode}&coordinate=wgs84&callnative=1&src=china-map`;
}

/** Tramo entre dos sitios (rutas del grupo, fase 4). Sin coordenadas en algún extremo → búsqueda del destino. */
export function amapLegUrl(
  from: Pick<Place, 'lat' | 'lng' | 'name_zh'>,
  to: Pick<Place, 'lat' | 'lng' | 'name_zh' | 'amap_search'>,
  mode: AmapMode,
): string {
  if (from.lat == null || from.lng == null) return amapUrl(to, mode);
  if (to.lat == null || to.lng == null) return to.amap_search;
  const f = `${from.lng},${from.lat},${encodeURIComponent(from.name_zh)}`;
  const t = `${to.lng},${to.lat},${encodeURIComponent(to.name_zh)}`;
  return `https://uri.amap.com/navigation?from=${f}&to=${t}&mode=${mode}&coordinate=wgs84&callnative=1&src=china-map`;
}
