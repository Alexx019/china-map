import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { photoBackground, thumbUrl } from '../../data/photos';
import { useStore } from '../../state/store';
import { Icon } from '../../ui/icons';
import css from './MoodBoard.module.css';
import { moodPhotos } from './moodPhotos';

/** Mood board: cuadrícula tipo Instagram con todas las fotos de una zona o de su región (maqueta: pantalla 5). */
export function MoodBoard() {
  const data = useStore((s) => s.data);
  const mood = useStore((s) => s.mood);
  const photos = useStore((s) => s.photos);
  const openMood = useStore((s) => s.openMood);
  const closeMood = useStore((s) => s.closeMood);
  const openViewer = useStore((s) => s.openViewer);
  const closeFicha = useStore((s) => s.closeFicha);
  const list = useMemo(() => (data && mood ? moodPhotos(data, mood) : []), [data, mood]);
  const zone = mood ? data?.zones.find((z) => z.id === mood.zone) : undefined;
  const region = zone ? data?.regions.find((r) => r.id === zone.region) : undefined;
  const nPlaces = new Set(list.map((p) => p.place.id)).size;
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <AnimatePresence>
      {mood && zone && region && (
        <motion.div
          key="mood"
          className={css.screen}
          role="dialog"
          aria-modal="true"
          aria-label={`Fotos de ${zone.name}`}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 40 }}
        >
          <div className={css.scroll}>
            <header className={css.head}>
              <div className={css.topRow}>
                <button type="button" className={css.round} aria-label="Volver" onClick={closeMood}>
                  <Icon name="chevronLeft" size={22} stroke={2.2} />
                </button>
                <button
                  type="button"
                  className={css.pill}
                  onClick={() => {
                    closeMood();
                    closeFicha();
                  }}
                >
                  <Icon name="map" size={17} />
                  Ver en el mapa
                </button>
              </div>
              <h1 className={css.title}>{mood.scope === 'region' ? region.name : zone.name}</h1>
              <p className={css.sub}>
                {list.length} fotos de {nPlaces} {nPlaces === 1 ? 'sitio' : 'sitios'}
              </p>
              <div className={css.segmented} role="group" aria-label="Qué fotos ver">
                <button type="button" aria-pressed={mood.scope === 'zona'} onClick={() => openMood(zone.id, 'zona')}>
                  Esta zona
                </button>
                <button type="button" aria-pressed={mood.scope === 'region'} onClick={() => openMood(zone.id, 'region')}>
                  Todo {region.name}
                </button>
              </div>
            </header>

            <div className={css.grid}>
              {list.map(({ photo, place }, i) => (
                <button
                  key={photo}
                  type="button"
                  className={css.tile}
                  aria-label={`Foto de ${place.name}`}
                  style={{ background: photoBackground(photos[photo]) }}
                  onClick={() => openViewer(i)}
                >
                  <img src={thumbUrl(photo, 'm')} alt="" loading={i < 12 ? 'eager' : 'lazy'} decoding="async" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
