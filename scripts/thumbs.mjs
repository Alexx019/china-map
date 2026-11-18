#!/usr/bin/env node
// Genera miniaturas de las fotos y un manifiesto con tamaño y colores de cada una.
// - public/data/thumbs/s/<foto>.jpg  (160 px de lado corto: marcadores del mapa)
// - public/data/thumbs/m/<foto>.jpg  (480 px de ancho: tarjetas y mood board)
// - public/data/thumbs/photos.json   ({ "photos/x.jpg": { w, h, colors: [arriba, centro, abajo] } })
// Los colores se usan de fondo mientras carga la foto, para que no haya saltos ni parpadeos.
import { readdirSync, mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public/data/photos');
const out = join(root, 'public/data/thumbs');
for (const d of ['s', 'm']) mkdirSync(join(out, d), { recursive: true });

const hex = (b, i) => '#' + [0, 1, 2].map((k) => b[i * 3 + k].toString(16).padStart(2, '0')).join('');
const manifest = {};
let made = 0;
for (const f of readdirSync(src).filter((f) => /\.jpe?g$/i.test(f)).sort()) {
  const input = join(src, f);
  const img = sharp(input);
  const { width, height } = await img.metadata();
  const { data } = await img.clone().resize(1, 3, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  manifest[`photos/${f}`] = { w: width, h: height, colors: [hex(data, 0), hex(data, 1), hex(data, 2)] };
  const mtime = statSync(input).mtimeMs;
  for (const [dir, opts] of [['s', { width: 160, height: 160, fit: 'cover' }], ['m', { width: 480, withoutEnlargement: true }]]) {
    const dest = join(out, dir, f);
    if (existsSync(dest) && statSync(dest).mtimeMs >= mtime) continue;
    await sharp(input).resize(opts).jpeg({ quality: 78, mozjpeg: true }).toFile(dest);
    made++;
  }
}
writeFileSync(join(out, 'photos.json'), JSON.stringify(manifest));
console.log(`${Object.keys(manifest).length} fotos · ${made} miniaturas nuevas → public/data/thumbs/`);
