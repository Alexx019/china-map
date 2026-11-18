#!/usr/bin/env node
// Valida public/data/places.json contra el esquema de src/data/types.ts.
// Uso: npm run check-data  (sale con código 1 si hay errores; los avisos no bloquean)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'public', 'data');
const data = JSON.parse(readFileSync(join(dataDir, 'places.json'), 'utf8'));

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// Área del viaje: Guangdong (Shenzhen, Guangzhou), Hong Kong y Guilin (Yangshuo).
const BBOX = { minLat: 21.8, maxLat: 25.6, minLng: 109.9, maxLng: 114.9 };

const PRACTICAL_FIELDS = new Set([
  'how_to_get', 'payment', 'passport', 'rules', 'before_you_go', 'hours', 'closed_days', 'booking',
  'price_per_person', 'dishes', 'menu',
  'tickets', 'duration', 'best_time',
  'showtimes', 'best_spot',
]);
const isUrl = (s) => typeof s === 'string' && /^https?:\/\/\S+$/.test(s);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function checkSource(where, src) {
  if (!src || typeof src !== 'object') return err(where, 'fuente vacía');
  if (!isUrl(src.url)) err(where, `URL no válida: ${JSON.stringify(src.url)}`);
  if (typeof src.title !== 'string' || !src.title.trim()) err(where, 'fuente sin título');
  if (src.fields !== undefined) {
    if (!Array.isArray(src.fields)) err(where, '`fields` debe ser una lista');
    else for (const f of src.fields) if (!PRACTICAL_FIELDS.has(f)) err(where, `campo desconocido en fields: ${f}`);
  }
}

const regionIds = new Set(data.regions.map((r) => r.id));
const zonesById = new Map(data.zones.map((z) => [z.id, z]));
for (const z of data.zones) if (!regionIds.has(z.region)) err(`zona ${z.id}`, `región inexistente ${z.region}`);

const seen = new Set();
for (const p of data.places) {
  const at = `sitio ${p.id}`;
  if (seen.has(p.id)) err(at, 'id repetido');
  seen.add(p.id);

  for (const k of ['name', 'name_zh', 'city_zh', 'why', 'when', 'tip', 'amap_search']) {
    if (typeof p[k] !== 'string' || !p[k].trim()) err(at, `falta ${k}`);
  }
  if (!regionIds.has(p.region)) err(at, `región inexistente ${p.region}`);
  const zone = zonesById.get(p.zone);
  if (!zone) err(at, `zona inexistente ${p.zone}`);
  else if (zone.region !== p.region) err(at, `la zona ${p.zone} es de ${zone.region}, no de ${p.region}`);
  if (!data.categories[p.category]) err(at, `categoría inexistente ${p.category}`);
  if (!data.shot_types[p.shot]) err(at, `tipo de toma inexistente ${p.shot}`);
  if (!isUrl(p.amap_search)) err(at, 'amap_search no es una URL');

  if (!Array.isArray(p.photos)) err(at, 'photos debe ser una lista');
  else {
    if (p.photos.length === 0) warn(at, 'sin fotos');
    for (const f of p.photos) if (!existsSync(join(dataDir, f))) err(at, `no existe la foto ${f}`);
  }

  const hasLat = p.lat !== null && p.lat !== undefined;
  const hasLng = p.lng !== null && p.lng !== undefined;
  if (hasLat !== hasLng) err(at, 'lat y lng tienen que estar las dos o ninguna');
  if (hasLat && hasLng) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') err(at, 'lat/lng deben ser números');
    else if (p.lat < BBOX.minLat || p.lat > BBOX.maxLat || p.lng < BBOX.minLng || p.lng > BBOX.maxLng)
      err(at, `coordenadas fuera del área del viaje (${p.lat}, ${p.lng})`);
    if (!p.geo) warn(at, 'tiene coordenadas pero no `geo` (¿de dónde salen?)');
    else if (!p.geo.checked) warn(at, 'coordenadas sin revisar a mano');
  }
  if (p.geo !== undefined) {
    if (!['nominatim', 'manual'].includes(p.geo.source)) err(at, `geo.source no válido: ${p.geo.source}`);
    if (typeof p.geo.checked !== 'boolean') err(at, 'geo.checked debe ser true o false');
    if (p.geo.note !== undefined && (typeof p.geo.note !== 'string' || !p.geo.note.trim())) err(at, 'geo.note vacío');
  }

  if (p.practical !== undefined) {
    const pr = p.practical;
    const w = `${at} · practical`;
    if (!isDate(pr.verified_at)) err(w, `verified_at debe ser AAAA-MM-DD (${JSON.stringify(pr.verified_at)})`);
    if (!Array.isArray(pr.sources)) err(w, 'sources debe ser una lista');
    else pr.sources.forEach((s, i) => checkSource(`${w} · fuente ${i + 1}`, s));
    const backed = new Set((pr.sources ?? []).flatMap((s) => s.fields ?? []));
    for (const [k, v] of Object.entries(pr)) {
      if (k === 'sources' || k === 'verified_at') continue;
      if (!PRACTICAL_FIELDS.has(k)) { err(w, `campo desconocido: ${k}`); continue; }
      if (v !== null && (typeof v !== 'string' || !v.trim())) err(w, `${k} debe ser texto o null`);
      if (typeof v === 'string' && !backed.has(k)) warn(w, `${k} no aparece en el \`fields\` de ninguna fuente`);
    }
    if (Array.isArray(pr.sources) && pr.sources.length === 0) {
      const anyValue = Object.entries(pr).some(([k, v]) => PRACTICAL_FIELDS.has(k) && typeof v === 'string');
      if (anyValue) err(w, 'hay datos pero ninguna fuente');
    }
  }

  if (p.tips !== undefined) {
    if (!Array.isArray(p.tips)) err(at, 'tips debe ser una lista');
    else {
      if (p.tips.length > 5) err(at, `demasiados consejos (${p.tips.length}; máximo 5)`);
      if (p.tips.length === 1) warn(at, 'solo 1 consejo (CLAUDE.md pide de 2 a 5, o ninguno)');
      p.tips.forEach((t, i) => {
        if (typeof t.text !== 'string' || !t.text.trim()) err(`${at} · consejo ${i + 1}`, 'sin texto');
        checkSource(`${at} · consejo ${i + 1}`, t.source);
      });
    }
  }
}

const total = data.places.length;
const geocoded = data.places.filter((p) => p.lat != null).length;
const researched = data.places.filter((p) => p.practical).length;
for (const w of warnings) console.warn(`aviso  ${w}`);
for (const e of errors) console.error(`ERROR  ${e}`);
console.log(
  `\n${total} sitios · ${geocoded} con coordenadas · ${researched} con información práctica · ` +
    `${errors.length} errores · ${warnings.length} avisos`,
);
process.exit(errors.length ? 1 : 0);
