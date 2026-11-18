import { useEffect } from 'react';
import { useStore } from './store';

// La navegación vive en el hash: #/sitio/<id> o #/zona/<id>.
// Así un enlace se puede pasar por el chat y el botón «atrás» del móvil cierra la ficha.

function parse(hash: string): { place?: string; zone?: string } {
  const [, kind, id] = hash.replace(/^#/, '').split('/');
  if (kind === 'sitio' && id) return { place: decodeURIComponent(id) };
  if (kind === 'zona' && id) return { zone: decodeURIComponent(id) };
  return {};
}

function hashFor(selectedId: string | null, zoneId: string | null) {
  if (selectedId) return `#/sitio/${encodeURIComponent(selectedId)}`;
  if (zoneId) return `#/zona/${encodeURIComponent(zoneId)}`;
  return '';
}

export function useHashNav() {
  const ready = useStore((s) => s.data !== null);

  useEffect(() => {
    if (!ready) return;
    let applying = false;

    const apply = () => {
      const { place, zone } = parse(window.location.hash);
      const st = useStore.getState();
      const known = (id?: string) => id && st.data?.places.some((p) => p.id === id);
      const knownZone = (id?: string) => id && st.data?.zones.some((z) => z.id === id);
      applying = true;
      if (place && known(place)) {
        st.select(place);
        if (st.sheet === 'peek') st.setSheet('half');
      } else {
        if (st.selectedId) st.select(null);
        st.setZone(zone && knownZone(zone) ? zone : null);
      }
      applying = false;
    };
    apply();

    const unsub = useStore.subscribe((s, prev) => {
      if (applying || (s.selectedId === prev.selectedId && s.zoneId === prev.zoneId)) return;
      const next = hashFor(s.selectedId, s.zoneId);
      if (next === (window.location.hash || '')) return;
      // Abrir algo apila una entrada (para que «atrás» lo cierre); cerrar vuelve sin apilar
      const opening = (s.selectedId && !prev.selectedId) || (s.zoneId && !prev.zoneId && !s.selectedId);
      const url = next || window.location.pathname + window.location.search;
      if (opening) history.pushState(null, '', url);
      else history.replaceState(null, '', url);
    });

    window.addEventListener('popstate', apply);
    return () => {
      unsub();
      window.removeEventListener('popstate', apply);
    };
  }, [ready]);
}
