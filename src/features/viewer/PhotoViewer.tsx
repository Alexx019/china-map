import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { photoBackground, photoUrl, thumbUrl } from '../../data/photos';
import { useStore } from '../../state/store';
import { Icon } from '../../ui/icons';
import { viewerPhotos } from '../zone/moodPhotos';
import css from './PhotoViewer.module.css';

/** Visor a pantalla completa: deslizar para cambiar de foto, arrastrar hacia abajo para cerrar. */
export function PhotoViewer() {
  const data = useStore((s) => s.data);
  const index = useStore((s) => s.viewer);
  const mood = useStore((s) => s.mood);
  const selectedId = useStore((s) => s.selectedId);
  const list = useMemo(() => (data ? viewerPhotos(data, { mood, selectedId }) : []), [data, mood, selectedId]);
  const open = index != null && list.length > 0;

  return <AnimatePresence>{open && <Viewer key="viewer" list={list} index={Math.min(index, list.length - 1)} />}</AnimatePresence>;
}

function Viewer({ list, index }: { list: ReturnType<typeof viewerPhotos>; index: number }) {
  const photos = useStore((s) => s.photos);
  const zones = useStore((s) => s.data?.zones);
  const setViewer = useStore((s) => s.setViewer);
  const track = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const bg = useTransform(y, [0, 300], [1, 0.2]);
  const scale = useTransform(y, [0, 300], [1, 0.88]);
  const close = () => setViewer(null);

  // Abrir en la foto pedida, sin animación de scroll
  useLayoutEffect(() => {
    const t = track.current;
    if (t && Math.round(t.scrollLeft / t.clientWidth) !== index) t.scrollTo({ left: index * t.clientWidth, behavior: 'instant' });
    strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [index]);

  const onScroll = () => {
    const t = track.current;
    if (!t) return;
    const i = Math.round(t.scrollLeft / t.clientWidth);
    if (i !== index && Math.abs(t.scrollLeft - i * t.clientWidth) < 4) setViewer(i);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) close();
  };

  const current = list[index];
  const zone = zones?.find((z) => z.id === current.place.zone);

  return (
    <motion.div
      className={css.viewer}
      role="dialog"
      aria-modal="true"
      aria-label="Fotos a pantalla completa"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div className={css.backdrop} style={{ opacity: bg }} />
      <motion.div
        className={css.stage}
        style={{ y, scale }}
        drag="y"
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.7 }}
        onDragEnd={onDragEnd}
      >
        <div className={css.track} ref={track} onScroll={onScroll}>
          {list.map(({ photo }, i) => (
            <div key={photo} className={css.slide}>
              <img
                src={photoUrl(photo)}
                alt=""
                loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                style={{ background: photoBackground(photos[photo]), aspectRatio: photos[photo] ? `${photos[photo].w} / ${photos[photo].h}` : undefined }}
              />
            </div>
          ))}
        </div>
      </motion.div>

      <div className={css.top}>
        <button type="button" className={css.close} aria-label="Cerrar el visor" onClick={close}>
          <Icon name="x" size={20} stroke={2.2} />
        </button>
        <div className={css.count} aria-live="polite">
          {index + 1} de {list.length}
        </div>
      </div>

      <div className={css.bottom}>
        <div>
          <div className={css.name}>{current.place.name}</div>
          {zone && <div className={css.zone}>{zone.name}</div>}
        </div>
        <div className={css.strip} ref={strip}>
          {list.map(({ photo }, i) => (
            <button
              key={photo}
              type="button"
              className={css.thumb}
              aria-label={`Ver la foto ${i + 1}`}
              aria-current={i === index}
              style={{ backgroundImage: `url(${JSON.stringify(thumbUrl(photo, 's'))}), ${photoBackground(photos[photo])}` }}
              onClick={() => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
