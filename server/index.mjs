// API mínima de china-map: estados de cada sitio y rutas del grupo, compartidos entre los 4.
// Catálogo editable y MCP OAuth en app.mjs; estados y rutas compartidos en SQLite.
//
//   GET  /api/health
//   GET  /api/state           → { statuses, routes, now }
//   POST /api/ops  {ops: [...]} → aplica los cambios (gana el más reciente) y devuelve el estado
//
// Variables: PORT (8787), DB_PATH (./data/china-map.db), PLACES_PATH (opcional, para validar ids).
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApplication } from './app.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? './data/china-map.db';
const STATUSES = new Set(['queremos', 'quiza', 'visitado']);
const MAX_BODY = 64 * 1024;

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS status (
    place_id TEXT PRIMARY KEY,
    value    TEXT,             -- queremos | quiza | visitado | NULL (sin marcar)
    by       TEXT NOT NULL,
    at       INTEGER NOT NULL  -- ms del móvil que hizo el cambio
  );
  CREATE TABLE IF NOT EXISTS routes (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    stops   TEXT NOT NULL,     -- JSON: ids de sitios en orden
    by      TEXT NOT NULL,
    at      INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
  );
`);

// Ids válidos de sitios, si se le pasa places.json (evita guardar basura)
const placesPath = process.env.PLACES_PATH ?? new URL('../public/data/places.json', import.meta.url);
const { app, catalog, mcpEnabled, mcpError } = createApplication({ db, seedPath:placesPath,
  manifestPath:process.env.PHOTO_MANIFEST_PATH ?? new URL('../public/data/thumbs/photos.json', import.meta.url),
  mediaDirectory:process.env.MEDIA_PATH ?? `${dirname(DB_PATH)}/media`,
  publicUrl:process.env.MCP_PUBLIC_URL ?? 'https://china.ariassouto.es',
  passwordHash:process.env.MCP_PASSWORD_HASH,
  allowedOrigins:(process.env.MCP_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
});
if (mcpError) console.warn(`MCP desactivado: ${mcpError}`);
let placeIds = null;
const loadPlaces = () => {
  placeIds = new Set(catalog.document().places.map(p => p.id));
};
loadPlaces();

const getStatus = db.prepare('SELECT at FROM status WHERE place_id = ?');
const putStatus = db.prepare(
  'INSERT INTO status (place_id, value, by, at) VALUES (?, ?, ?, ?) ON CONFLICT(place_id) DO UPDATE SET value = excluded.value, by = excluded.by, at = excluded.at',
);
const getRoute = db.prepare('SELECT at FROM routes WHERE id = ?');
const putRoute = db.prepare(
  'INSERT INTO routes (id, name, stops, by, at, deleted) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, stops = excluded.stops, by = excluded.by, at = excluded.at, deleted = excluded.deleted',
);

function state() {
  const statuses = {};
  for (const r of db.prepare('SELECT place_id, value, by, at FROM status').all()) statuses[r.place_id] = { value: r.value, by: r.by, at: r.at };
  const routes = db
    .prepare('SELECT id, name, stops, by, at, deleted FROM routes')
    .all()
    .map((r) => ({ id: r.id, name: r.name, stops: JSON.parse(r.stops), by: r.by, at: r.at, deleted: Boolean(r.deleted) }));
  return { statuses, routes, now: Date.now() };
}

const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isId = (v) => typeof v === 'string' && /^[a-z0-9-]{1,40}$/i.test(v);

/** Valida y aplica un cambio. Gana el más reciente (`at`); devuelve un error en texto o null. */
function apply(op) {
  if (!op || typeof op !== 'object') return 'cambio vacío';
  if (!str(op.by, 30)) return 'falta quién';
  // Un móvil con la hora muy adelantada no puede «ganar» para siempre
  const at = Math.min(Number(op.at), Date.now() + 5 * 60_000);
  if (!Number.isFinite(at) || at <= 0) return 'hora no válida';

  if (op.type === 'status') {
    if (!isId(op.placeId) || (placeIds && !placeIds.has(op.placeId))) return 'sitio desconocido';
    if (op.value !== null && !STATUSES.has(op.value)) return 'estado no válido';
    const cur = getStatus.get(op.placeId);
    if (!cur || at >= cur.at) putStatus.run(op.placeId, op.value, op.by.trim(), at);
    return null;
  }
  if (op.type === 'route') {
    const r = op.route;
    if (!r || !isId(r.id)) return 'ruta sin id';
    if (!str(r.name, 80)) return 'ruta sin nombre';
    if (!Array.isArray(r.stops) || r.stops.length > 40 || !r.stops.every(isId)) return 'paradas no válidas';
    if (placeIds && !r.stops.every((s) => placeIds.has(s))) return 'parada desconocida';
    const cur = getRoute.get(r.id);
    if (!cur || at >= cur.at) putRoute.run(r.id, r.name.trim(), JSON.stringify(r.stops), op.by.trim(), at, r.deleted ? 1 : 0);
    return null;
  }
  return 'tipo de cambio desconocido';
}

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const server = createServer(app);
app.use((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, mcp: mcpEnabled, oauth_consent_version:3, ...(mcpError ? {mcp_error:mcpError} : {}), catalog_revision:catalog.getRevision() });
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, state());
  if (req.method === 'POST' && url.pathname === '/api/ops') {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) req.destroy();
      else chunks.push(c);
    });
    req.on('end', () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return send(res, 400, { error: 'JSON no válido' });
      }
      if (!Array.isArray(body?.ops) || body.ops.length > 200) return send(res, 400, { error: 'se esperaba {ops: [...]}' });
      loadPlaces();
      const errors = [];
      db.exec('BEGIN');
      try {
        body.ops.forEach((op, i) => {
          const e = apply(op);
          if (e) errors.push({ index: i, error: e });
        });
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        return send(res, 500, { error: String(e) });
      }
      // Los cambios no válidos se descartan (y se dicen) para que no bloqueen la cola del móvil
      return send(res, 200, { ...state(), errors });
    });
    return;
  }
  send(res, 404, { error: 'no existe' });
});

server.listen(PORT, () => console.log(`china-map API en :${PORT} (${DB_PATH})`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
