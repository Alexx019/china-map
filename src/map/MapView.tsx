import { AttributionControl, Map as MlMap, addProtocol, removeProtocol, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
// El worker de MapLibre se carga con una URL que Vite no detecta: se importa como fichero y se le pasa
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { FeatureCollection, Point } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { useEffect, useMemo, useRef } from 'react';
import { boundsOf, isLocated, TILE_BOUNDS } from '../data/geo';
import { photoBackground, thumbUrl } from '../data/photos';
import { useStore } from '../state/store';
import { useIsDark } from '../state/theme';
import { fitTo, flyToPlace, setMap } from './controller';
import { MarkerLayer, type PlaceProps } from './markers';
import { buildStyle, PLACES_SOURCE } from './style';

setWorkerUrl(workerUrl);

const CJK_FONTS = "'PingFang SC', 'Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif";

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<MarkerLayer | null>(null);

  const data = useStore((s) => s.data);
  const photos = useStore((s) => s.photos);
  const categories = useStore((s) => s.categories);
  const regionId = useStore((s) => s.regionId);
  const zoneId = useStore((s) => s.zoneId);
  const selectedId = useStore((s) => s.selectedId);
  const dark = useIsDark();

  // Sitios con coordenadas, filtrados por categoría
  const places = useMemo<FeatureCollection<Point, PlaceProps>>(() => {
    const list = (data?.places ?? []).filter(isLocated).filter((p) => !categories.length || categories.includes(p.category));
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
        },
      })),
    };
  }, [data, photos, categories]);

  const latest = useRef({ places, dark });
  latest.current = { places, dark };

  // Crear el mapa una vez hay datos
  useEffect(() => {
    if (!data || !container.current) return;
    const protocol = new Protocol();
    addProtocol('pmtiles', protocol.tile);

    const state = useStore.getState();
    const initial = boundsOf(data.places.filter((p) => p.region === state.regionId)) ?? TILE_BOUNDS;
    const map = new MlMap({
      container: container.current,
      style: buildStyle(latest.current.dark, latest.current.places),
      bounds: initial,
      fitBoundsOptions: { padding: { top: 176, bottom: 330, left: 36, right: 36 } },
      maxBounds: [
        [TILE_BOUNDS[0][0] - 1.2, TILE_BOUNDS[0][1] - 1],
        [TILE_BOUNDS[1][0] + 1.2, TILE_BOUNDS[1][1] + 1],
      ],
      minZoom: 6,
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
    return () => {
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
    mapRef.current?.setStyle(buildStyle(dark, latest.current.places), { diff: true });
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

  return <div ref={container} style={{ position: 'absolute', inset: 0 }} aria-label="Mapa" role="region" />;
}
