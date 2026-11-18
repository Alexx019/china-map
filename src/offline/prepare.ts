import type { TripData } from '../data/types';
import { photoUrl, thumbUrl } from '../data/photos';
import { CACHE, DATA_URLS, MAP_URL } from './caches';

export interface OfflineStatus {
  /** El mapa entero está guardado (lo que más pesa y lo que define «listo»). */
  map: boolean;
  /** Fotos y miniaturas guardadas / total. */
  photos: number;
  photosTotal: number;
}


function photoJobs(data: TripData) {
  const all = data.places.flatMap((p) => p.photos);
  return [
    ...all.map((p) => ({ cache: CACHE.thumbs, url: thumbUrl(p, 's') })),
    ...all.map((p) => ({ cache: CACHE.thumbs, url: thumbUrl(p, 'm') })),
    ...all.map((p) => ({ cache: CACHE.photos, url: photoUrl(p) })),
  ];
}

export async function offlineStatus(data: TripData): Promise<OfflineStatus> {
  if (!('caches' in window)) return { map: false, photos: 0, photosTotal: 0 };
  const jobs = photoJobs(data);
  const [mapCache, thumbs, photos] = await Promise.all([caches.open(CACHE.map), caches.open(CACHE.thumbs), caches.open(CACHE.photos)]);
  const have = new Set([...(await thumbs.keys()), ...(await photos.keys())].map((r) => new URL(r.url).pathname));
  return {
    map: Boolean(await mapCache.match(MAP_URL)),
    photos: jobs.filter((j) => have.has(j.url)).length,
    photosTotal: jobs.length,
  };
}

export interface Progress {
  done: number;
  total: number;
  label: string;
}

/**
 * Descarga y guarda todo lo necesario para usar la web sin conexión: datos, fotos (y miniaturas) y
 * el mapa entero. Lo ya guardado no se vuelve a bajar, así que se puede repetir si se corta.
 */
export async function prepareOffline(data: TripData, onProgress: (p: Progress) => void, signal?: AbortSignal) {
  // Que el navegador no borre la caché si el móvil va justo de espacio
  await navigator.storage?.persist?.().catch(() => false);

  // 1. Datos
  const dataCache = await caches.open(CACHE.data);
  await Promise.all(DATA_URLS.map((u) => dataCache.add(u)));

  // 2. Fotos, de 6 en 6
  const jobs = photoJobs(data);
  const opened = { [CACHE.thumbs]: await caches.open(CACHE.thumbs), [CACHE.photos]: await caches.open(CACHE.photos) };
  let done = 0;
  const total = jobs.length + 1;
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      signal?.throwIfAborted();
      const c = opened[job.cache];
      if (!(await c.match(job.url))) await c.add(job.url);
      onProgress({ done: ++done, total, label: 'Fotos' });
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  // 3. Mapa: el fichero entero, con progreso por bytes
  const mapCache = await caches.open(CACHE.map);
  if (!(await mapCache.match(MAP_URL))) {
    const res = await fetch(MAP_URL, { signal, cache: 'no-store' });
    if (!res.ok || !res.body) throw new Error(`No se pudo descargar el mapa (${res.status})`);
    const size = Number(res.headers.get('content-length')) || 0;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      chunks.push(value);
      got += value.length;
      if (size) onProgress({ done: done + got / size, total, label: `Mapa · ${Math.round(got / 1e6)} de ${Math.round(size / 1e6)} MB` });
    }
    const blob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' });
    await mapCache.put(
      MAP_URL,
      new Response(blob, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size) } }),
    );
  }
  onProgress({ done: total, total, label: 'Listo' });
}
