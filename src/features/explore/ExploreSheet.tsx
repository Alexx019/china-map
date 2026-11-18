import { useMemo } from 'react';
import { isLocated } from '../../data/geo';
import { photoBackground, thumbUrl } from '../../data/photos';
import { searchPlaces } from '../../data/search';
import type { Place } from '../../data/types';
import { useStore } from '../../state/store';
import { BottomSheet } from '../../ui/BottomSheet';
import { CATEGORY_LABEL, categoryColor, Icon } from '../../ui/icons';
import { AmapAction, ZhCard } from '../place/actions';
import css from './Explore.module.css';
import { MapButtons } from './MapButtons';

export function ExploreSheet() {
  const data = useStore((s) => s.data);
  const tab = useStore((s) => s.tab);
  const snap = useStore((s) => s.sheet);
  const setSheet = useStore((s) => s.setSheet);
  const query = useStore((s) => s.query);
  const selectedId = useStore((s) => s.selectedId);
  const zoneId = useStore((s) => s.zoneId);

  if (!data) return null;
  const selected = selectedId ? data.places.find((p) => p.id === selectedId) : undefined;

  let view: { header: React.ReactNode; body: React.ReactNode };
  if (tab !== 'explorar') view = comingSoon(tab);
  else if (selected) view = placeView(selected);
  else if (query.trim()) view = searchView();
  else if (zoneId) view = zoneView();
  else view = regionView();

  return (
    <BottomSheet snap={snap} onSnap={setSheet} header={view.header} floating={<MapButtons />}>
      {view.body}
    </BottomSheet>
  );
}

/* ---------- Vistas ---------- */

function regionView() {
  return { header: <RegionHeader />, body: <RegionBody /> };
}
function zoneView() {
  return { header: <ZoneHeader />, body: <ZoneBody /> };
}
function searchView() {
  return { header: <SearchHeader />, body: <SearchBody /> };
}
function placeView(p: Place) {
  return { header: <PlaceHeader place={p} />, body: <PlaceBody place={p} /> };
}
function comingSoon(tab: string) {
  const title = tab === 'guardados' ? 'Guardados' : 'Rutas';
  const text =
    tab === 'guardados'
      ? 'Aquí saldrán los sitios marcados como «Queremos ir», «Quizá» y «Visitado», compartidos entre los cuatro.'
      : 'Aquí saldrán las rutas que hagáis vosotros: elegir sitios, ordenarlos y abrir cada tramo en Amap.';
  return {
    header: (
      <div className={css.head}>
        <h1 className={css.title}>{title}</h1>
      </div>
    ),
    body: <p className={css.empty}>{text} Llega en la próxima fase.</p>,
  };
}

/* ---------- Región ---------- */

function useScopePlaces(filter: (p: Place) => boolean) {
  const data = useStore((s) => s.data)!;
  const categories = useStore((s) => s.categories);
  return useMemo(
    () => data.places.filter(filter).filter((p) => !categories.length || categories.includes(p.category)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, categories, filter],
  );
}

function RegionHeader() {
  const data = useStore((s) => s.data)!;
  const regionId = useStore((s) => s.regionId);
  const region = data.regions.find((r) => r.id === regionId)!;
  const n = data.places.filter((p) => p.region === regionId).length;
  const zones = data.zones.filter((z) => z.region === regionId).length;
  const firstZone = data.zones.find((z) => z.region === regionId)?.id;
  return (
    <div className={css.head}>
      <div className={css.titleRow}>
        <h1 className={css.title}>{region.name}</h1>
        <span className={css.titleZh} lang="zh-CN">
          {region.name_zh}
        </span>
      </div>
      <div className={css.subRow}>
        <p className={css.sub}>
          {n} sitios en {zones} zonas
        </p>
        {firstZone && <MoodButton zone={firstZone} scope="region" />}
      </div>
    </div>
  );
}

