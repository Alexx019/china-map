import { Marker, type GeoJSONSource, type Map as MlMap } from 'maplibre-gl';
import type { Point } from 'geojson';
import type { CategoryId } from '../data/types';
import { iconSvg } from '../ui/icons';
import { PLACES_SOURCE } from './style';
import './markers.css';

/** A partir de este zoom los sitios se dibujan con su foto (la seña de la maqueta). */
const PHOTO_ZOOM = 13.5;
/** A partir de este zoom se ve el nombre junto al marcador. */
const LABEL_ZOOM = 14.5;

export interface PlaceProps {
  id: string;
  name: string;
  category: CategoryId;
  thumb: string;
  bg: string;
  /** Estado compartido: '' si no está marcado. */
  status: string;
}

interface Entry {
  marker: Marker;
  el: HTMLElement;
}

/**
 * Marcadores en HTML sobre la fuente agrupada de MapLibre: así se pueden dibujar como en la maqueta
 * (cristal, sombras, fotos redondas) y animar con CSS. Con ~50 sitios el coste es mínimo.
 */
export class MarkerLayer {
  private entries = new Map<string, Entry>();
  private selected: string | null = null;

  constructor(
    private map: MlMap,
    private onPlace: (id: string) => void,
  ) {}

  setSelected(id: string | null) {
    this.selected = id;
    this.sync();
  }

  sync = () => {
    const map = this.map;
    if (!map.getSource(PLACES_SOURCE) || !map.isSourceLoaded(PLACES_SOURCE)) return;
    const zoom = map.getZoom();
    const seen = new Set<string>();

    for (const f of map.querySourceFeatures(PLACES_SOURCE)) {
      const p = f.properties as Record<string, unknown>;
      const [lng, lat] = (f.geometry as Point).coordinates;
      const isCluster = Boolean(p.cluster);
      const key = isCluster ? `c${p.cluster_id}-${p.point_count}` : `p${p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let entry = this.entries.get(key);
      if (!entry) {
        const el = isCluster ? this.clusterEl(p.cluster_id as number, p.point_count as number) : this.pinEl(p as unknown as PlaceProps);
        entry = { el, marker: new Marker({ element: el }).setLngLat([lng, lat]).addTo(map) };
        this.entries.set(key, entry);
      } else if (isCluster) {
        entry.marker.setLngLat([lng, lat]);
      }

      if (!isCluster) {
        const id = p.id as string;
        const sel = id === this.selected;
        const photo = zoom >= PHOTO_ZOOM && Boolean(p.thumb);
        entry.el.classList.toggle('pin--photo', photo || (sel && Boolean(p.thumb)));
        entry.el.classList.toggle('pin--label', zoom >= LABEL_ZOOM || sel);
        entry.el.classList.toggle('pin--selected', sel);
        entry.el.style.zIndex = sel ? '5' : photo ? '2' : '1';
        entry.el.setAttribute('aria-pressed', String(sel));
        const st = (p.status as string) || '';
        if (entry.el.dataset.status !== st) entry.el.dataset.status = st;
      }
    }

    for (const [key, entry] of this.entries) {
      if (!seen.has(key)) {
        entry.marker.remove();
        this.entries.delete(key);
      }
    }
  };

  destroy() {
    for (const e of this.entries.values()) e.marker.remove();
    this.entries.clear();
  }

  private pinEl(p: PlaceProps): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pin';
    el.style.setProperty('--c', `var(--cat-${p.category})`);
    el.setAttribute('aria-label', p.name);
    // Solo HTML fijo (iconos propios); los datos (foto, nombre) van por propiedades del DOM, nunca como HTML
    el.innerHTML =
      `<span class="pin__dot">${iconSvg(p.category, 14, '#fff', 2.4)}</span>` +
      (p.thumb ? `<span class="pin__photo"></span>` : '') +
      `<span class="pin__badge">${iconSvg(p.category, 10, '#fff', 3)}</span>` +
      `<span class="pin__status"></span>` +
      `<span class="pin__label"></span>`;
    (el.querySelector('.pin__label') as HTMLElement).textContent = p.name;
    const photo = el.querySelector<HTMLElement>('.pin__photo');
    if (photo) {
      // Degradado con los colores de la foto debajo, mientras carga
      photo.style.backgroundImage = `url(${JSON.stringify(p.thumb)}), ${p.bg}`;
    }
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onPlace(p.id);
    });
    return el;
  }

  private clusterEl(clusterId: number, count: number): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `cluster ${count >= 10 ? 'cluster--l' : count >= 5 ? 'cluster--m' : ''}`;
    el.textContent = String(count);
    el.setAttribute('aria-label', `${count} sitios: acercar`);
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const src = this.map.getSource(PLACES_SOURCE) as GeoJSONSource;
      const zoom = await src.getClusterExpansionZoom(clusterId);
      const center = (this.entries.get(`c${clusterId}-${count}`)?.marker.getLngLat()) ?? this.map.getCenter();
      this.map.easeTo({ center, zoom: zoom + 0.3, duration: 600 });
    });
    return el;
  }
}
