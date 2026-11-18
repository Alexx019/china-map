import { useEffect, useSyncExternalStore } from 'react';
import { useStore } from './store';

const query = '(prefers-color-scheme: dark)';
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const systemDark = () => window.matchMedia(query).matches;

/** true si hay que pintar en oscuro: lo que diga el móvil, salvo que se haya elegido a mano. */
export function useIsDark(): boolean {
  const pref = useStore((s) => s.theme);
  const sys = useSyncExternalStore(subscribe, systemDark);
  return pref === 'dark' || (pref === 'auto' && sys);
}

/** Refleja la elección en <html data-theme> (lo leen los tokens CSS) y en la barra del navegador. */
export function useApplyTheme() {
  const pref = useStore((s) => s.theme);
  const dark = useIsDark();
  useEffect(() => {
    const html = document.documentElement;
    if (pref === 'auto') html.removeAttribute('data-theme');
    else html.dataset.theme = pref;
    for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.remove();
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = dark ? '#14181F' : '#ECEEF1';
    document.head.appendChild(meta);
  }, [pref, dark]);
}