function RegionBody() {
  const data = useStore((s) => s.data)!;
  const regionId = useStore((s) => s.regionId);
  const setZone = useStore((s) => s.setZone);
  const setSheet = useStore((s) => s.setSheet);
  const filter = useMemo(() => (p: Place) => p.region === regionId, [regionId]);
  const places = useScopePlaces(filter);
  const zones = data.zones.filter((z) => z.region === regionId);
  const located = places.filter(isLocated);
  const unlocated = places.filter((p) => !isLocated(p));

  return (
    <>
      <div className={css.zoneChips}>
        {zones.map((z) => (
          <button
            key={z.id}
            type="button"
            className={css.zoneChip}
            onClick={() => {
              setZone(z.id);
              setSheet('half');
            }}
          >
            {z.name}
          </button>
        ))}
      </div>
      <div className={css.cards}>
        {located.map((p) => (
          <PlaceCard key={p.id} place={p} />
        ))}
      </div>
      {unlocated.length > 0 && <Unlocated places={unlocated} />}
    </>
  );
}

/* ---------- Zona ---------- */

function ZoneHeader() {
  const data = useStore((s) => s.data)!;
  const zoneId = useStore((s) => s.zoneId);
  const setZone = useStore((s) => s.setZone);
  const zone = data.zones.find((z) => z.id === zoneId)!;
  const region = data.regions.find((r) => r.id === zone.region)!;
  return (
    <div className={css.head}>
      <button type="button" className={css.back} onClick={() => setZone(null)}>
        <Icon name="chevronLeft" size={18} stroke={2.2} />
        {region.name}
      </button>
      <div className={css.titleRow}>
        <h1 className={css.title}>{zone.name}</h1>
      </div>
      <div className={css.subRow}>
        <p className={css.sub} lang="zh-CN">
          {zone.name_zh}
        </p>
        <MoodButton zone={zone.id} scope="zona" />
      </div>
    </div>
  );
}

function MoodButton({ zone, scope }: { zone: string; scope: 'zona' | 'region' }) {
  const openMood = useStore((s) => s.openMood);
  return (
    <button type="button" className={css.moodBtn} onClick={() => openMood(zone, scope)}>
      <Icon name="images" size={16} />
      Fotos
    </button>
  );
}

function ZoneBody() {
  const data = useStore((s) => s.data)!;
  const zoneId = useStore((s) => s.zoneId);
  const zone = data.zones.find((z) => z.id === zoneId)!;
  const filter = useMemo(() => (p: Place) => p.zone === zoneId, [zoneId]);
  const places = useScopePlaces(filter);
  return (
    <>
      <p className={css.lede}>{zone.lede}</p>
      <ul className={css.rows}>
        {places.map((p) => (
          <PlaceRow key={p.id} place={p} />
        ))}
      </ul>
    </>
  );
}

/* ---------- Búsqueda ---------- */

function SearchHeader() {
  const data = useStore((s) => s.data)!;
  const query = useStore((s) => s.query);
  const n = searchPlaces(data.places, data.zones, query).length;
  return (
    <div className={css.head}>
      <h1 className={css.titleSmall}>{n === 0 ? 'Sin resultados' : n === 1 ? '1 sitio' : `${n} sitios`}</h1>
      <p className={css.sub}>Busca por nombre en español o en chino, o por zona.</p>
    </div>
  );
}

function SearchBody() {
  const data = useStore((s) => s.data)!;
  const query = useStore((s) => s.query);
  const results = searchPlaces(data.places, data.zones, query);
  return (
    <ul className={css.rows}>
      {results.map((p) => (
        <PlaceRow key={p.id} place={p} showZone />
      ))}
    </ul>
  );
}

/* ---------- Sitio elegido ---------- */

