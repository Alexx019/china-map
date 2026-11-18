import { useShared } from '../../state/shared';
import { useStore } from '../../state/store';
import { PlaceRow } from '../explore/PlaceRow';
import css from '../explore/Explore.module.css';
import { STATUS } from '../shared/StatusPicker';
import { Icon } from '../../ui/icons';

export function SavedHeader() {
  const statuses = useShared((s) => s.statuses);
  const n = Object.values(statuses).filter((e) => e.value).length;
  return (
    <div className={css.head}>
      <h1 className={css.title}>Guardados</h1>
      <p className={css.sub}>{n === 0 ? 'Nada marcado todavía' : `${n} ${n === 1 ? 'sitio marcado' : 'sitios marcados'} entre los cuatro`}</p>
    </div>
  );
}

/** Sitios marcados, agrupados por estado, y lo último que ha marcado cada uno. */
export function SavedBody() {
  const data = useStore((s) => s.data)!;
  const statuses = useShared((s) => s.statuses);
  const any = Object.values(statuses).some((e) => e.value);

  if (!any)
    return (
      <p className={css.empty}>
        Marca sitios como «Queremos ir», «Quizá» o «Visitado» desde su ficha. Lo ven los cuatro, y el mapa se puede filtrar por estado.
      </p>
    );

  return (
    <>
      {STATUS.map((st) => {
        const places = data.places
          .filter((p) => statuses[p.id]?.value === st.id)
          .sort((a, b) => (statuses[b.id]?.at ?? 0) - (statuses[a.id]?.at ?? 0));
        if (!places.length) return null;
        return (
          <section key={st.id} className={css.section}>
            <h2 className={css.h2Row}>
              <Icon name={st.icon} size={16} stroke={2.2} />
              {st.label} · {places.length}
            </h2>
            <ul className={css.rows}>
              {places.map((p) => (
                <PlaceRow key={p.id} place={p} showZone />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
