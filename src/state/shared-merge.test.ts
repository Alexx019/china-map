import { describe, expect, it } from 'vitest';
import { applyOp, mergeServer, type Op, type SharedData } from './shared-merge';

const empty: SharedData = { statuses: {}, routes: {} };

describe('estados compartidos', () => {
  it('gana el cambio más reciente aunque llegue después', () => {
    let s = applyOp(empty, { type: 'status', placeId: 'pin', value: 'queremos', by: 'A', at: 200 });
    s = applyOp(s, { type: 'status', placeId: 'pin', value: 'quiza', by: 'B', at: 100 });
    expect(s.statuses.pin.value).toBe('queremos');
    s = applyOp(s, { type: 'status', placeId: 'pin', value: null, by: 'B', at: 300 });
    expect(s.statuses.pin).toEqual({ value: null, by: 'B', at: 300 });
  });

  it('los cambios pendientes del móvil se mantienen sobre lo que llega del servidor', () => {
    const pending: Op[] = [{ type: 'status', placeId: 'pin', value: 'visitado', by: 'Yo', at: 500 }];
    const s = mergeServer(
      {
        statuses: { pin: { value: 'queremos', by: 'A', at: 400 }, lhs: { value: 'quiza', by: 'A', at: 400 } },
        routes: [],
      },
      pending,
    );
    expect(s.statuses.pin.value).toBe('visitado');
    expect(s.statuses.lhs.value).toBe('quiza');
  });

  it('un cambio pendiente más antiguo que el del servidor no lo pisa', () => {
    const s = mergeServer(
      { statuses: { pin: { value: 'queremos', by: 'A', at: 900 } }, routes: [] },
      [{ type: 'status', placeId: 'pin', value: 'quiza', by: 'Yo', at: 100 }],
    );
    expect(s.statuses.pin.value).toBe('queremos');
  });

  it('rutas: crear, renombrar y borrar', () => {
    let s = applyOp(empty, { type: 'route', route: { id: 'r1', name: 'Tarde', stops: ['a', 'b'] }, by: 'A', at: 1 });
    s = applyOp(s, { type: 'route', route: { id: 'r1', name: 'Tarde por Futian', stops: ['b', 'a'] }, by: 'B', at: 2 });
    expect(s.routes.r1).toMatchObject({ name: 'Tarde por Futian', stops: ['b', 'a'], deleted: false });
    s = applyOp(s, { type: 'route', route: { id: 'r1', name: 'Tarde por Futian', stops: ['b', 'a'], deleted: true }, by: 'A', at: 3 });
    expect(s.routes.r1.deleted).toBe(true);
  });
});