function PlaceHeader({ place }: { place: Place }) {
  const data = useStore((s) => s.data)!;
  const select = useStore((s) => s.select);
  const zone = data.zones.find((z) => z.id === place.zone);
  return (
    <div className={css.head}>
      <div className={css.placeHeadRow}>
        <div className={css.meta}>
          <span className={css.catPill} style={{ ['--c' as string]: categoryColor(place.category) }}>
            <span className={css.dot} style={{ background: categoryColor(place.category) }} />
            {CATEGORY_LABEL[place.category]}
          </span>
          {zone && <span className={css.metaZone}>{zone.name}</span>}
        </div>
        <button type="button" className={css.close} aria-label="Cerrar" onClick={() => select(null)}>
          <Icon name="x" size={18} stroke={2.2} />
        </button>
      </div>
      <h1 className={css.title}>{place.name}</h1>
    </div>
  );
}

function PlaceBody({ place }: { place: Place }) {
  const photos = useStore((s) => s.photos);
  const openFicha = useStore((s) => s.openFicha);
  const openViewer = useStore((s) => s.openViewer);

  return (
    <div className={css.place}>
      <ZhCard place={place} />
      <AmapAction place={place} />
      <button type="button" className={css.fichaBtn} onClick={() => openFicha(place.id)}>
        Ver ficha completa
        <Icon name="chevronRight" size={18} stroke={2.2} />
      </button>

      {place.photos.length > 0 && (
        <div className={css.strip}>
          {place.photos.map((ph, i) => (
            <img
              key={ph}
              onClick={() => {
                openFicha(place.id);
                openViewer(i);
              }}
              className={css.stripImg}
              src={thumbUrl(ph, 'm')}
              alt=""
              loading="lazy"
              style={{ background: photoBackground(photos[ph]), aspectRatio: photos[ph] ? `${photos[ph].w} / ${photos[ph].h}` : '3 / 4' }}
            />
          ))}
        </div>
      )}

      <section className={css.section}>
        <h2 className={css.h2}>Por qué ir</h2>
        <p className={css.text}>{place.why}</p>
      </section>
      <section className={css.section}>
        <h2 className={css.h2}>Mejor momento</h2>
        <p className={css.text}>{place.when}</p>
      </section>
    </div>
  );
}

/* ---------- Piezas ---------- */

function PlaceCard({ place }: { place: Place }) {
  const photos = useStore((s) => s.photos);
  const select = useStore((s) => s.select);
  const setSheet = useStore((s) => s.setSheet);
  const ph = place.photos[0];
  return (
    <button
      type="button"
      className={css.card}
      onClick={() => {
        select(place.id);
        setSheet('half');
      }}
    >
      <span className={css.cardImg} style={{ background: photoBackground(ph ? photos[ph] : undefined) }}>
        {ph && <img src={thumbUrl(ph, 'm')} alt="" loading="lazy" />}
      </span>
      <span className={css.cardName}>{place.name}</span>
      <span className={css.cardCat}>
        <span className={css.dot} style={{ background: categoryColor(place.category) }} />
        {CATEGORY_LABEL[place.category]}
      </span>
    </button>
  );
}

function PlaceRow({ place, showZone }: { place: Place; showZone?: boolean }) {
  const data = useStore((s) => s.data)!;
  const photos = useStore((s) => s.photos);
  const select = useStore((s) => s.select);
  const setSheet = useStore((s) => s.setSheet);
  const setQuery = useStore((s) => s.setQuery);
  const ph = place.photos[0];
  const zone = data.zones.find((z) => z.id === place.zone);
  return (
    <li>
      <button
        type="button"
        className={css.row}
        onClick={() => {
          select(place.id);
          setQuery('');
          setSheet('half');
        }}
      >
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
    </li>
  );
}

function Unlocated({ places }: { places: Place[] }) {
  return (
    <section className={css.section}>
      <h2 className={css.h2Row}>
        <Icon name="pinOff" size={16} />
        Sin ubicar en el mapa
      </h2>
      <ul className={css.rows}>
        {places.map((p) => (
          <PlaceRow key={p.id} place={p} />
        ))}
      </ul>
    </section>
  );
}
