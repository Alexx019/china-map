import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { CATEGORY_LABEL, CATEGORY_ORDER, categoryColor, Icon } from '../../ui/icons';
import css from './TopBar.module.css';

/** Buscador flotante con selector de región, y debajo los filtros por categoría (maqueta: pantalla 1). */
export function TopBar() {
  const data = useStore((s) => s.data);
  const regionId = useStore((s) => s.regionId);
  const setRegion = useStore((s) => s.setRegion);
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const setSheet = useStore((s) => s.setSheet);
  const categories = useStore((s) => s.categories);
  const toggleCategory = useStore((s) => s.toggleCategory);
  const clearCategories = useStore((s) => s.clearCategories);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const region = data?.regions.find((r) => r.id === regionId);
  const usedCats = CATEGORY_ORDER.filter((c) => data?.places.some((p) => p.category === c && p.lat != null));

  return (
    <header className={css.top}>
      <div className={css.search}>
        <Icon name="search" size={20} className={css.searchIcon} />
        <label htmlFor="buscar" className={css.srOnly}>
          Buscar sitios
        </label>
        <input
          id="buscar"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Buscar sitios"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) setSheet('half');
          }}
        />
        {query && (
          <button type="button" className={css.clear} aria-label="Borrar búsqueda" onClick={() => setQuery('')}>
            <Icon name="x" size={18} />
          </button>
        )}
        <span className={css.divider} />
        <div className={css.regionWrap} ref={menuRef}>
          <button
            type="button"
            className={css.region}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {region?.name ?? 'Región'}
            <Icon name="chevronDown" size={16} stroke={2.2} />
          </button>
          {menuOpen && data && (
            <div className={css.menu} role="menu">
              {data.regions.map((r) => {
                const n = data.places.filter((p) => p.region === r.id).length;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={r.id === regionId}
                    className={css.menuItem}
                    onClick={() => {
                      setRegion(r.id);
                      setSheet('peek');
                      setMenuOpen(false);
                    }}
                  >
                    <span className={css.menuName}>{r.name}</span>
                    <span className={css.menuZh} lang="zh-CN">
                      {r.name_zh}
                    </span>
                    <span className={css.menuCount}>{n} sitios</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={css.chips} role="group" aria-label="Filtrar por categoría">
        <button type="button" className={css.chip} aria-pressed={categories.length === 0} onClick={clearCategories}>
          Todos
        </button>
        {usedCats.map((c) => (
          <button
            key={c}
            type="button"
            className={css.chip}
            aria-pressed={categories.includes(c)}
            onClick={() => toggleCategory(c)}
          >
            <span className={css.dot} style={{ background: categoryColor(c) }} />
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
    </header>
  );
}
