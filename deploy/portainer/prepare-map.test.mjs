import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const region = fileURLToPath(new URL('../../scripts/trip-region.geojson', import.meta.url));
const context = fileURLToPath(new URL('../../scripts/map-context.geojson', import.meta.url));
import test from 'node:test';
import { prepareMap, resolveBuild, validArchive } from './prepare-map.mjs';

const archive = () => {
  const bytes = Buffer.alloc(127);
  bytes.write('PMTiles');
  bytes[7] = 3;
  return bytes;
};
const noFetch = () => { throw new Error('No debe acceder a la red'); };
const output = args => args[0] === 'merge' ? args[3] : args[2];

test('elige el build más reciente aunque los metadatos estén desordenados', async () => {
  assert.equal(await resolveBuild('', async () => ({ ok: true, json: async () => [
    { key: '20261119.pmtiles' }, { key: 'otra-cosa' }, { key: '20261118.pmtiles' },
  ] })), '20261119');
  assert.equal(await resolveBuild('20261118', noFetch), '20261118');
  await assert.rejects(resolveBuild('../archivo', noFetch), /AAAAMMDD/);
  await assert.rejects(resolveBuild('', async () => ({ ok: false, status: 503 })), /503/);
  await assert.rejects(resolveBuild('', async () => ({ ok: true, json: async () => [] })), /builds/);
});

test('publica el mapa tras extracción y lo reutiliza sin red en el siguiente arranque', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'china-map-test-'));
  try {
    let calls = 0;
    await prepareMap({ directory, region, context, build: '20261119', fetchImpl: noFetch, run: async args => {
      calls++;
      if (calls === 1) {
        assert.equal(args[1], 'https://build.protomaps.com/20261119.pmtiles');
        assert.ok(args.includes('--maxzoom=10'));
        assert.ok(args.includes('--region=' + context));
      } else if (calls === 2) {
        assert.ok(args.includes('--minzoom=11'));
        assert.ok(args.includes('--maxzoom=14'));
        assert.ok(args.includes('--region=' + region));
      } else assert.equal(args[0], 'merge');
      await writeFile(output(args), archive());
    } });
    assert.equal(calls, 3);
    assert.ok(await validArchive(join(directory, 'trip.pmtiles')));
    await prepareMap({ directory, region, context, fetchImpl: noFetch, run: noFetch });
    assert.deepEqual(await readFile(join(directory, 'trip.pmtiles')), archive());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('un fallo de extracción no publica un mapa parcial y permite reintentar', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'china-map-test-'));
  try {
    await assert.rejects(prepareMap({ directory, region, context, build: '20261119', run: async args => {
      await writeFile(output(args), 'descarga incompleta');
      throw new Error('conexión interrumpida');
    } }), /interrumpida/);
    assert.equal(await validArchive(join(directory, 'trip.pmtiles')), false);
    await assert.rejects(readFile(join(directory, 'trip.partial.pmtiles')), { code: 'ENOENT' });
    await assert.rejects(prepareMap({ directory, region, context, build: '20261119', run: async args => {
      await writeFile(output(args), '<html>Error del servidor</html>');
    } }), /PMTiles v3/);
    await prepareMap({ directory, region, context, build: '20261119', run: async args => writeFile(output(args), archive()) });
    assert.ok(await validArchive(join(directory, 'trip.pmtiles')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('migra el mapa antiguo sin metadatos y regenera al cambiar la cobertura', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'china-map-migration-'));
  const localRegion = join(directory, 'region.geojson');
  try {
    await writeFile(localRegion, '{"coverage":1}');
    const old = archive(); old[100] = 1;
    await writeFile(join(directory, 'trip.pmtiles'), old);
    const options = { directory, region: localRegion, context, build: '20261119', fetchImpl: noFetch };
    await assert.rejects(prepareMap({ ...options, run: async () => { throw new Error('sin red'); } }), /sin red/);
    assert.deepEqual(await readFile(join(directory, 'trip.pmtiles')), old);
    let calls = 0;
    const run = async args => { calls++; await writeFile(output(args), archive()); };
    await prepareMap({ ...options, run });
    assert.equal(calls, 3);
    await prepareMap({ ...options, run });
    assert.equal(calls, 3);
    await writeFile(localRegion, '{"coverage":2}');
    await prepareMap({ ...options, run });
    assert.equal(calls, 6);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
