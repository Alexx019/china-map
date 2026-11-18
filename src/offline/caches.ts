// Nombres de caché compartidos entre el service worker (src/sw.ts) y la app (prepare.ts).
export const CACHE = {
  data: 'cm-data-v1',
  photos: 'cm-photos-v1',
  thumbs: 'cm-thumbs-v1',
  map: 'cm-map-v1',
} as const;

export const MAP_URL = '/map/trip.pmtiles';
export const DATA_URLS = ['/data/places.json', '/data/thumbs/photos.json'];
