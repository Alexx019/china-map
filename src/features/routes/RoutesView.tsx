import { Reorder, useDragControls } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { amapLegUrl, amapUrl } from '../../data/amap';
import { photoBackground, thumbUrl } from '../../data/photos';
import { searchPlaces } from '../../data/search';
import type { Place } from '../../data/types';
import { newRouteId, useShared } from '../../state/shared';
import { useStore } from '../../state/store';
import { Icon } from '../../ui/icons';
import { PlaceRow } from '../explore/PlaceRow';
import ex from '../explore/Explore.module.css';
import { useWithMe } from '../shared/NameDialog';
import css from './Routes.module.css';

// Rutas que hacéis vosotros: elegir sitios, ordenarlos, guardarlas con un nombre y abrir cada tramo en Amap.
// La app nunca propone ni genera rutas.

function useRoute() {
  const routeId = useStore((s) => s.routeId);
  const route = useShared((s) => (routeId ? s.routes[routeId] : undefined));
  return route && !route.deleted ? route : undefined;
}

/** Crea una ruta (opcionalmente con un primer sitio) y la abre. */
export function useCreateRoute() {
  const saveRoute = useShared((s) => s.saveRoute);
  const openRoute = useStore((s) => s.openRoute);
  const setAdding = useStore((s) => s.setAddingStops);
  const withMe = useWithMe();
  return (firstStop?: string) =>
    withMe(() => {
      const id = newRouteId();
      const n = Object.values(useShared.getState().routes).filter((r) => !r.deleted).length + 1;
      saveRoute({ id, name: `Ruta ${n}`, stops: firstStop ? [firstStop] : [] });
      openRoute(id);
      setAdding(!firstStop);
    });
}

export function RoutesHeader() {
  const route = useRoute();
  const routes = useShared((s) => s.routes);
  const openRoute = useStore((s) => s.openRoute);
  const create = useCreateRoute();
  const saveRoute = useShared((s) => s.saveRoute);
  const withMe = useWithMe();
  const [name, setName] = useState(route?.name ?? '');
  useEffect(() => setName(route?.name ?? ''), [route?.id, route?.name]);

  if (!route) {
    const n = Object.values(routes).filter((r) => !r.deleted).length;
    return (
      <div className={ex.head}>
        <div className={css.headRow}>
          <div>
            <h1 className={ex.title}>Rutas</h1>
            <p className={ex.sub}>{n === 0 ? 'Ninguna todavía' : `${n} ${n === 1 ? 'ruta' : 'rutas'} del grupo`}</p>
          </div>
          <button type="button" className={css.newBtn} onClick={() => create()}>
            <Icon name="plus" size={18} stroke={2.4} />
            Nueva
          </button>
        </div>
      </div>
    );
  }

  const rename = () => {
    const v = name.trim();
    if (v && v !== route.name) withMe(() => saveRoute({ id: route.id, name: v, stops: route.stops }));
    else setName(route.name);
  };

  return (
    <div className={ex.head}>
      <button type="button" className={ex.back} onClick={() => openRoute(null)}>
        <Icon name="chevronLeft" size={18} stroke={2.2} />
        Rutas
      </button>
      <label className={css.srOnly} htmlFor="route-name">
        Nombre de la ruta
      </label>
      <input
        id="route-name"
        className={css.nameInput}
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onBlur={rename}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <p className={ex.sub}>
        {route.stops.length} {route.stops.length === 1 ? 'parada' : 'paradas'} · cambiada por {route.by}
      </p>
    </div>
  );
}

export function RoutesBody() {
  const route = useRoute();
  const adding = useStore((s) => s.addingStops);
  if (!route) return <RouteList />;
  if (adding) return <StopPicker routeId={route.id} />;
  return <RouteEditor routeId={route.id} />;
}

