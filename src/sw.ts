/// <reference lib="webworker" />
// Service worker: la app tiene que abrir aunque la conexión China → España falle.
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { createPartialResponse } from 'workbox-range-requests';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CACHE, MAP_PATH, MAP_URL } from './offline/caches';
import { SERVER_NAVIGATION } from './offline/navigation';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// App, estilos, fuentes y glifos del mapa: en la caché desde la primera visita
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist:SERVER_NAVIGATION }));

const ok = new CacheableResponsePlugin({ statuses: [200] });

// Datos: siempre lo último si hay red (para los sitios nuevos), y si tarda o no hay, lo guardado
registerRoute(
  ({ url }) => url.pathname === '/data/places.json' || url.pathname === '/data/thumbs/photos.json',
  new NetworkFirst({ cacheName: CACHE.data, networkTimeoutSeconds: 4, plugins: [ok] }),
);

// Fotos y miniaturas: no cambian; si están guardadas no se piden
registerRoute(({ url }) => url.pathname.startsWith('/data/thumbs/'), new CacheFirst({ cacheName: CACHE.thumbs, plugins: [ok] }));
registerRoute(({ url }) => url.pathname.startsWith('/data/photos/'), new CacheFirst({ cacheName: CACHE.photos, plugins: [ok] }));

// Mapa: el lector de PMTiles pide trozos (Range). Si el fichero entero está guardado
// («Preparar sin conexión»), se sirven los trozos desde la caché; si no, van a la red.
registerRoute(
  ({ url }) => url.pathname === MAP_PATH && url.search === new URL(MAP_URL, self.location.origin).search,
  async ({ request }) => {
    const cached = await (await caches.open(CACHE.map)).match(MAP_URL);
    if (cached) return request.headers.has('range') ? createPartialResponse(request, cached) : cached;
    return fetch(request);
  },
);
