// Se ejecuta una vez por despliegue; conserva el mapa válido del volumen.
import { spawn } from 'node:child_process';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function validArchive(path) {
  let file;
  try {
    file = await open(path, 'r');
    const header = Buffer.alloc(8);
    const { bytesRead } = await file.read(header, 0, 8, 0);
    return bytesRead === 8 && header.subarray(0, 7).toString() === 'PMTiles'
      && header[7] === 3 && (await file.stat()).size >= 127;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  } finally {
    await file?.close();
  }
}

export async function resolveBuild(requested, fetchImpl = fetch) {
  if (requested) {
    if (!/^\d{8}$/.test(requested)) throw new Error('MAP_BUILD debe tener formato AAAAMMDD');
    return requested;
  }
  const response = await fetchImpl('https://build-metadata.protomaps.dev/builds.json', {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Metadatos Protomaps: HTTP ${response.status}`);
  const builds = await response.json();
  const dates = Array.isArray(builds)
    ? builds.flatMap(b => typeof b.key === 'string' && /^\d{8}\.pmtiles$/.test(b.key) ? [b.key.slice(0, 8)] : [])
    : [];
  dates.sort();
  if (!dates.length) throw new Error('Protomaps no devolvió builds con formato conocido');
  return dates.at(-1);
}

function extract(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('pmtiles', args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`pmtiles: ${signal ?? code}`)));
  });
}

export async function prepareMap({ directory = '/maps', build = process.env.MAP_BUILD,
  fetchImpl = fetch, run = extract, region = '/app/trip-region.geojson' } = {}) {
  await mkdir(directory, { recursive: true });
  const destination = join(directory, 'trip.pmtiles');
  if (await validArchive(destination)) {
    console.log('Mapa ya preparado; se conserva el archivo del volumen.');
    return;
  }
  const date = await resolveBuild(build, fetchImpl);
  const temporary = join(directory, 'trip.partial.pmtiles');
  await rm(temporary, { force: true });
  try {
    console.log(`Extrayendo regiones del viaje del build ${date} (solo el primer arranque)...`);
    await run(['extract', `https://build.protomaps.com/${date}.pmtiles`, temporary,
      `--region=${region}`, '--maxzoom=14']);
    if (!(await validArchive(temporary))) throw new Error('La extracción no produjo un archivo PMTiles v3 válido');
    await rename(temporary, destination);
    console.log('Mapa preparado.');
  } finally {
    await rm(temporary, { force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareMap().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
