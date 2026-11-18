#!/usr/bin/env node
// Aplica a places.json las coordenadas revisadas a mano (scripts/geocode-decisions.json),
// tomándolas de los candidatos de Nominatim (.cache/geocode-candidates.json, de scripts/geocode.mjs).
// Los sitios sin decisión no se tocan: se quedan como estén (null si no tenían).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'public/data/places.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
const decisions = JSON.parse(readFileSync(join(root, 'scripts/geocode-decisions.json'), 'utf8'));
const candidates = JSON.parse(readFileSync(join(root, '.cache/geocode-candidates.json'), 'utf8'));

let applied = 0;
for (const [id, d] of Object.entries(decisions)) {
  const place = data.places.find((p) => p.id === id);
  if (!place) throw new Error(`No existe el sitio ${id}`);
  const c = (candidates[id] ?? []).find((x) => x.osm === d.osm);
  if (!c) throw new Error(`${id}: el candidato ${d.osm} no está en .cache/geocode-candidates.json`);
  place.lat = Math.round(c.lat * 1e6) / 1e6;
  place.lng = Math.round(c.lng * 1e6) / 1e6;
  place.geo = { source: 'nominatim', osm_id: d.osm, checked: true, ...(d.note ? { note: d.note } : {}) };
  applied++;
}
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`${applied} sitios con coordenadas aplicadas`);
