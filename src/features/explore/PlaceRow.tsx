import type { ReactNode } from 'react';
import { isLocated } from '../../data/geo';
import { photoBackground, thumbUrl } from '../../data/photos';
import type { Place } from '../../data/types';
import { useStore } from '../../state/store';
import { CATEGORY_LABEL, categoryColor } from '../../ui/icons';
import css from './Explore.module.css';

interface Props {
  place: Place;
  showZone?: boolean;
  /** Acción al tocar la fila; por defecto, elegir el sitio en el mapa. */
  onPick?: () => void;
  /** Algo a la derecha (p. ej. «Añadir»). */
  trailing?: ReactNode;
}

export function PlaceRow({ place, showZone, onPick, trailing }: Props) {
  const data = useStore((s) => s.data)!;
  const photos = useStore((s) => s.photos);
  const select = useStore((s) => s.select);
  const setSheet = useStore((s) => s.setSheet);
  const setQuery = useStore((s) => s.setQuery);
  const ph = place.photos[0];
  const zone = data.zones.find((z) => z.id === place.zone);
  const pick =
    onPick ??
    (() => {
      select(place.id);
      setQuery('');
      setSheet('half');
    });
  return (
    <li className={css.rowLi}>
      <button type="button" className={css.row} onClick={pick}>
        <span className={css.rowImg} style={{ background: photoBackground(ph ? photos[ph] : undefined) }}>
          {ph && <img src={thumbUrl(ph, 's')} alt="" loading="lazy" />}
        </span>
        <span className={css.rowText}>
          <span className={css.rowName}>{place.name}</span>
          <span className={css.rowMeta}>
            <span className={css.dot} style={{ background: categoryColor(place.category) }} />
            {CATEGORY_LABEL[place.category]}
            {showZone && zone ? ` · ${zone.name}` : ''}
            {!isLocated(place) ? ' · sin ubicar' : ''}
          </span>
        </span>
      </button>
      {trailing}
    </li>
  );
}
