import { Marker } from 'maplibre-gl';
import { useRef, useState } from 'react';
import { flyTo, getMap } from '../../map/controller';
import { useStore } from '../../state/store';
import { Icon } from '../../ui/icons';
import css from './MapButtons.module.css';

const THEME_LABEL = { auto: 'Modo: automático', light: 'Modo: claro', dark: 'Modo: oscuro' } as const;

/** Botones flotantes del mapa: modo claro/oscuro y mi ubicación. */
export function MapButtons() {
  const theme = useStore((s) => s.theme);
  const cycleTheme = useStore((s) => s.cycleTheme);
  const me = useRef<Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) return setError('Este navegador no da la ubicación');
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const map = getMap();
        if (!map) return;
        if (!me.current) {
          const el = document.createElement('div');
          el.className = 'me';
          el.setAttribute('aria-label', 'Mi ubicación');
          me.current = new Marker({ element: el });
        }
        me.current.setLngLat([coords.longitude, coords.latitude]).addTo(map);
        flyTo(coords.longitude, coords.latitude, 15);
      },
      (e) => {
        setLocating(false);
        setError(e.code === e.PERMISSION_DENIED ? 'Sin permiso de ubicación' : 'No se pudo obtener la ubicación');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  return (
    <>
      {error && (
        <p className={css.toast} role="status" onClick={() => setError(null)}>
          {error}
        </p>
      )}
      <button type="button" className={css.fab} aria-label={THEME_LABEL[theme]} title={THEME_LABEL[theme]} onClick={cycleTheme}>
        <Icon name={theme === 'auto' ? 'sunMoon' : theme === 'light' ? 'sun' : 'moon'} size={22} stroke={1.9} />
      </button>
      <button type="button" className={css.fab} aria-label="Centrar en mi ubicación" aria-busy={locating} onClick={locate}>
        <Icon name="locate" size={22} stroke={1.9} className={locating ? css.pulse : undefined} />
      </button>
    </>
  );
}
