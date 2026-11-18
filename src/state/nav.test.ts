import { describe, expect, it } from 'vitest';
import { hashFor, parseHash } from './nav';
import type { Route } from './store';

const base: Route = { selectedId: null, zoneId: null, ficha: false, mood: null, viewer: null, routeId: null };

describe('hash ↔ ruta', () => {
  const cases: [string, Route][] = [
    ['', base],
    ['#/zona/fut', { ...base, zoneId: 'fut' }],
    ['#/sitio/pin', { ...base, selectedId: 'pin' }],
    ['#/ficha/pin', { ...base, selectedId: 'pin', ficha: true }],
    ['#/ficha/pin/foto/3', { ...base, selectedId: 'pin', ficha: true, viewer: 2 }],
    ['#/fotos/bao', { ...base, zoneId: 'bao', mood: { zone: 'bao', scope: 'zona' } }],
    ['#/ruta/r1abc', { ...base, routeId: 'r1abc' }],
    ['#/fotos/bao/region/foto/1', { ...base, zoneId: 'bao', mood: { zone: 'bao', scope: 'region' }, viewer: 0 }],
  ];
  for (const [hash, route] of cases) {
    it(`«${hash || '(vacío)'}»`, () => {
      expect(parseHash(hash)).toEqual(route);
      expect(hashFor(route)).toBe(hash);
    });
  }

  it('ignora rutas desconocidas y fotos mal escritas', () => {
    expect(parseHash('#/cosa/x')).toEqual(base);
    expect(parseHash('#/ficha/pin/foto/abc')).toEqual({ ...base, selectedId: 'pin', ficha: true });
  });
});
