import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AmapMode } from '../data/amap';
import type { PhotoManifest } from '../data/photos';
import type { CategoryId, TripData } from '../data/types';

export type ThemePref = 'auto' | 'light' | 'dark';
export type Tab = 'explorar' | 'guardados' | 'rutas';
export type SheetSnap = 'peek' | 'half' | 'full';

/** Pantallas que se abren encima del mapa. Todo esto vive también en el hash (state/nav.ts). */
export interface Route {
  selectedId: string | null;
  zoneId: string | null;
  /** Ficha completa del sitio elegido. */
  ficha: boolean;
  /** Mood board: zona de referencia y si se ven las fotos de la zona o de toda su región. */
  mood: { zone: string; scope: 'zona' | 'region' } | null;
  /** Foto abierta en el visor (de la ficha o del mood board). */
  viewer: number | null;
}

interface AppState {
  data: TripData | null;
  photos: PhotoManifest;
  regionId: string;
  zoneId: string | null;
  /** Vacío = todas las categorías. */
  categories: CategoryId[];
  query: string;
  selectedId: string | null;
  theme: ThemePref;
  amapMode: AmapMode;
  tab: Tab;
  sheet: SheetSnap;
  ficha: boolean;
  mood: Route['mood'];
  viewer: number | null;

  setData: (data: TripData, photos: PhotoManifest) => void;
  setRegion: (id: string) => void;
  setZone: (id: string | null) => void;
  toggleCategory: (id: CategoryId) => void;
  clearCategories: () => void;
  setQuery: (q: string) => void;
  select: (id: string | null) => void;
  cycleTheme: () => void;
  setAmapMode: (m: AmapMode) => void;
  setTab: (t: Tab) => void;
  setSheet: (s: SheetSnap) => void;
  openFicha: (id: string) => void;
  closeFicha: () => void;
  openMood: (zone: string, scope?: 'zona' | 'region') => void;
  closeMood: () => void;
  openViewer: (index: number) => void;
  setViewer: (index: number | null) => void;
  applyRoute: (r: Route) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      data: null,
      photos: {},
      regionId: 'sz',
      zoneId: null,
      categories: [],
      query: '',
      selectedId: null,
      theme: 'auto',
      amapMode: 'walk',
      tab: 'explorar',
      sheet: 'peek',
      ficha: false,
      mood: null,
      viewer: null,

      setData: (data, photos) => {
        const regionOk = data.regions.some((r) => r.id === get().regionId);
        set({ data, photos, regionId: regionOk ? get().regionId : data.regions[0].id });
      },
      setRegion: (id) => set({ regionId: id, zoneId: null, selectedId: null, query: '' }),
      setZone: (id) => {
        const zone = get().data?.zones.find((z) => z.id === id);
        set({ zoneId: id, selectedId: null, ...(zone ? { regionId: zone.region } : {}) });
      },
      toggleCategory: (id) => {
        const cur = get().categories;
        set({ categories: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id] });
      },
      clearCategories: () => set({ categories: [] }),
      setQuery: (q) => set({ query: q }),
      select: (id) => {
        const place = get().data?.places.find((p) => p.id === id);
        set({ selectedId: id, ...(place ? { regionId: place.region } : {}) });
      },
      cycleTheme: () => {
        const order: ThemePref[] = ['auto', 'light', 'dark'];
        set({ theme: order[(order.indexOf(get().theme) + 1) % order.length] });
      },
      setAmapMode: (m) => set({ amapMode: m }),
      setTab: (t) => set({ tab: t }),
      setSheet: (s) => set({ sheet: s }),
      openFicha: (id) => {
        get().select(id);
        set({ ficha: true, viewer: null });
      },
      closeFicha: () => set({ ficha: false, viewer: null }),
      openMood: (zone, scope = 'zona') => set({ mood: { zone, scope }, viewer: null }),
      closeMood: () => set({ mood: null, viewer: null }),
      openViewer: (index) => set({ viewer: index }),
      setViewer: (index) => set({ viewer: index }),
      applyRoute: (r) => {
        const place = r.selectedId ? get().data?.places.find((p) => p.id === r.selectedId) : undefined;
        set({ ...r, ...(place ? { regionId: place.region } : {}) });
      },
    }),
    {
      name: 'china-map:ui',
      // Solo preferencias de cada móvil; los datos se cargan siempre de /data
      partialize: (s) => ({ regionId: s.regionId, theme: s.theme, amapMode: s.amapMode, categories: s.categories }),
    },
  ),
);
