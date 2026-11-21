import type { Map as MlMap } from 'maplibre-gl';
import { MAP_BOUNDS } from '../data/geo';

type Edge = 'left' | 'right' | 'top' | 'bottom';
const edges: Edge[] = ['left', 'right', 'top', 'bottom'];
type Pull = Record<Edge, number>;
const empty = (): Pull => ({ left: 0, right: 0, top: 0, bottom: 0 });

/** Solo hay resistencia cuando el mapa ha llegado al límite y el gesto empuja hacia fuera. */
export function boundaryPull(dx: number, dy: number, bounds: { west: number; east: number; north: number; south: number },
  width: number, height: number): Pull {
  return {
    left: bounds.west >= -3 ? Math.max(0, dx) : 0,
    right: bounds.east <= width + 3 ? Math.max(0, -dx) : 0,
    top: bounds.north >= -3 ? Math.max(0, dy) : 0,
    bottom: bounds.south <= height + 3 ? Math.max(0, -dy) : 0,
  };
}

/** Curvas discretas, sin capturar gestos ni desplazar la interfaz sobre el mapa. */
export function attachEdgeFeedback(map: MlMap, svg: SVGSVGElement) {
  const container = map.getCanvasContainer();
  const paths = Object.fromEntries(edges.map(edge => [edge, svg.querySelector<SVGPathElement>(`[data-edge="${edge}"]`)!])) as Record<Edge, SVGPathElement>;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pulls = empty();
  let pointer: { id: number; x: number; y: number } | null = null;
  const pointers = new Set<number>();
  let dx = 0, dy = 0, anchorX = 0.5, anchorY = 0.5;
  let frame = 0, returning = false, lastTime = 0;
  let settleFrame = 0, elastic = false;

  function restoreLimit() {
    map.off('moveend', restoreLimit);
    if (elastic) { elastic = false; map.setMaxBounds(MAP_BOUNDS); }
  }
  function allowOverscroll() {
    cancelAnimationFrame(settleFrame);
    map.off('moveend', restoreLimit);
    map.stop();
    const nw = map.project([MAP_BOUNDS[0][0], MAP_BOUNDS[1][1]]);
    const se = map.project([MAP_BOUNDS[1][0], MAP_BOUNDS[0][1]]);
    const margin = motion.matches ? 0 : 22;
    const outerNW = map.unproject([nw.x - margin, nw.y - margin]);
    const outerSE = map.unproject([se.x + margin, se.y + margin]);
    elastic = true;
    map.setMaxBounds([[outerNW.lng, outerSE.lat], [outerSE.lng, outerNW.lat]]);
  }
  function settle() {
    cancelAnimationFrame(settleFrame);
    settleFrame = requestAnimationFrame(() => {
      if (!elastic) return;
      const { width, height } = svg.getBoundingClientRect();
      const nw = map.project([MAP_BOUNDS[0][0], MAP_BOUNDS[1][1]]);
      const se = map.project([MAP_BOUNDS[1][0], MAP_BOUNDS[0][1]]);
      const x = nw.x > 0 ? nw.x : se.x < width ? se.x - width : 0;
      const y = nw.y > 0 ? nw.y : se.y < height ? se.y - height : 0;
      if (Math.abs(x) + Math.abs(y) < 0.25) { restoreLimit(); return; }
      map.stop();
      map.once('moveend', restoreLimit);
      // Se mueve la cámara sobre las teselas adicionales; no se escala el canvas.
      map.panBy([x, y], { duration: motion.matches ? 0 : 280, easing: t => 1 - (1 - t) ** 3 });
    });
  }

  function draw() {
    const { width: w, height: h } = svg.getBoundingClientRect();
    if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const x = Math.max(w * 0.15, Math.min(w * 0.85, anchorX * w));
    const y = Math.max(h * 0.15, Math.min(h * 0.85, anchorY * h));
    for (const edge of edges) {
      const pull = pulls[edge];
      const depth = Math.min(46, Math.sqrt(pull) * 4.5);
      const d = edge === 'left' ? `M0 0 Q${depth * 2} ${y} 0 ${h}Z`
        : edge === 'right' ? `M${w} 0 Q${w - depth * 2} ${y} ${w} ${h}Z`
        : edge === 'top' ? `M0 0 Q${x} ${depth * 2} ${w} 0Z`
        : `M0 ${h} Q${x} ${h - depth * 2} ${w} ${h}Z`;
      paths[edge].setAttribute('d', d);
      paths[edge].style.opacity = pull < 0.1 ? '0' : String(Math.min(0.24, 0.08 + pull / 600));
    }
  }

  function tick(time: number) {
    frame = 0;
    if (returning) {
      // Decaimiento independiente de la frecuencia de refresco.
      const factor = Math.exp(-Math.min(64, time - lastTime) / 70);
      for (const edge of edges) pulls[edge] *= factor;
    } else if (dx || dy) {
      const nw = map.project([MAP_BOUNDS[0][0], MAP_BOUNDS[1][1]]);
      const se = map.project([MAP_BOUNDS[1][0], MAP_BOUNDS[0][1]]);
      const { width, height } = svg.getBoundingClientRect();
      const next = boundaryPull(dx, dy, { west: nw.x, east: se.x, north: nw.y, south: se.y }, width, height);
      for (const edge of edges) {
        pulls[edge] = next[edge] ? Math.min(110, pulls[edge] + next[edge] * 0.65) : 0;
      }
      dx = dy = 0;
    }
    lastTime = time;
    draw();
    if (returning && edges.some(edge => pulls[edge] > 0.1)) frame = requestAnimationFrame(tick);
  }
  function release() {
    dx = dy = 0;
    returning = true;
    lastTime = performance.now();
    if (motion.matches) { pulls = empty(); draw(); }
    else if (!frame) frame = requestAnimationFrame(tick);
    settle();
  }
  function down(event: PointerEvent) {
    pointers.add(event.pointerId);
    if (pointers.size !== 1 || (event.pointerType === 'mouse' && event.button !== 0)) {
      pointer = null; release(); restoreLimit(); return;
    }
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    returning = false;
    allowOverscroll();
  }
  function move(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId || pointers.size !== 1) return;
    dx += event.clientX - pointer.x;
    dy += event.clientY - pointer.y;
    pointer.x = event.clientX; pointer.y = event.clientY;
    const rect = svg.getBoundingClientRect();
    anchorX = (event.clientX - rect.left) / rect.width;
    anchorY = (event.clientY - rect.top) / rect.height;
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function up(event: PointerEvent) {
    pointers.delete(event.pointerId);
    if (pointer?.id === event.pointerId) { pointer = null; release(); }
  }
  function reset() { pointers.clear(); pointer = null; release(); }
  container.addEventListener('pointerdown', down, { passive: true });
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', up, { passive: true });
  window.addEventListener('pointercancel', up, { passive: true });
  window.addEventListener('blur', reset);
  map.on('resize', draw);
  return () => {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(settleFrame);
    restoreLimit();
    container.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('blur', reset);
    map.off('resize', draw);
  };
}
