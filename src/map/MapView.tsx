import { AttributionControl, Map as MlMap, Marker, addProtocol, removeProtocol, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
// El worker de MapLibre se carga con una URL que Vite no detecta: se importa como fichero y se le pasa
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useShared } from '../state/shared';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { useEffect, useMemo, useRef } from 'react';
import { boundsOf, isLocated, MAP_BOUNDS, TILE_BOUNDS } from '../data/geo';
import { photoBackground, thumbUrl } from '../data/photos';
import { useStore } from '../state/store';
import { useIsDark } from '../state/theme';
import { cameraInsets, fitTo, flyToPlace, setMap } from './controller';
import { MarkerLayer, type PlaceProps } from './markers';
import { buildStyle, PLACES_SOURCE, ROUTE_SOURCE } from './style';
import { attachEdgeFeedback } from './edgeFeedback';
import css from './MapView.module.css';
import { attachOverview } from './overview';

setWorkerUrl(workerUrl);

const CJK_FONTS = "'PingFang SC', 'Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif";

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const edges = useRef<SVGSVGElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<MarkerLayer | null>(null);

  const data = useStore((s) => s.data);
  const photos = useStore((s) => s.photos);
  const categories = useStore((s) => s.categories);
  const statusFilter = useStore((s) => s.statusFilter);
  const statuses = useShared((s) => s.statuses);
  const routeId = useStore((s) => s.routeId);
  const route = useShared((s) => (routeId ? s.routes[routeId] : undefined));
  const regionId = useStore((s) => s.regionId);
  const zoneId = useStore((s) => s.zoneId);
  const selectedId = useStore((s) => s.selectedId);
  const dark = useIsDark();

  // Sitios con coordenadas, filtrados por categoría
  const places = useMemo<FeatureCollection<Point, PlaceProps>>(() => {
    const list = (data?.places ?? [])
      .filter(isLocated)
      .filter((p) => !categories.length || categories.includes(p.category))
      .filter((p) => {
        if (!statusFilter.length) return true;
        const v = statuses[p.id]?.value;
        return v ? statusFilter.includes(v) : false;
      });
    return {
      type: 'FeatureCollection',
      features: list.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          name: p.name,
          category: p.category,
          thumb: p.photos[0] ? thumbUrl(p.photos[0], 's') : '',
          bg: photoBackground(photos[p.photos[0]]),
          status: statuses[p.id]?.value ?? '',
        },
      })),
    };
  }, [data, photos, categories, statusFilter, statuses]);

  // Ruta abierta: paradas con coordenadas, en orden
  const routeStops = useMemo(() => {
    if (!data || !route || route.deleted) return [];
    return route.stops.map((id) => data.places.find((p) => p.id === id)).filter((p) => p !== undefined).filter(isLocated);
  }, [data, route]);
  const routeLine = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features:
        routeStops.length > 1
          ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeStops.map((p) => [p.lng, p.lat]) } }]
          : [],
    }),
    [routeStops],
  );

  const latest = useRef({ places, dark, routeLine });
  latest.current = { places, dark, routeLine };

  // Crear el mapa una vez hay datos
  useEffect(() => {
    if (!data || !container.current) return;
    const protocol = new Protocol();
    addProtocol('pmtiles', protocol.tile);

    const state = useStore.getState();
    const overviewPlaces = () => {
      const region = useStore.getState().regionId;
      return data.places.filter(p => region === 'sz' || region === 'hk' ? p.region === 'sz' || p.region === 'hk' : p.region === region);
    };
    const initial = boundsOf(overviewPlaces()) ?? TILE_BOUNDS;
    const map = new MlMap({
      container: container.current,
      style: buildStyle(latest.current.dark, latest.current.places, latest.current.routeLine),
      bounds: initial,
      fitBoundsOptions: { padding: cameraInsets() },
      maxBounds: MAP_BOUNDS,
      renderWorldCopies: false,
      minZoom: 4,
      maxZoom: 18,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      localIdeographFontFamily: CJK_FONTS,
      fadeDuration: 150,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new AttributionControl({ compact: true }), 'top-right');
    const detachEdges = edges.current ? attachEdgeFeedback(map, edges.current) : undefined;

    const markers = new MarkerLayer(map, (id) => useStore.getState().select(id));
    markers.setSelected(state.selectedId);
    map.on('render', markers.sync);
    // Tocar el mapa (fuera de un marcador) deselecciona, como en cualquier app de mapas
    map.on('click', () => {
      if (useStore.getState().selectedId) useStore.getState().select(null);
    });

    mapRef.current = map;
    markersRef.current = markers;
    setMap(map);
    const detachOverview = attachOverview(map, () => boundsOf(overviewPlaces()) ?? TILE_BOUNDS);
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      detachOverview?.();
      detachEdges?.();
      markers.destroy();
      map.remove();
      removeProtocol('pmtiles');
      mapRef.current = null;
      markersRef.current = null;
      setMap(null);
    };
  }, [data]);

  // Claro / oscuro sin recrear el mapa
  useEffect(() => {
    mapRef.current?.setStyle(buildStyle(dark, latest.current.places, latest.current.routeLine), { diff: true });
  }, [dark]);

  // Filtros
  useEffect(() => {
    (mapRef.current?.getSource(PLACES_SOURCE) as GeoJSONSource | undefined)?.setData(places);
  }, [places]);

  // Cámara: el sitio elegido manda; si no, la zona; si no, la región
  const prev = useRef({ regionId, zoneId, selectedId });
  useEffect(() => {
    const before = prev.current;
    prev.current = { regionId, zoneId, selectedId };
    markersRef.current?.setSelected(selectedId);
    if (!data || !mapRef.current) return;

    if (selectedId && selectedId !== before.selectedId) {
      const p = data.places.find((x) => x.id === selectedId);
      if (p && isLocated(p)) flyToPlace(p);
      return;
    }
    if (zoneId && zoneId !== before.zoneId) {
      const b = boundsOf(data.places.filter((p) => p.zone === zoneId));
      if (b) fitTo(b, 16);
      return;
    }
    if (regionId !== before.regionId || (before.zoneId && !zoneId && !selectedId)) {
      const b = boundsOf(data.places.filter((p) => p.region === regionId));
      if (b) fitTo(b, 14);
    }
  }, [data, regionId, zoneId, selectedId]);

  // Ruta: línea + paradas numeradas; al abrirla, encuadre de todas las paradas
  const stopMarkers = useRef<Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(routeLine);
    for (const m of stopMarkers.current) m.remove();
    stopMarkers.current = routeStops.map((p, i) => {
      const el = document.createElement('div');
      el.className = 'stop';
      el.textContent = String(i + 1);
      // Encima del marcador del sitio, sin taparlo
      return new Marker({ element: el, offset: [0, -34] }).setLngLat([p.lng, p.lat]).addTo(map);
    });
  }, [routeLine, routeStops]);
  const fittedRoute = useRef<string | null>(null);
  useEffect(() => {
    // Encuadrar al abrir la ruta y cada vez que cambia el número de paradas
    const key = routeId ? `${routeId}:${routeStops.length}` : null;
    if (!key) fittedRoute.current = null;
    if (!key || fittedRoute.current === key || !routeStops.length) return;
    fittedRoute.current = key;
    const b = boundsOf(routeStops);
    if (b) fitTo(b, 16);
  }, [routeId, routeStops]);

  return (
    <div className={css.frame} aria-label="Mapa" role="region">
      <div ref={container} className={css.canvas} />
      <svg ref={edges} className={css.edges} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path data-edge="left" /><path data-edge="right" />
        <path data-edge="top" /><path data-edge="bottom" />
      </svg>
    </div>
  );
}
