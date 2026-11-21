import { animate, motion, useDragControls, useMotionValue, type PanInfo } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { setBottomInset } from '../map/controller';
import type { SheetSnap } from '../state/store';
import css from './BottomSheet.module.css';

const TOP_GAP = 72; // lo que queda de mapa por encima con la hoja completa
const TAB_BAR = 64; // sin contar la zona segura inferior (la suma el CSS)

function heights(): Record<SheetSnap, number> {
  const vh = window.innerHeight;
  const full = vh - TOP_GAP - TAB_BAR;
  return { collapsed: Math.min(TAB_BAR + 26, full), peek: Math.min(284, full), half: Math.round(Math.min(full, vh * 0.52)), full };
}

const spring = { type: 'spring', stiffness: 420, damping: 42, mass: 0.9 } as const;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  snap: SheetSnap;
  onSnap: (s: SheetSnap) => void;
  header: ReactNode;
  children: ReactNode;
  /** Botones que flotan justo encima de la hoja y suben con ella (como en las apps de mapas). */
  floating?: ReactNode;
}

export function BottomSheet({ snap, onSnap, header, children, floating }: Props) {
  const [h, setH] = useState(heights);
  const y = useMotionValue(h.full - h[snap]);
  const controls = useDragControls();
  const [visible, setVisible] = useState(h[snap]);
  // Alto real de la cabecera (cambia según la vista): el contenido ocupa el resto de lo visible
  const handleRef = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(96);
  // La hoja sigue por debajo de la barra de pestañas (padding inferior = barra + zona segura)
  const [padBottom, setPadBottom] = useState(TAB_BAR);
  useLayoutEffect(() => {
    const el = handleRef.current;
    if (!el) return;
    if (el.parentElement) setPadBottom(parseFloat(getComputedStyle(el.parentElement).paddingBottom) || TAB_BAR);
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => setH(heights());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Ir a la altura pedida
  useLayoutEffect(() => {
    const target = h.full - h[snap];
    setVisible(h[snap]);
    setBottomInset(h[snap]);
    const a = animate(y, target, reduced() ? { duration: 0 } : spring);
    return () => a.stop();
  }, [snap, h, y]);

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      // Altura que tendría la hoja con la inercia del gesto; se elige la más cercana
      const projected = h.full - (y.get() + info.velocity.y * 0.18);
      const order: SheetSnap[] = ['collapsed', 'peek', 'half', 'full'];
      const best = order.reduce((a, b) => (Math.abs(h[b] - projected) < Math.abs(h[a] - projected) ? b : a));
      if (best === snap) animate(y, h.full - h[best], spring);
      else onSnap(best);
    },
    [h, y, snap, onSnap],
  );

  return (
    <motion.section
      className={css.sheet}
      data-collapsed={snap === 'collapsed' || undefined}
      style={{ y, height: h.full }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: h.full - h.collapsed }}
      dragElastic={0.06}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      aria-label="Panel de sitios"
    >
      {floating && <div className={css.floating} data-hidden={snap === 'full' || undefined}>{floating}</div>}
      <div ref={handleRef} className={css.handleArea} onPointerDown={(e) => controls.start(e)}>
        <button
          type="button"
          className={css.grabber}
          aria-label={snap === 'collapsed' ? 'Abrir el panel' : snap === 'full' ? 'Bajar el panel' : 'Subir el panel'}
          onClick={() => onSnap(snap === 'collapsed' ? 'peek' : snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'collapsed')}
        />
        {snap !== 'collapsed' && <button type="button" className={css.collapse} aria-label="Ocultar el panel"
          onPointerDown={e => e.stopPropagation()} onClick={() => onSnap('collapsed')}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>}
        <div className={css.header} aria-hidden={snap === 'collapsed' || undefined} inert={snap === 'collapsed'}>{header}</div>
      </div>
      <div className={css.body} aria-hidden={snap === 'collapsed' || undefined} inert={snap === 'collapsed'}
        style={{ maxHeight: Math.max(0, visible - headH - padBottom) }}>
        {children}
      </div>
    </motion.section>
  );
}
