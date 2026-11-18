import { useState } from 'react';
import type { Place } from '../../data/types';
import { useShared } from '../../state/shared';
import { useStore } from '../../state/store';
import { Icon } from '../../ui/icons';
import { useWithMe } from '../shared/NameDialog';
import sh from '../shared/Shared.module.css';
import css from './AddToRoute.module.css';
import { useCreateRoute } from './RoutesView';

/** Botón de la ficha: añadir el sitio a una ruta del grupo (o empezar una nueva con él). */
export function AddToRouteButton({ place, className }: { place: Place; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Icon name="route" size={17} />
        Añadir a ruta
      </button>
      {open && <AddToRouteDialog place={place} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddToRouteDialog({ place, onClose }: { place: Place; onClose: () => void }) {
  const routes = useShared((s) => s.routes);
  const saveRoute = useShared((s) => s.saveRoute);
  const openRoute = useStore((s) => s.openRoute);
  const create = useCreateRoute();
  const withMe = useWithMe();
  const list = Object.values(routes)
    .filter((r) => !r.deleted)
    .sort((a, b) => b.at - a.at);

  const add = (id: string) =>
    withMe(() => {
      const r = useShared.getState().routes[id];
      if (!r.stops.includes(place.id)) saveRoute({ id, name: r.name, stops: [...r.stops, place.id] });
      onClose();
      openRoute(id);
    });

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.dialog} role="dialog" aria-modal="true" aria-labelledby="add-route" onClick={(e) => e.stopPropagation()}>
        <h2 id="add-route" className={sh.dialogTitle}>
          Añadir a una ruta
        </h2>
        {list.length > 0 && (
          <ul className={css.list}>
            {list.map((r) => {
              const has = r.stops.includes(place.id);
              return (
                <li key={r.id}>
                  <button type="button" className={css.item} onClick={() => add(r.id)}>
                    <span className={css.name}>{r.name}</span>
                    <span className={css.meta}>{has ? 'Ya está' : `${r.stops.length} paradas`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className={sh.dialogActions}>
          <button type="button" className={sh.ghost} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={sh.primary}
            onClick={() => {
              onClose();
              create(place.id);
            }}
          >
            Nueva ruta
          </button>
        </div>
      </div>
    </div>
  );
}
