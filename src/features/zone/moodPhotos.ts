import type { Route } from '../../state/store';
import type { Place, TripData } from '../../data/types';

export interface PhotoRef {
  photo: string;
  place: Place;
}

/** Fotos que se ven en el visor: las del mood board si está abierto; si no, las del sitio elegido. */
export function viewerPhotos(data: TripData, r: Pick<Route, 'mood' | 'selectedId'>): PhotoRef[] {
  if (r.mood) return moodPhotos(data, r.mood);
  const place = data.places.find((p) => p.id === r.selectedId);
  return place ? place.photos.map((photo) => ({ photo, place })) : [];
}

/**
 * Fotos de una zona o de toda su región. Se intercalan por sitio (1.ª de cada sitio, luego 2.ª…)
 * para que la cuadrícula mezcle sitios en vez de agruparlos.
 */
export function moodPhotos(data: TripData, mood: NonNullable<Route['mood']>): PhotoRef[] {
  const zone = data.zones.find((z) => z.id === mood.zone);
  if (!zone) return [];
  const places = data.places.filter((p) => (mood.scope === 'region' ? p.region === zone.region : p.zone === zone.id));
  const out: PhotoRef[] = [];
  const max = Math.max(0, ...places.map((p) => p.photos.length));
  for (let i = 0; i < max; i++) for (const p of places) if (p.photos[i]) out.push({ photo: p.photos[i], place: p });
  return out;
}
