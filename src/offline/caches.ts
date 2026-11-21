// Nombres de caché compartidos entre el service worker (src/sw.ts) y la app (prepare.ts).
export const CACHE = {
  data: 'cm-data-v1',
  photos: 'cm-photos-v1',
  thumbs: 'cm-thumbs-v1',
  map: 'cm-map-v4',
} as const;

export const MAP_PATH = '/map/trip.pmtiles';
// Evita reutilizar rangos HTTP del recorte anterior.
export const MAP_URL = `${MAP_PATH}?coverage=layered-v4`;
export const DATA_URLS = ['/data/places.json', '/data/thumbs/photos.json'];
