import { useEffect } from 'react';
import { useStore, type Route } from './store';

// Toda la navegación vive en el hash, así un enlace se puede pasar por el chat y el botón «atrás»
// del móvil cierra lo último que se abrió:
//   #/zona/<zona>
//   #/sitio/<id>                    sitio elegido (vista previa en la hoja)
//   #/ficha/<id>[/foto/<n>]         ficha completa [y visor]
//   #/fotos/<zona>[/region][/foto/<n>]   mood board [de toda la región] [y visor]

const EMPTY: Route = { selectedId: null, zoneId: null, ficha: false, mood: null, viewer: null };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const fotoAt = parts.indexOf('foto');
  const viewer = fotoAt >= 0 && /^\d+$/.test(parts[fotoAt + 1] ?? '') ? Number(parts[fotoAt + 1]) - 1 : null;
  const [kind, id] = parts;
  switch (kind) {
    case 'zona':
      return id ? { ...EMPTY, zoneId: id } : EMPTY;
    case 'sitio':
      return id ? { ...EMPTY, selectedId: id } : EMPTY;
    case 'ficha':
      return id ? { ...EMPTY, selectedId: id, ficha: true, viewer } : EMPTY;
    case 'fotos':
      return id ? { ...EMPTY, zoneId: id, mood: { zone: id, scope: parts[2] === 'region' ? 'region' : 'zona' }, viewer } : EMPTY;
    default:
      return EMPTY;
  }
}

export function hashFor(r: Route): string {
  const foto = r.viewer != null ? `/foto/${r.viewer + 1}` : '';
  const e = encodeURIComponent;
  if (r.mood) return `#/fotos/${e(r.mood.zone)}${r.mood.scope === 'region' ? '/region' : ''}${foto}`;
  if (r.selectedId && r.ficha) return `#/ficha/${e(r.selectedId)}${foto}`;
  if (r.selectedId) return `#/sitio/${e(r.selectedId)}`;
  if (r.zoneId) return `#/zona/${e(r.zoneId)}`;
  return '';
}

/** Profundidad: cuanto más «dentro», más alta. Abrir algo más profundo apila una entrada del historial. */
const depth = (r: Route) => (r.zoneId ? 1 : 0) + (r.selectedId ? 2 : 0) + (r.ficha ? 3 : 0) + (r.mood ? 3 : 0) + (r.viewer != null ? 4 : 0);

const routeOf = (s: Route): Route => ({
  selectedId: s.selectedId,
  zoneId: s.zoneId,
  ficha: s.ficha,
  mood: s.mood,
  viewer: s.viewer,
});

export function useHashNav() {
  const ready = useStore((s) => s.data !== null);

  useEffect(() => {
    if (!ready) return;
    let applying = false;

    const apply = () => {
      const st = useStore.getState();
      const r = parseHash(window.location.hash);
      // Ignorar ids que no existen (enlace viejo o mal copiado)
      const placeOk = !r.selectedId || st.data?.places.some((p) => p.id === r.selectedId);
      const zoneOk = !r.zoneId || st.data?.zones.some((z) => z.id === r.zoneId);
      applying = true;
      st.applyRoute(placeOk && zoneOk ? r : EMPTY);
      if (r.selectedId && st.sheet === 'peek') st.setSheet('half');
      applying = false;
    };
    apply();

    const unsub = useStore.subscribe((s, prev) => {
      if (applying) return;
      const next = routeOf(s);
      const before = routeOf(prev);
      const hash = hashFor(next);
      if (hash === hashFor(before) || hash === (window.location.hash || '')) return;
      const url = hash || window.location.pathname + window.location.search;
      if (depth(next) > depth(before)) history.pushState(null, '', url);
      else history.replaceState(null, '', url);
    });

    window.addEventListener('popstate', apply);
    return () => {
      unsub();
      window.removeEventListener('popstate', apply);
    };
  }, [ready]);
}
