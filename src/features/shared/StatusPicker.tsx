import type { Status } from '../../data/types';
import { useShared } from '../../state/shared';
import { Icon, type IconName } from '../../ui/icons';
import { useWithMe } from './NameDialog';
import css from './Shared.module.css';

export const STATUS: { id: Status; label: string; icon: IconName }[] = [
  { id: 'queremos', label: 'Queremos ir', icon: 'bookmark' },
  { id: 'quiza', label: 'Quizá', icon: 'clock' },
  { id: 'visitado', label: 'Visitado', icon: 'check' },
];

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
};

/** Queremos ir / Quizá / Visitado, compartido entre los 4. Tocar el marcado lo desmarca. */
export function StatusPicker({ placeId }: { placeId: string }) {
  const entry = useShared((s) => s.statuses[placeId]);
  const setStatus = useShared((s) => s.setStatus);
  const withMe = useWithMe();
  const value = entry?.value ?? null;

  return (
    <div className={css.statusWrap}>
      <div role="group" aria-label="Estado del sitio" className={css.segmented}>
        {STATUS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={value === s.id}
            data-status={s.id}
            onClick={() => withMe(() => setStatus(placeId, value === s.id ? null : s.id))}
          >
            <Icon name={s.icon} size={15} stroke={2.2} fill={value === s.id && s.id === 'queremos' ? 'currentColor' : 'none'} />
            {s.label}
          </button>
        ))}
      </div>
      {entry && (
        <p className={css.statusBy}>
          {entry.value ? 'Marcado' : 'Desmarcado'} por {entry.by} · {ago(entry.at)}
        </p>
      )}
    </div>
  );
}
