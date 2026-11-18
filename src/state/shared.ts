import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Status } from '../data/types';
import { applyOp, mergeServer, type Op, type RouteEntry, type SharedData, type StatusEntry } from './shared-merge';

// Estados y rutas compartidos entre los 4.
// Cada cambio se ve al momento, se guarda en una cola en el móvil y se envía cuando hay red.
// Así funciona igual sin conexión; al volver, se manda la cola y se trae lo de los demás.

interface SharedState extends SharedData {
  pending: Op[];
  /** Nombre de quien usa este móvil (se pide una vez). */
  me: string | null;
  lastSync: number | null;
  syncing: boolean;
  setMe: (name: string) => void;
  setStatus: (placeId: string, value: Status | null) => void;
  saveRoute: (route: { id: string; name: string; stops: string[]; deleted?: boolean }) => void;
}

export const useShared = create<SharedState>()(
  persist(
    (set, get) => {
      const commit = (op: Op) => {
        set((s) => ({ ...applyOp(s, op), pending: [...s.pending, op] }));
        void sync();
      };
      return {
        statuses: {},
        routes: {},
        pending: [],
        me: null,
        lastSync: null,
        syncing: false,
        setMe: (name) => set({ me: name.trim().slice(0, 30) }),
        setStatus: (placeId, value) => commit({ type: 'status', placeId, value, by: get().me ?? '?', at: Date.now() }),
        saveRoute: (route) => commit({ type: 'route', route, by: get().me ?? '?', at: Date.now() }),
      };
    },
    {
      name: 'china-map:shared',
      partialize: (s) => ({ statuses: s.statuses, routes: s.routes, pending: s.pending, me: s.me, lastSync: s.lastSync }),
    },
  ),
);

let inFlight: Promise<void> | null = null;

/** Envía la cola (si hay) y trae el estado del grupo. Sin red, no hace nada y lo reintenta luego. */
export function sync(): Promise<void> {
  if (inFlight) return inFlight.then(() => (useShared.getState().pending.length ? sync() : undefined));
  inFlight = (async () => {
    if (!navigator.onLine) return;
    const { pending } = useShared.getState();
    useShared.setState({ syncing: true });
    try {
      const res = pending.length
        ? await fetch('/api/ops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: pending }) })
        : await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) return;
      const server = (await res.json()) as { statuses: Record<string, StatusEntry>; routes: RouteEntry[] };
      // Quitar de la cola lo enviado; lo que se haya añadido mientras tanto se queda
      const still = useShared.getState().pending.slice(pending.length);
      useShared.setState({ ...mergeServer(server, still), pending: still, lastSync: Date.now() });
    } catch {
      /* sin conexión o servidor caído: la cola se queda para la próxima */
    } finally {
      useShared.setState({ syncing: false });
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Sincroniza al abrir, al volver a la app, al recuperar la red y cada minuto con la app abierta. */
export function startSync() {
  void sync();
  const onVisible = () => document.visibilityState === 'visible' && void sync();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onVisible);
  const timer = window.setInterval(() => document.visibilityState === 'visible' && void sync(), 60_000);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onVisible);
    window.clearInterval(timer);
  };
}

export const newRouteId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
