import { describe, expect, it } from 'vitest';
import { amapLegUrl, amapUrl } from './amap';

const noria = {
  lat: 22.54427,
  lng: 113.88308,
  name_zh: '湾区之光摩天轮',
  amap_search: 'https://uri.amap.com/search?keyword=%E6%B9%BE&city=%E6%B7%B1%E5%9C%B3',
};

describe('amapUrl', () => {
  it('con coordenadas usa la navegación de CLAUDE.md (lng,lat,nombre; wgs84; src=china-map)', () => {
    const url = amapUrl(noria, 'walk');
    expect(url).toBe(
      'https://uri.amap.com/navigation?to=113.88308,22.54427,' +
        encodeURIComponent('湾区之光摩天轮') +
        '&mode=walk&coordinate=wgs84&callnative=1&src=china-map',
    );
  });

  it('respeta el modo elegido', () => {
    expect(amapUrl(noria, 'bus')).toContain('&mode=bus&');
    expect(amapUrl(noria, 'car')).toContain('&mode=car&');
  });

  it('el nombre chino va codificado y vuelve igual al decodificar', () => {
    const p = { ...noria, name_zh: '钟书阁（欢乐港湾）' };
    const to = new URL(amapUrl(p, 'walk')).searchParams.get('to');
    expect(to).toBe('113.88308,22.54427,钟书阁（欢乐港湾）');
  });

  it('sin coordenadas devuelve la búsqueda por nombre', () => {
    expect(amapUrl({ ...noria, lat: null, lng: null }, 'walk')).toBe(noria.amap_search);
  });
});

describe('amapLegUrl', () => {
  const ohb = { lat: 22.54631, lng: 113.88101, name_zh: '欢乐港湾', amap_search: 'https://uri.amap.com/search?keyword=x' };

  it('incluye origen y destino', () => {
    const u = new URL(amapLegUrl(ohb, noria, 'walk'));
    expect(u.searchParams.get('from')).toBe('113.88101,22.54631,欢乐港湾');
    expect(u.searchParams.get('to')).toBe('113.88308,22.54427,湾区之光摩天轮');
    expect(u.searchParams.get('coordinate')).toBe('wgs84');
  });

  it('si al origen le faltan coordenadas, navega solo hasta el destino', () => {
    expect(amapLegUrl({ ...ohb, lat: null, lng: null }, noria, 'walk')).toBe(amapUrl(noria, 'walk'));
  });

  it('si al destino le faltan coordenadas, usa su búsqueda', () => {
    expect(amapLegUrl(ohb, { ...noria, lat: null, lng: null }, 'walk')).toBe(noria.amap_search);
  });
});
