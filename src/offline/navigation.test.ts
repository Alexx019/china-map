import { expect, it } from 'vitest';
import { SERVER_NAVIGATION } from './navigation';

it.each(['/api/health','/api/state','/mcp','/mcp/consent','/.well-known/oauth-protected-resource/mcp',
  '/authorize?client_id=test','/token','/register','/revoke','/data/places.json','/map/trip.pmtiles?coverage=test'])(
  'la navegación %s llega al servidor, no al index del modo sin conexión', path => {
    expect(SERVER_NAVIGATION.some(rule=>rule.test(path))).toBe(true);
  },
);
it.each(['/','/index.html','/ruta-de-la-app'])(
  'conserva la navegación sin conexión de la app para %s', path => {
    expect(SERVER_NAVIGATION.some(rule=>rule.test(path))).toBe(false);
  },
);
