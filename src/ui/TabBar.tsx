import { useStore, type Tab } from '../state/store';
import { Icon, type IconName } from './icons';
import css from './TabBar.module.css';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'explorar', label: 'Explorar', icon: 'map' },
  { id: 'guardados', label: 'Guardados', icon: 'bookmark' },
  { id: 'rutas', label: 'Rutas', icon: 'route' },
];

export function TabBar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  return (
    <nav className={css.bar} aria-label="Secciones">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={css.item}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => setTab(t.id)}
        >
          <span className={css.icon}>
            <Icon name={t.icon} size={22} />
          </span>
          <span className={css.label}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
