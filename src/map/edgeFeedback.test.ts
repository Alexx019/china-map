import { describe, expect, it } from 'vitest';
import { boundaryPull } from './edgeFeedback';
import { CONTEXT_BOUNDS, MAP_BOUNDS, TILE_BOUNDS } from '../data/geo';
import data from '../../public/data/places.json';

describe('límites del mapa', () => {
  it('no muestra resistencia al desplazarse dentro del mapa', () => {
    expect(boundaryPull(20, -20, { west: -100, east: 600, north: -100, south: 1000 }, 400, 800))
      .toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });
  it('solo responde al empujar hacia fuera, también en esquinas', () => {
    const bounds = { west: 0, east: 400, north: 0, south: 800 };
    expect(boundaryPull(30, 20, bounds, 400, 800)).toEqual({ left: 30, top: 20, right: 0, bottom: 0 });
    expect(boundaryPull(-30, -20, bounds, 400, 800)).toEqual({ left: 0, top: 0, right: 30, bottom: 20 });
  });
  it('mantiene todos los sitios dentro del límite y un margen de teselas fuera', () => {
    expect(CONTEXT_BOUNDS[0][0]).toBeLessThan(MAP_BOUNDS[0][0] - 1);
    expect(CONTEXT_BOUNDS[0][1]).toBeLessThan(MAP_BOUNDS[0][1] - 1);
    expect(CONTEXT_BOUNDS[1][0]).toBeGreaterThan(MAP_BOUNDS[1][0] + 1);
    expect(CONTEXT_BOUNDS[1][1]).toBeGreaterThan(MAP_BOUNDS[1][1] + 1);
    expect(MAP_BOUNDS[0][0]).toBeGreaterThan(TILE_BOUNDS[0][0]);
    expect(MAP_BOUNDS[0][1]).toBeGreaterThan(TILE_BOUNDS[0][1]);
    expect(MAP_BOUNDS[1][0]).toBeLessThan(TILE_BOUNDS[1][0]);
    expect(MAP_BOUNDS[1][1]).toBeLessThan(TILE_BOUNDS[1][1]);
    for (const place of data.places) {
      if (place.lng == null || place.lat == null) continue;
      expect(place.lng).toBeGreaterThan(MAP_BOUNDS[0][0]);
      expect(place.lng).toBeLessThan(MAP_BOUNDS[1][0]);
      expect(place.lat).toBeGreaterThan(MAP_BOUNDS[0][1]);
      expect(place.lat).toBeLessThan(MAP_BOUNDS[1][1]);
      // Las ciudades deben tener espacio de exploración, no rozar el límite.
      expect(Math.min(place.lng - MAP_BOUNDS[0][0], MAP_BOUNDS[1][0] - place.lng)).toBeGreaterThan(1.5);
      expect(Math.min(place.lat - MAP_BOUNDS[0][1], MAP_BOUNDS[1][1] - place.lat)).toBeGreaterThan(1.5);
    }
  });
});
