import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { prepareMap, resolveBuild, validArchive } from './prepare-map.mjs';

const archive = () => {
  const bytes = Buffer.alloc(127);
  bytes.write('PMTiles');
  bytes[7] = 3;
  return bytes;
};
const noFetch = () => { throw new Error('No debe acceder a la red'); };

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
    await prepareMap({ directory, build: '20261119', fetchImpl: noFetch, run: async args => {
      calls++;
      assert.equal(args[1], 'https://build.protomaps.com/20261119.pmtiles');
      assert.ok(args.includes('--maxzoom=14'));
      assert.ok(args.includes('--region=/app/trip-region.geojson'));
      await writeFile(args[2], archive());
    } });
    assert.equal(calls, 1);
    assert.ok(await validArchive(join(directory, 'trip.pmtiles')));
    await prepareMap({ directory, fetchImpl: noFetch, run: noFetch });
    assert.deepEqual(await readFile(join(directory, 'trip.pmtiles')), archive());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('un fallo de extracción no publica un mapa parcial y permite reintentar', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'china-map-test-'));
  try {
    await assert.rejects(prepareMap({ directory, build: '20261119', run: async args => {
      await writeFile(args[2], 'descarga incompleta');
      throw new Error('conexión interrumpida');
    } }), /interrumpida/);
    assert.equal(await validArchive(join(directory, 'trip.pmtiles')), false);
    await assert.rejects(readFile(join(directory, 'trip.partial.pmtiles')), { code: 'ENOENT' });
    await assert.rejects(prepareMap({ directory, build: '20261119', run: async args => {
      await writeFile(args[2], '<html>Error del servidor</html>');
    } }), /PMTiles v3/);
    await prepareMap({ directory, build: '20261119', run: async args => writeFile(args[2], archive()) });
    assert.ok(await validArchive(join(directory, 'trip.pmtiles')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
