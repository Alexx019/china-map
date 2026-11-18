import type { Status } from '../data/types';

export interface StatusEntry {
  value: Status | null;
  by: string;
  at: number;
}

export interface RouteEntry {
  id: string;
  name: string;
  stops: string[];
  by: string;
  at: number;
  deleted: boolean;
}

export type Op =
  | { type: 'status'; placeId: string; value: Status | null; by: string; at: number }
  | { type: 'route'; route: { id: string; name: string; stops: string[]; deleted?: boolean }; by: string; at: number };

export interface SharedData {
  statuses: Record<string, StatusEntry>;
  routes: Record<string, RouteEntry>;
}

/** Aplica un cambio sobre el estado (gana el más reciente), igual que hace el servidor. */
export function applyOp(s: SharedData, op: Op): SharedData {
  if (op.type === 'status') {
    const cur = s.statuses[op.placeId];
    if (cur && cur.at > op.at) return s;
    return { ...s, statuses: { ...s.statuses, [op.placeId]: { value: op.value, by: op.by, at: op.at } } };
  }
  const cur = s.routes[op.route.id];
  if (cur && cur.at > op.at) return s;
  return {
    ...s,
    routes: {
      ...s.routes,
      [op.route.id]: { id: op.route.id, name: op.route.name, stops: op.route.stops, by: op.by, at: op.at, deleted: Boolean(op.route.deleted) },
    },
  };
}

/** Estado del servidor + los cambios de este móvil que aún no han llegado. */
export function mergeServer(server: { statuses: Record<string, StatusEntry>; routes: RouteEntry[] }, pending: Op[]): SharedData {
  let s: SharedData = { statuses: { ...server.statuses }, routes: Object.fromEntries(server.routes.map((r) => [r.id, r])) };
  for (const op of pending) s = applyOp(s, op);
  return s;
}
