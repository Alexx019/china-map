import type { Place, Zone } from './types';

/** Minúsculas y sin tildes, para que «libreria» encuentre «Librería». */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();

/** Busca por nombre en español, nombre en chino o nombre de la zona. */
export function searchPlaces(places: Place[], zones: Zone[], query: string): Place[] {
  const q = normalize(query);
  if (!q) return [];
  const zoneName = new Map(zones.map((z) => [z.id, normalize(`${z.name} ${z.name_zh}`)]));
  const scored = places
    .map((p) => {
      const name = normalize(p.name);
      const zh = p.name_zh;
      let score = 0;
      if (name.startsWith(q)) score = 3;
      else if (name.includes(q) || zh.includes(query.trim())) score = 2;
      else if (zoneName.get(p.zone)?.includes(q)) score = 1;
      return { p, score };
    })
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, 'es'));
  return scored.map((x) => x.p);
}
