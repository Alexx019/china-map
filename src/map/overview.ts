import { LngLatBounds, MercatorCoordinate, type LngLatBoundsLike, type Map as MlMap, type MapMovementEvent } from 'maplibre-gl';
import { MAP_BOUNDS } from '../data/geo';
import { cameraInsets } from './controller';

export function overviewZoom(width: number, height: number, target: [number, number], padding: ReturnType<typeof cameraInsets>) {
  const point = MercatorCoordinate.fromLngLat(target);
  const nw = MercatorCoordinate.fromLngLat([MAP_BOUNDS[0][0], MAP_BOUNDS[1][1]]);
  const se = MercatorCoordinate.fromLngLat([MAP_BOUNDS[1][0], MAP_BOUNDS[0][1]]);
  const x = (width + padding.left - padding.right) / 2;
  const y = (height + padding.top - padding.bottom) / 2;
  const scale = Math.max(x / (point.x - nw.x), (width - x) / (se.x - point.x),
    y / (point.y - nw.y), (height - y) / (se.y - point.y));
  // Cabe el viewport completo dentro del límite, manteniendo el foco en la zona visible.
  return Math.max(6.25, Math.log2(scale / 512) + 0.04);
}

/** Al alejar al mínimo, Shenzhen + Hong Kong (o la región elegida) vuelven al centro. */
export function attachOverview(map: MlMap, getBounds: () => LngLatBoundsLike) {
  let syncing = false;
  const target = (): [number, number] => {
    const center = LngLatBounds.convert(getBounds()).getCenter();
    return [center.lng, center.lat];
  };
  function recenter() {
    if (syncing || map.getZoom() > map.getMinZoom() + 0.025) return;
    const center = target();
    const padding = cameraInsets();
    const zoom = overviewZoom(map.getContainer().clientWidth, map.getContainer().clientHeight, center, padding);
    const current = map.getCenter();
    const old = map.getPadding();
    if (Math.abs(current.lng - center[0]) < 0.00001 && Math.abs(current.lat - center[1]) < 0.00001
      && old.bottom === padding.bottom && old.top === padding.top && Math.abs(map.getZoom() - zoom) < 0.001) return;
    syncing = true;
    map.setMinZoom(zoom);
    syncing = false;
    map.easeTo({ center, zoom, padding, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250 });
  }
  function update(event?: { type: string }) {
    if (syncing) return;
    const wasAtMinimum = map.getZoom() <= map.getMinZoom() + 0.025;
    syncing = true;
    const padding = cameraInsets();
    map.setPadding(padding);
    map.setMinZoom(overviewZoom(map.getContainer().clientWidth, map.getContainer().clientHeight, target(), padding));
    syncing = false;
    if (wasAtMinimum && event?.type !== 'zoomstart') recenter();
  }
  map.on('load', update);
  map.on('resize', update);
  const zoomed = (event: MapMovementEvent) => {
    // Los cambios temporales de maxBounds también pueden emitir zoomend.
    // Solo un gesto de zoom del usuario debe recuperar el encuadre regional.
    if (event.originalEvent) recenter();
  };
  map.on('zoomend', zoomed);
  return () => {
    map.off('load', update);
    map.off('resize', update);
    map.off('zoomend', zoomed);
  };
}
