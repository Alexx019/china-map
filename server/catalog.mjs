import { readFileSync } from 'node:fs';
import { placeSchema, placePatch, regionSchema, zoneSchema } from './schema.mjs';

export function createCatalog(db, seedPath, manifestPath) {
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  let manifest = {};
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const seedPhotos = new Set(seed.places.flatMap(p => p.photos));
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_edits(kind TEXT NOT NULL,id TEXT NOT NULL,json TEXT,PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS catalog_revision(id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER NOT NULL);
    INSERT OR IGNORE INTO catalog_revision VALUES(1,0);
    CREATE TABLE IF NOT EXISTS catalog_photos(path TEXT PRIMARY KEY,meta TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS catalog_audit(id INTEGER PRIMARY KEY,at INTEGER NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,entity TEXT NOT NULL,before_json TEXT,after_json TEXT);
  `);
  const getRevision = () => Number(db.prepare('SELECT value FROM catalog_revision WHERE id=1').get().value);
  function document() {
    const result = structuredClone(seed);
    for (const kind of ['places', 'regions', 'zones']) {
      const entries = new Map(result[kind].map(p => [p.id, p]));
      for (const edit of db.prepare('SELECT id,json FROM catalog_edits WHERE kind=?').all(kind)) {
        if (edit.json === null) entries.delete(edit.id); else entries.set(edit.id, JSON.parse(edit.json));
      }
      result[kind] = [...entries.values()];
    }
    return { ...result, revision: getRevision() };
  }
  function photoManifest() {
    return { ...manifest, ...Object.fromEntries(db.prepare('SELECT path,meta FROM catalog_photos').all().map(r => [r.path, JSON.parse(r.meta)])) };
  }
  function photoExists(path) {
    return seedPhotos.has(path) || Boolean(db.prepare('SELECT 1 FROM catalog_photos WHERE path=?').get(path));
  }
  function validate(kind, input, doc) {
    const value = ({ places: placeSchema, regions: regionSchema, zones: zoneSchema })[kind].parse(input);
    if (kind === 'places') {
      if (!doc.regions.some(r => r.id === value.region)) throw new Error('Región inexistente');
      if (!doc.zones.some(z => z.id === value.zone && z.region === value.region)) throw new Error('Zona inexistente o de otra región');
      if ((value.lat === null) !== (value.lng === null)) throw new Error('lat y lng deben estar ambas informadas o ambas en null');
      for (const photo of value.photos) if (!photoExists(photo)) throw new Error(`Foto no registrada: ${photo}. Importarla primero con add_photo.`);
      if (value.practical?.sources.length === 0 && Object.entries(value.practical).some(([k,v]) => !['sources','verified_at'].includes(k) && typeof v === 'string')) throw new Error('La información práctica necesita fuentes');
    }
    if (kind === 'zones' && !doc.regions.some(r => r.id === value.region)) throw new Error('Región inexistente');
    if (kind === 'zones' && doc.places.some(p => p.zone === value.id && p.region !== value.region)) throw new Error('No se puede mover una zona con sitios a otra región');
    return value;
  }
  function change(kind, entityId, value, expectedRevision, actor, action) {
    db.exec('BEGIN IMMEDIATE');
    try {
      if (getRevision() !== expectedRevision) throw new Error('CONFLICT: el catálogo ha cambiado; consultar de nuevo antes de editar');
      const doc = document();
      const before = doc[kind].find(p => p.id === entityId) ?? null;
      if (action === 'create' && before) throw new Error('El identificador ya existe');
      if (action !== 'create' && !before) throw new Error('No existe el elemento');
      if (value !== null) value = validate(kind, value, doc);
      else {
        if (kind === 'regions' && (doc.places.some(p => p.region === entityId) || doc.zones.some(z => z.region === entityId))) throw new Error('La región tiene zonas o sitios asociados');
        if (kind === 'zones' && doc.places.some(p => p.zone === entityId)) throw new Error('La zona tiene sitios asociados');
        if (kind === 'places' && db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='routes'").get()) {
          const used = db.prepare('SELECT name,stops FROM routes WHERE deleted=0').all().filter(r => JSON.parse(r.stops).includes(entityId));
          if (used.length) throw new Error('El sitio está en una ruta activa; quitarlo de la ruta antes de borrarlo');
        }
      }
      db.prepare('INSERT OR REPLACE INTO catalog_edits VALUES(?,?,?)').run(kind, entityId, value === null ? null : JSON.stringify(value));
      db.prepare('UPDATE catalog_revision SET value=value+1 WHERE id=1').run();
      db.prepare('INSERT INTO catalog_audit(at,actor,action,entity,before_json,after_json) VALUES(?,?,?,?,?,?)')
        .run(Date.now(), actor, action, `${kind}/${entityId}`, before ? JSON.stringify(before) : null, value ? JSON.stringify(value) : null);
      db.exec('COMMIT');
      return { revision: getRevision(), value };
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  function updatePlace(entityId, patch, expectedRevision, actor) {
    patch = placePatch.parse(patch);
    const before = document().places.find(p => p.id === entityId);
    if (!before) throw new Error('Sitio inexistente');
    const after = { ...before, ...patch };
    for (const key of ['practical', 'geo']) {
      if (patch[key] === null) delete after[key];
      else if (patch[key] !== undefined) after[key] = { ...before[key], ...patch[key] };
    }
    return change('places', entityId, after, expectedRevision, actor, 'update');
  }
  return { document, photoManifest, photoExists, getRevision, change, updatePlace,
    registerPhoto: (path, meta) => db.prepare('INSERT INTO catalog_photos VALUES(?,?)').run(path, JSON.stringify(meta)),
    audit: limit => db.prepare('SELECT id,at,actor,action,entity,before_json,after_json FROM catalog_audit ORDER BY id DESC LIMIT ?').all(limit),
  };
}
