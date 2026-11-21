import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import ipaddr from 'ipaddr.js';
import sharp from 'sharp';

const MAX = 12 * 1024 * 1024;
export function publicAddress(address) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6' && ip.isIPv4MappedAddress()) ip = ip.toIPv4Address();
    return ip.range() === 'unicast';
  } catch { return false; }
}
export async function downloadImage(input, redirects = 0) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Las imágenes remotas deben usar HTTPS público en el puerto 443');
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('No se permiten direcciones privadas, locales o reservadas');
  // Fijar la IP validada durante la conexión evita DNS rebinding; TLS mantiene el hostname original.
  const response = await new Promise((resolve, reject) => {
    const request = https.get(url, { family: addresses[0].family,
      lookup: (_host, opts, cb) => opts.all ? cb(null, [addresses[0]]) : cb(null, addresses[0].address, addresses[0].family),
      headers: { 'User-Agent': 'china-map-mcp/1.0', Accept: 'image/*' } }, resolve);
    request.setTimeout(15000, () => request.destroy(new Error('Tiempo de descarga agotado')));
    const deadline = setTimeout(() => request.destroy(new Error('La descarga superó 30 segundos')), 30000);
    request.on('response', response => response.on('close', () => clearTimeout(deadline)));
    request.on('error', () => clearTimeout(deadline));
    request.on('error', reject);
  });
  if ([301,302,303,307,308].includes(response.statusCode)) {
    response.destroy();
    if (redirects >= 3 || !response.headers.location) throw new Error('Demasiadas redirecciones');
    return downloadImage(new URL(response.headers.location, url), redirects + 1);
  }
  if (response.statusCode !== 200 || !String(response.headers['content-type']).startsWith('image/')) { response.destroy(); throw new Error('La URL no devolvió una imagen'); }
  const chunks = []; let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > MAX) { response.destroy(); throw new Error('Foto demasiado grande (máximo 12 MB)'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function saveImage({ url, base64 }, directory) {
  if (Boolean(url) === Boolean(base64)) throw new Error('Indicar url o base64, exclusivamente');
  let input;
  if (url) input = await downloadImage(url);
  else {
    if (base64.length > Math.ceil(MAX / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Base64 no válido o demasiado grande');
    input = Buffer.from(base64, 'base64');
  }
  if (!input.length || input.length > MAX) throw new Error('Foto vacía o demasiado grande');
  const raster = input.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))
    || input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    || (input.subarray(0,4).toString() === 'RIFF' && input.subarray(8,12).toString() === 'WEBP')
    || (input.subarray(4,8).toString() === 'ftyp' && ['avif','avis','heic','heix','hevc','mif1'].includes(input.subarray(8,12).toString()));
  if (!raster) throw new Error('Formato no admitido: usar una imagen raster JPEG, PNG, WebP o AVIF');
  const image = sharp(input, { limitInputPixels: 40_000_000, animated: false });
  const meta = await image.metadata();
  if (!['jpeg','png','webp','avif','heif'].includes(meta.format)) throw new Error('Formato no admitido: usar JPEG, PNG, WebP o AVIF');
  const normalized = await image.rotate().resize({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  const full = sharp(normalized);
  const { width: w, height: h } = await full.metadata();
  const colors = await full.clone().resize(1, 3, { fit: 'fill' }).raw().toBuffer();
  const filename = `mcp-${randomUUID()}.jpg`;
  for (const sub of ['photos', 'thumbs/s', 'thumbs/m']) await mkdir(join(directory, sub), { recursive: true });
  await Promise.all([
    writeFile(join(directory, 'photos', filename), normalized),
    full.clone().resize(160, 160, { fit: 'cover' }).jpeg({ quality: 78 }).toFile(join(directory, 'thumbs/s', filename)),
    full.clone().resize(480, null, { withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(join(directory, 'thumbs/m', filename)),
  ]);
  return { path: `photos/${filename}`, meta: { w, h, colors: [0,1,2].map(i => '#' + colors.subarray(i * 3, i * 3 + 3).toString('hex')) } };
}
