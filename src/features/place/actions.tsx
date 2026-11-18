import { useState } from 'react';
import { AMAP_MODES, amapUrl, type AmapMode } from '../../data/amap';
import { isLocated } from '../../data/geo';
import type { Place } from '../../data/types';
import { useStore } from '../../state/store';
import { Icon, type IconName } from '../../ui/icons';
import css from './actions.module.css';

/** Nombre en chino grande (para enseñarlo) con botón de copiar. */
export function ZhCard({ place }: { place: Place }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(place.name_zh);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* sin permiso de portapapeles: el nombre se puede seleccionar a mano (user-select: all) */
    }
  };
  return (
    <div className={css.zhCard}>
      <div className={css.zhText}>
        <div className={css.zh} lang="zh-CN">
          {place.name_zh}
        </div>
        <div className={css.zhCity} lang="zh-CN">
          {place.city_zh}
        </div>
      </div>
      <button type="button" className={css.copy} onClick={copy} aria-live="polite">
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

const MODE_ICON: Record<AmapMode, IconName> = { walk: 'walk', bus: 'train', car: 'car' };

/** Selector de modo + botón grande «Ir con Amap». */
export function AmapAction({ place }: { place: Place }) {
  const mode = useStore((s) => s.amapMode);
  const setMode = useStore((s) => s.setAmapMode);
  return (
    <div className={css.amapBlock}>
      <div className={css.modes} role="group" aria-label="Cómo ir">
        {AMAP_MODES.map((m) => (
          <button key={m.id} type="button" className={css.mode} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            <Icon name={MODE_ICON[m.id]} size={16} />
            {m.label}
          </button>
        ))}
      </div>
      <AmapLink place={place} className={css.amap} />
      {!isLocated(place) && <p className={css.note}>Aún sin ubicar en el mapa: Amap lo buscará por su nombre en chino.</p>}
    </div>
  );
}

export function AmapLink({ place, className, compact }: { place: Place; className?: string; compact?: boolean }) {
  const mode = useStore((s) => s.amapMode);
  return (
    <a className={className ?? css.amap} href={amapUrl(place, mode)} target="_blank" rel="noopener noreferrer">
      <Icon name="navigation" size={compact ? 16 : 20} fill="currentColor" stroke={1.6} />
      {compact ? 'Amap' : 'Ir con Amap'}
    </a>
  );
}

export const amapCompactClass = css.amapCompact;
