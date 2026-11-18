#!/usr/bin/env node
// Fusiona research/*.json (lo que traen los agentes de investigación) en public/data/places.json.
// Solo copia `practical` y `tips`; las `notes` (contradicciones, posibles errores) se quedan en research/
// para revisarlas a mano. Después hay que pasar `npm run check-data`.
// Uso: node scripts/merge-research.mjs [research/fichero.json …]   (sin argumentos: todos)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'public/data/places.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(root, 'research')).filter((f) => f.endsWith('.json')).map((f) => join('research', f));

let merged = 0;
for (const f of files) {
  const r = JSON.parse(readFileSync(join(root, f), 'utf8'));
  for (const [id, entry] of Object.entries(r.places)) {
    const place = data.places.find((p) => p.id === id);
    if (!place) throw new Error(`${f}: no existe el sitio ${id}`);
    if (entry.practical) place.practical = entry.practical;
    if (Array.isArray(entry.tips)) place.tips = entry.tips;
    merged++;
  }
  console.log(`${f}: ${Object.keys(r.places).length} sitios`);
}
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`${merged} sitios con investigación fusionada`);
