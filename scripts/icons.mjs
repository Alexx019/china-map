#!/usr/bin/env node
// Iconos de la PWA a partir de un SVG: grafito, una ruta blanca y el punto rojo laca de la maqueta.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/icons');
mkdirSync(out, { recursive: true });

// safe = margen interior (los iconos «maskable» se recortan en círculo en Android)
const svg = (safe, radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#111318"/>
  <g transform="translate(${safe} ${safe}) scale(${(512 - 2 * safe) / 512})">
    <path d="M150 380 C 150 300, 250 330, 262 250 C 274 170, 360 190, 362 132" fill="none" stroke="#F2F3F5" stroke-width="30" stroke-linecap="round" stroke-dasharray="1 58"/>
    <circle cx="150" cy="380" r="34" fill="#F2F3F5"/>
    <circle cx="362" cy="132" r="62" fill="#D23A2A"/>
    <circle cx="362" cy="132" r="22" fill="#111318"/>
  </g>
</svg>`;

const jobs = [
  ['icon-192.png', 192, svg(40, 96)],
  ['icon-512.png', 512, svg(40, 96)],
  ['maskable-512.png', 512, svg(96, 0)],
  ['apple-touch-icon.png', 180, svg(40, 0)],
  ['favicon-32.png', 32, svg(24, 96)],
];
for (const [name, size, s] of jobs) await sharp(Buffer.from(s)).resize(size, size).png().toFile(join(out, name));
writeFileSync(join(out, 'icon.svg'), svg(40, 96));
console.log('Iconos en public/icons/');
