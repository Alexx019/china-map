import { expect, it } from 'vitest';
import { MercatorCoordinate } from 'maplibre-gl';
import { MAP_BOUNDS } from '../data/geo';
import { overviewZoom } from './overview';

it.each([[390, 844, 308], [390, 844, 114], [1440, 900, 308], [844, 390, 230]])(
  'permite centrar Shenzhen/Hong Kong sin que maxBounds desplace el foco (%sx%s)', (width, height, bottom) => {
    const padding = { top: 136, bottom, left: 24, right: 24 };
    const target: [number, number] = [114.1, 22.5];
    const zoom = overviewZoom(width, height, target, padding);
    const scale = 512 * 2 ** zoom;
    const center = MercatorCoordinate.fromLngLat(target);
    const nw = MercatorCoordinate.fromLngLat([MAP_BOUNDS[0][0], MAP_BOUNDS[1][1]]);
    const se = MercatorCoordinate.fromLngLat([MAP_BOUNDS[1][0], MAP_BOUNDS[0][1]]);
    const x = (width + padding.left - padding.right) / 2;
    const y = (height + padding.top - padding.bottom) / 2;
    expect(center.x - x / scale).toBeGreaterThan(nw.x);
    expect(center.x + (width - x) / scale).toBeLessThan(se.x);
    expect(center.y - y / scale).toBeGreaterThan(nw.y);
    expect(center.y + (height - y) / scale).toBeLessThan(se.y);
  },
);
