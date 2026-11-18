import type { TripData } from './types';

/** Los datos se leen en tiempo de ejecución: añadir un sitio no obliga a recompilar la app. */
export async function loadTripData(): Promise<TripData> {
  const res = await fetch('/data/places.json');
  if (!res.ok) throw new Error(`No se pudo cargar places.json (${res.status})`);
  return (await res.json()) as TripData;
}
