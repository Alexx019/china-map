#!/usr/bin/env node
// Busca candidatos de coordenadas para cada sitio en Nominatim (OSM) y genera geocode-review.md.
// NO escribe places.json: las coordenadas se aplican después de revisarlas (scripts/geocode-apply.mjs).
//
// Política de Nominatim: como mucho 1 petición por segundo, User-Agent que identifique la app y
// caché de respuestas (en .cache/nominatim/, para no repetir peticiones).
//
// Uso: node scripts/geocode.mjs [id1,id2,…]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'public/data/places.json'), 'utf8'));
const cacheDir = join(root, '.cache/nominatim');
mkdirSync(cacheDir, { recursive: true });

const UA = 'china-map/0.1 (private trip map; one-off geocoding of 52 places)';
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

// Cajas de búsqueda por región (lon_min, lat_max, lon_max, lat_min) para no salir de la zona.
const VIEWBOX = {
  sz: '113.75,22.88,114.65,22.42',
  gz: '113.10,23.45,113.60,22.95',
  hk: '113.82,22.58,114.45,22.15',
  ys: '110.20,25.10,110.70,24.55',
};

let last = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q, region) {
  const params = new URLSearchParams({
    q, format: 'jsonv2', limit: '5', namedetails: '1', addressdetails: '0',
    'accept-language': 'zh-CN,en', viewbox: VIEWBOX[region], bounded: '1',
  });
  const url = `${ENDPOINT}?${params}`;
  const file = join(cacheDir, createHash('sha1').update(url).digest('hex') + '.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} para «${q}»`);
  const json = await res.json();
  writeFileSync(file, JSON.stringify(json));
  return json;
}

// Consultas extra escritas a mano para los sitios difíciles (p. ej. Hong Kong usa caracteres tradicionales en OSM).
const extraFile = join(root, 'scripts/geocode-extra.json');
const EXTRA = existsSync(extraFile) ? JSON.parse(readFileSync(extraFile, 'utf8')) : {};

function variants(p) {
  const out = new Set();
  const zh = p.name_zh.trim();
  out.add(zh);
  const noParen = zh.replace(/[（(][^）)]*[）)]/g, '').trim();
  if (noParen) out.add(noParen);
  for (const part of zh.split('·').map((s) => s.trim()).filter(Boolean)) {
    out.add(part);
    out.add(part.replace(/[（(][^）)]*[）)]/g, '').trim());
  }
  // Lo que va entre paréntesis suele ser el sitio concreto (p. ej. «珠江夜游（广州塔码头）»)
  for (const m of zh.matchAll(/[（(]([^）)]*)[）)]/g)) out.add(m[1].trim());
  out.add(p.name);
  for (const q of EXTRA[p.id] ?? []) out.add(q);
  return [...out].filter(Boolean);
}

const only = process.argv[2]?.split(',');
const places = data.places.filter((p) => (only ? only.includes(p.id) : true));
const results = {};

for (const p of places) {
  const cands = [];
  for (const q of variants(p)) {
    try {
      for (const r of await search(q, p.region)) {
        cands.push({
          query: q,
          lat: Number(r.lat), lng: Number(r.lon),
          osm: `${r.osm_type}/${r.osm_id}`,
          kind: `${r.category}/${r.type}`,
          name: r.name ?? '',
          name_zh: r.namedetails?.['name:zh'] ?? r.namedetails?.name ?? '',
          name_en: r.namedetails?.['name:en'] ?? '',
          display: r.display_name,
          importance: r.importance ?? 0,
        });
      }
    } catch (e) {
      console.error(`${p.id}: ${e.message}`);
    }
  }
  // Quitar duplicados del mismo objeto OSM (salen con varias variantes)
  const seen = new Map();
  for (const c of cands) {
    const prev = seen.get(c.osm);
    if (prev) prev.queries.push(c.query);
    else seen.set(c.osm, { ...c, queries: [c.query] });
  }
  results[p.id] = [...seen.values()];
  console.log(`${p.id.padEnd(4)} ${String(results[p.id].length).padStart(2)} candidatos  ${p.name_zh}`);
}

// Distancia al resto de la zona (mediana de los mejores candidatos de los otros sitios) para detectar saltos.
const km = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const zoneCenter = {};
for (const z of data.zones) {
  const pts = data.places.filter((p) => p.zone === z.id && results[p.id]?.[0]).map((p) => results[p.id][0]);
  if (pts.length) zoneCenter[z.id] = { lat: median(pts.map((c) => c.lat)), lng: median(pts.map((c) => c.lng)) };
}

const outDir = join(root, '.cache');
// Con una lista de ids, se combinan con los candidatos ya guardados en vez de sustituirlos.
const candFile = join(outDir, 'geocode-candidates.json');
const merged = only && existsSync(candFile) ? { ...JSON.parse(readFileSync(candFile, 'utf8')), ...results } : results;
writeFileSync(candFile, JSON.stringify(merged, null, 2));

let md = '# Revisión de coordenadas\n\nCandidatos de Nominatim por sitio. Se aceptan solo coincidencias claras; el resto, `null`.\n';
for (const p of places) {
  md += `\n## ${p.id} · ${p.name} · ${p.name_zh}\n\n`;
  const cs = results[p.id];
  if (!cs.length) { md += 'Sin candidatos.\n'; continue; }
  md += '| osm | tipo | nombre | lat, lng | km al centro de la zona | consultas |\n|---|---|---|---|---|---|\n';
  for (const c of cs) {
    const d = zoneCenter[p.zone] ? km(c, zoneCenter[p.zone]).toFixed(1) : '—';
    md += `| [${c.osm}](https://www.openstreetmap.org/${c.osm}) | ${c.kind} | ${c.name_zh || c.name} ${c.name_en ? `(${c.name_en})` : ''} | ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} | ${d} | ${c.queries.join(' / ')} |\n`;
  }
}
writeFileSync(join(outDir, 'geocode-review.md'), md);
console.log('\nEscrito .cache/geocode-review.md y .cache/geocode-candidates.json');
