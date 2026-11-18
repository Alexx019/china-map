import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { photoBackground, photoUrl } from '../../data/photos';
import type { Place, TripData } from '../../data/types';
import { useStore } from '../../state/store';
import { CATEGORY_LABEL, categoryColor, Icon } from '../../ui/icons';
import { AmapAction, AmapLink, amapCompactClass, ZhCard } from './actions';
import css from './Place.module.css';
import { PracticalSection, TipsSection } from './Practical';

const spring = { type: 'spring', stiffness: 380, damping: 40 } as const;

/** Ficha completa del sitio, a pantalla entera (maqueta: pantallas 2 y 3). */
export function PlaceScreen() {
  const data = useStore((s) => s.data);
  const selectedId = useStore((s) => s.selectedId);
  const open = useStore((s) => s.ficha);
  const place = open && selectedId ? data?.places.find((p) => p.id === selectedId) : undefined;
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <AnimatePresence>
      {place && data && (
        <motion.div
          key={place.id}
          className={css.screen}
          role="dialog"
          aria-modal="true"
          aria-label={place.name}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={reduced ? { duration: 0 } : spring}
        >
          <Ficha place={place} data={data} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const shotLabel = { raw: 'RAW', v360: '360', both: 'RAW + 360' } as const;
const clean = (s: string) => s.replace(/[\p{Extended_Pictographic}◎📷]/gu, '').replace(/\s+/g, ' ').trim();

function Ficha({ place, data }: { place: Place; data: TripData }) {
  const photos = useStore((s) => s.photos);
  const closeFicha = useStore((s) => s.closeFicha);
  const openViewer = useStore((s) => s.openViewer);
  const openMood = useStore((s) => s.openMood);
  const zone = data.zones.find((z) => z.id === place.zone);
  const [index, setIndex] = useState(0);
  const [compact, setCompact] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // Cabecera compacta con Amap en cuanto la galería sale de la pantalla
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { root: scrollRef.current, threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onGalleryScroll = () => {
    const g = galleryRef.current;
    if (g) setIndex(Math.round(g.scrollLeft / g.clientWidth));
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: place.name, text: place.name_zh, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* compartir cancelado */
    }
  };

  return (
    <>
      <header className={css.compactBar} data-visible={compact || undefined} aria-hidden={!compact}>
        <button type="button" className={css.roundSolid} aria-label="Cerrar la ficha" onClick={closeFicha} tabIndex={compact ? 0 : -1}>
          <Icon name="chevronLeft" size={22} stroke={2.2} />
        </button>
        <div className={css.compactTitle}>
          <div className={css.compactName}>{place.name}</div>
          <div className={css.compactZh} lang="zh-CN">
            {place.name_zh}
          </div>
        </div>
        <AmapLink place={place} compact className={amapCompactClass} />
      </header>

      <button type="button" className={`${css.roundGlass} ${css.backBtn}`} aria-label="Cerrar la ficha" onClick={closeFicha}>
        <Icon name="chevronLeft" size={22} stroke={2.2} />
      </button>
      <button type="button" className={`${css.roundGlass} ${css.shareBtn}`} aria-label="Compartir el sitio" onClick={share}>
        <Icon name="share" size={20} />
      </button>

      <div className={css.scroll} ref={scrollRef}>
        {place.photos.length > 0 ? (
          <div className={css.galleryWrap}>
            <div className={css.gallery} ref={galleryRef} onScroll={onGalleryScroll}>
              {place.photos.map((ph, i) => (
                <button
                  key={ph}
                  type="button"
                  className={css.slide}
                  style={{ background: photoBackground(photos[ph]) }}
                  aria-label={`Ver la foto ${i + 1} de ${place.photos.length} a pantalla completa`}
                  onClick={() => openViewer(i)}
                >
                  <img src={photoUrl(ph)} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
                </button>
              ))}
            </div>
            {place.photos.length > 1 && (
              <>
                <div className={css.dots} aria-hidden="true">
                  {place.photos.map((ph, i) => (
                    <span key={ph} data-on={i === index || undefined} />
                  ))}
                </div>
                <div className={css.counter} aria-live="polite">
                  {index + 1} / {place.photos.length}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={css.noPhoto} style={{ ['--c' as string]: categoryColor(place.category) }}>
            <Icon name="images" size={28} />
            Sin fotos todavía
          </div>
        )}
        <div ref={sentinel} className={css.sentinel} />

        <article className={css.panel}>
          <div className={css.meta}>
            <span className={css.catPill} style={{ ['--c' as string]: categoryColor(place.category) }}>
              <span className={css.dot} style={{ background: categoryColor(place.category) }} />
              {CATEGORY_LABEL[place.category]}
            </span>
            {zone && <span className={css.metaZone}>{zone.name}</span>}
          </div>
          <h1 className={css.title}>{place.name}</h1>

          <ZhCard place={place} />
          <AmapAction place={place} />

          <div className={css.secondary}>
            <button type="button" className={css.secondaryBtn} onClick={closeFicha}>
              <Icon name="map" size={17} />
              Ver en el mapa
            </button>
            <button type="button" className={css.secondaryBtn} onClick={() => openMood(place.zone)}>
              <Icon name="images" size={17} />
              Fotos de la zona
            </button>
          </div>

          <section className={css.section}>
            <h2 className={css.h2}>Por qué ir</h2>
            <p className={css.body}>{place.why}</p>
          </section>

          <div className={css.whenRow}>
            <span className={css.whenIcon}>
              <Icon name="clock" size={18} />
            </span>
            <div>
              <div className={css.whenLabel}>Mejor momento</div>
              <div className={css.whenValue}>{place.when}</div>
            </div>
          </div>

          <section className={css.shotCard}>
            <div className={css.shotHead}>
              <h2 className={css.h3}>Para grabar</h2>
              <span className={css.shotChip} title={clean(data.shot_types[place.shot])}>
                <Icon name="camera" size={14} />
                {shotLabel[place.shot]}
              </span>
            </div>
            <p className={css.bodySmall}>{place.tip}</p>
          </section>

          <PracticalSection place={place} />
          <TipsSection place={place} />
        </article>
      </div>
    </>
  );
}
