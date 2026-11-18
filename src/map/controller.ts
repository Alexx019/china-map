import type { LngLatBoundsLike, Map as MlMap } from 'maplibre-gl';
import type { Located } from '../data/geo';

// Acceso al mapa desde fuera de React (botones, hoja inferior, búsqueda).
let map: MlMap | null = null;
let ready = false;
let pending: ((m: MlMap) => void)[] = [];
let bottomInset = 300;

export const setMap = (m: MlMap | null) => {
  // La cola no se vacía al cambiar de mapa: en desarrollo (StrictMode) el primero se crea y se
  // destruye enseguida, y una orden pedida entonces tiene que llegar al mapa definitivo.
  map = m;
  ready = false;
  m?.once('load', () => {
    if (map !== m) return;
    ready = true;
    for (const fn of pending) fn(m);
    pending = [];
  });
  if (import.meta.env.DEV) (window as unknown as { __map?: MlMap | null }).__map = m;
};
export const getMap = () => map;

/** Alto visible de la hoja inferior: el mapa centra lo que se pide en el hueco que queda libre. */
export const setBottomInset = (px: number) => {
  bottomInset = px;
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const padding = () => ({ top: 176, bottom: bottomInset + 24, left: 36, right: 36 });

/** Las órdenes de cámara que llegan antes de que el mapa cargue se perderían: se aplazan a 'load'. */
function whenReady(fn: (m: MlMap) => void) {
  if (map && ready) fn(map);
  else pending = [fn]; // solo cuenta la última orden
}

export function fitTo(bounds: LngLatBoundsLike, maxZoom = 15) {
  whenReady((map) => map.fitBounds(bounds, { padding: padding(), maxZoom, duration: reducedMotion() ? 0 : 900 }));
}

export function flyToPlace(p: Located) {
  whenReady((map) =>
    map.flyTo({
      center: [p.lng, p.lat],
      zoom: Math.max(map.getZoom(), 15),
      padding: padding(),
      duration: reducedMotion() ? 0 : 1000,
      essential: true,
    }),
  );
}

export function flyTo(lng: number, lat: number, zoom = 15) {
  whenReady((map) => map.flyTo({ center: [lng, lat], zoom, padding: padding(), duration: reducedMotion() ? 0 : 1000 }));
}