function RouteList() {
  const routes = useShared((s) => s.routes);
  const openRoute = useStore((s) => s.openRoute);
  const list = Object.values(routes)
    .filter((r) => !r.deleted)
    .sort((a, b) => b.at - a.at);
  if (!list.length)
    return <p className={ex.empty}>Crea una ruta, elige los sitios y ordénalos arrastrando. Se comparte con los cuatro y cada tramo se abre en Amap.</p>;
  return (
    <ul className={ex.rows}>
      {list.map((r) => (
        <li key={r.id}>
          <button type="button" className={ex.row} onClick={() => openRoute(r.id)}>
            <span className={css.routeIcon}>
              <Icon name="route" size={20} />
            </span>
            <span className={ex.rowText}>
              <span className={ex.rowName}>{r.name}</span>
              <span className={ex.rowMeta}>
                {r.stops.length} {r.stops.length === 1 ? 'parada' : 'paradas'} · {r.by}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RouteEditor({ routeId }: { routeId: string }) {
  const data = useStore((s) => s.data)!;
  const route = useShared((s) => s.routes[routeId]);
  const saveRoute = useShared((s) => s.saveRoute);
  const setAdding = useStore((s) => s.setAddingStops);
  const openRoute = useStore((s) => s.openRoute);
  const mode = useStore((s) => s.amapMode);
  const withMe = useWithMe();
  const byId = useMemo(() => new Map(data.places.map((p) => [p.id, p])), [data]);

  // Orden local mientras se arrastra; se guarda al soltar
  const [order, setOrder] = useState(route.stops);
  useEffect(() => setOrder(route.stops), [route.stops]);
  const commit = (stops: string[]) => {
    if (stops.join() !== route.stops.join()) withMe(() => saveRoute({ id: route.id, name: route.name, stops }));
  };
  const stops = order.map((id) => byId.get(id)).filter((p): p is Place => Boolean(p));

  return (
    <div className={css.editor}>
      <Reorder.Group axis="x" values={order} onReorder={setOrder} className={css.strip} as="ol">
        {order.map((id, i) => (
          <Clip key={id} id={id} n={i + 1} place={byId.get(id)} onDrop={() => commit(order)} onRemove={() => commit(order.filter((x) => x !== id))} />
        ))}
        <li className={css.addClipWrap}>
          <button type="button" className={css.addClip} onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} stroke={2.2} />
            Añadir
          </button>
        </li>
      </Reorder.Group>
      {stops.length > 1 && <p className={css.hint}>Arrastra cada parada por su asa para cambiar el orden.</p>}

      {stops.length > 0 && (
        <section className={ex.section}>
          <h2 className={css.h2}>Tramos en Amap</h2>
          <ul className={css.legs}>
            <li className={css.leg}>
              <span className={css.legN}>→ 1</span>
              <span className={css.legLabel}>Hasta {stops[0].name}</span>
              <a className={css.legBtn} href={amapUrl(stops[0], mode)} target="_blank" rel="noopener noreferrer">
                <Icon name="navigation" size={13} fill="currentColor" stroke={1.6} />
                Abrir
              </a>
            </li>
            {stops.slice(1).map((p, i) => (
              <li key={p.id} className={css.leg}>
                <span className={css.legN}>
                  {i + 1} → {i + 2}
                </span>
                <span className={css.legLabel}>
                  {stops[i].name} → {p.name}
                </span>
                <a className={css.legBtn} href={amapLegUrl(stops[i], p, mode)} target="_blank" rel="noopener noreferrer">
                  <Icon name="navigation" size={13} fill="currentColor" stroke={1.6} />
                  Abrir
                </a>
              </li>
            ))}
          </ul>
          <p className={css.hint}>Modo de Amap: el elegido en las fichas (a pie, transporte o taxi).</p>
        </section>
      )}

      <button
        type="button"
        className={css.delete}
        onClick={() => {
          if (confirm(`¿Borrar «${route.name}» para los cuatro?`)) {
            withMe(() => saveRoute({ id: route.id, name: route.name, stops: route.stops, deleted: true }));
            openRoute(null);
          }
        }}
      >
        Borrar ruta
      </button>
    </div>
  );
}

function Clip({ id, n, place, onDrop, onRemove }: { id: string; n: number; place?: Place; onDrop: () => void; onRemove: () => void }) {
  const photos = useStore((s) => s.photos);
  const controls = useDragControls();
  const ph = place?.photos[0];
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} onDragEnd={onDrop} className={css.clip} as="li">
      <span className={css.clipImg} style={{ background: photoBackground(ph ? photos[ph] : undefined) }}>
        {ph && <img src={thumbUrl(ph, 's')} alt="" draggable={false} />}
        <span className={css.clipN}>{n}</span>
        <button
          type="button"
          className={css.clipGrip}
          aria-label={`Mover la parada ${n}`}
          onPointerDown={(e) => controls.start(e)}
          style={{ touchAction: 'none' }}
        >
          <Icon name="grip" size={14} fill="currentColor" stroke={0} />
        </button>
        <button type="button" className={css.clipRemove} aria-label={`Quitar ${place?.name ?? 'parada'}`} onClick={onRemove}>
          <Icon name="x" size={12} stroke={2.6} />
        </button>
      </span>
      <span className={css.clipName}>{place?.name ?? 'Sitio borrado'}</span>
    </Reorder.Item>
  );
}

function StopPicker({ routeId }: { routeId: string }) {
  const data = useStore((s) => s.data)!;
  const regionId = useStore((s) => s.regionId);
  const route = useShared((s) => s.routes[routeId]);
  const saveRoute = useShared((s) => s.saveRoute);
  const setAdding = useStore((s) => s.setAddingStops);
  const withMe = useWithMe();
  const [q, setQ] = useState('');
  const list = q.trim() ? searchPlaces(data.places, data.zones, q) : data.places.filter((p) => p.region === regionId);
  const toggle = (id: string) =>
    withMe(() => {
      const stops = route.stops.includes(id) ? route.stops.filter((s) => s !== id) : [...route.stops, id];
      saveRoute({ id: route.id, name: route.name, stops });
    });

  return (
    <div>
      <div className={css.pickerBar}>
        <input className={css.search} type="search" placeholder="Buscar sitios" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar sitios para la ruta" />
        <button type="button" className={css.done} onClick={() => setAdding(false)}>
          Hecho
        </button>
      </div>
      <ul className={ex.rows}>
        {list.map((p) => {
          const n = route.stops.indexOf(p.id);
          return (
            <PlaceRow
              key={p.id}
              place={p}
              showZone
              onPick={() => toggle(p.id)}
              trailing={
                <button type="button" className={css.pickBtn} data-on={n >= 0 || undefined} aria-label={n >= 0 ? `Quitar ${p.name}` : `Añadir ${p.name}`} onClick={() => toggle(p.id)}>
                  {n >= 0 ? n + 1 : <Icon name="plus" size={16} stroke={2.4} />}
                </button>
              }
            />
          );
        })}
      </ul>
    </div>
  );
}
