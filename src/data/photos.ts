/** Manifiesto que genera scripts/thumbs.mjs: tamaño y colores (arriba, centro, abajo) de cada foto. */
export interface PhotoMeta {
  w: number;
  h: number;
  colors: [string, string, string];
}
export type PhotoManifest = Record<string, PhotoMeta>;

export async function loadPhotoManifest(): Promise<PhotoManifest> {
  try {
    const res = await fetch('/data/thumbs/photos.json');
    return res.ok ? ((await res.json()) as PhotoManifest) : {};
  } catch {
    return {};
  }
}

const file = (photo: string) => photo.split('/').pop() ?? photo;

/** `s` = 160 px (marcadores), `m` = 480 px (tarjetas, mood board). */
export const thumbUrl = (photo: string, size: 's' | 'm') => `/data/thumbs/${size}/${file(photo)}`;
export const photoUrl = (photo: string) => `/data/${photo}`;

/** Fondo con los colores de la foto mientras carga: sin huecos blancos ni parpadeos. */
export function photoBackground(meta: PhotoMeta | undefined): string {
  if (!meta) return 'var(--surface-2)';
  const [a, b, c] = meta.colors;
  return `linear-gradient(180deg, ${a} 0%, ${b} 55%, ${c} 100%)`;
}
