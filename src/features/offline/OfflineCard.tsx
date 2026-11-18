import { useEffect, useState, useSyncExternalStore } from 'react';
import { offlineStatus, prepareOffline, type OfflineStatus, type Progress } from '../../offline/prepare';
import { useStore } from '../../state/store';
import { Icon } from '../../ui/icons';
import css from './Offline.module.css';

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine);

/** Aviso discreto bajo el buscador cuando no hay conexión. */
export function OfflinePill() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className={css.pill} role="status">
      <span className={css.pillDot} />
      Sin conexión: usando lo guardado en el móvil
    </div>
  );
}

/** «Preparar sin conexión»: guarda fotos y mapa en el móvil. Antes del viaje, con wifi. */
export function OfflineCard() {
  const data = useStore((s) => s.data);
  const online = useOnline();
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) offlineStatus(data).then(setStatus, () => setStatus(null));
  }, [data]);

  if (!data || !('caches' in window) || !('serviceWorker' in navigator)) return null;
  const ready = status?.map && status.photos === status.photosTotal;

  const run = async () => {
    setError(null);
    setProgress({ done: 0, total: 1, label: 'Empezando' });
    try {
      await prepareOffline(data, setProgress);
      setStatus(await offlineStatus(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar. Vuelve a intentarlo: lo ya guardado no se repite.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <section className={css.card} aria-labelledby="offline-title">
      <div className={css.head}>
        <span className={css.icon} data-ready={ready || undefined}>
          <Icon name={ready ? 'check' : 'map'} size={18} stroke={2.2} />
        </span>
        <div className={css.text}>
          <h2 id="offline-title" className={css.title}>
            {ready ? 'Listo para usar sin conexión' : 'Usar sin conexión'}
          </h2>
          <p className={css.sub}>
            {ready
              ? 'Mapa, fichas y fotos guardados en este móvil.'
              : 'Guarda el mapa y las fotos en el móvil (unos 65 MB). Mejor con wifi, antes de salir.'}
          </p>
        </div>
      </div>

      {progress ? (
        <div className={css.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress.done / progress.total) * 100)}>
          <div className={css.bar}>
            <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <span className={css.progressLabel}>{progress.label}</span>
        </div>
      ) : (
        !ready && (
          <button type="button" className={css.button} onClick={run} disabled={!online}>
            {online ? 'Guardar en el móvil' : 'Necesita conexión'}
          </button>
        )
      )}
      {error && <p className={css.error}>{error}</p>}
    </section>
  );
}
