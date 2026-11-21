import { randomBytes, createHash } from 'node:crypto';
import { checkPassword } from './password-hash.mjs';
export { hashPassword, checkPassword } from './password-hash.mjs';
import { InvalidGrantError, InvalidTokenError, InvalidScopeError, InvalidTargetError, InvalidRequestError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

const random = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const now = () => Math.floor(Date.now() / 1000);
export const SCOPES = ['map:read', 'map:write'];
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);

export function createAuth(db, publicUrl, passwordHash) {
  const origin = new URL(publicUrl).origin;
  const resource = `${origin}/mcp`;
  const secure = origin.startsWith('https:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_clients(id TEXT PRIMARY KEY,json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_pending(id TEXT PRIMARY KEY,json TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_codes(id TEXT PRIMARY KEY,json TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_tokens(hash TEXT PRIMARY KEY,kind TEXT NOT NULL,client TEXT NOT NULL,scopes TEXT NOT NULL,expires INTEGER NOT NULL,family TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS oauth_attempts(bucket INTEGER PRIMARY KEY,count INTEGER NOT NULL);
  `);
  const clientsStore = {
    getClient: clientId => { const row = db.prepare('SELECT json FROM oauth_clients WHERE id=?').get(clientId); return row ? JSON.parse(row.json) : undefined; },
    registerClient: client => {
      if (!client.redirect_uris?.length || client.redirect_uris.length > 20 || client.redirect_uris.some(value => {
        const url = new URL(value);
        return value.length > 2048 || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)));
      })) throw new InvalidRequestError('Las redirect_uris deben usar HTTPS o HTTP en loopback');
      if (db.prepare('SELECT count(*) AS n FROM oauth_clients').get().n >= 1000) throw new Error('Límite de clientes alcanzado');
      const stored = { ...client, client_id: random(), client_id_issued_at: now() };
      db.prepare('INSERT INTO oauth_clients VALUES(?,?)').run(stored.client_id, JSON.stringify(stored));
      return stored;
    },
  };
  function checkResource(value) {
    if (value && value.href.replace(/\/$/, '') !== resource) throw new InvalidTargetError('El token solo es válido para este mapa');
  }
  function codeData(client, code) {
    const row = db.prepare('SELECT json,expires FROM oauth_codes WHERE id=?').get(hash(code));
    if (!row || row.expires <= now()) throw new InvalidGrantError('Código caducado o consumido');
    const data = JSON.parse(row.json);
    if (data.client !== client.client_id) throw new InvalidGrantError('El código pertenece a otro cliente');
    return data;
  }
  function issue(client, scopes, family = random()) {
    const access = random(), refresh = random();
    const insert = db.prepare('INSERT INTO oauth_tokens(hash,kind,client,scopes,expires,family) VALUES(?,?,?,?,?,?)');
    insert.run(hash(access), 'access', client.client_id, JSON.stringify(scopes), now() + 3600, family);
    insert.run(hash(refresh), 'refresh', client.client_id, JSON.stringify(scopes), now() + 30 * 86400, family);
    return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: 3600, scope: scopes.join(' ') };
  }
  const provider = {
    clientsStore,
    async authorize(client, params, res) {
      checkResource(params.resource);
      const scopes = params.scopes?.length ? params.scopes : SCOPES;
      if (scopes.some(s => !SCOPES.includes(s)) || !scopes.includes('map:read')) throw new InvalidScopeError('Solicitar map:read y opcionalmente map:write');
      db.prepare('DELETE FROM oauth_pending WHERE expires<?').run(now());
      const transaction = random();
      const pending = { client: client.client_id, redirectUri: params.redirectUri, state: params.state, scopes, codeChallenge: params.codeChallenge };
      db.prepare('INSERT INTO oauth_pending VALUES(?,?,?)').run(hash(transaction), JSON.stringify(pending), now() + 600);
      res.setHeader('Cache-Control', 'no-store');
      res.cookie(`cm_auth_${transaction.slice(0,12)}`, transaction, { httpOnly: true, secure, sameSite: 'lax', maxAge: 600000, path: '/mcp/consent' });
      const write = scopes.includes('map:write');
      res.type('html').send(`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><title>Autorizar china-map</title>
      <style>body{font:16px system-ui;background:#f2f3f5;padding:32px}main{max-width:440px;margin:8vh auto;background:white;padding:28px;border-radius:20px}input,button{box-sizing:border-box;width:100%;padding:14px;margin-top:16px}button{background:#151719;color:white;border:0;border-radius:12px}small{overflow-wrap:anywhere}</style>
      <main><h1>Conectar con tu mapa</h1><p>Cliente: <strong>${escape(client.client_name || client.client_id)}</strong></p>
      <p>Permisos: consultar${write ? ' y editar sitios, fotos, regiones y zonas' : ' el catálogo'}.</p>
      <small>Destino autorizado: ${escape(params.redirectUri)}</small>
      <form method="post" action="/mcp/consent"><input type="hidden" name="transaction" value="${transaction}">
      <label>Contraseña del propietario<input type="password" name="password" autocomplete="current-password" required maxlength="200"></label>
      <button type="submit">${write ? 'Autorizar lectura y edición' : 'Autorizar solo lectura'}</button></form>
      <p>Autoriza únicamente clientes que hayas conectado tú. Esta contraseña protege el MCP; la web sigue siendo pública.</p></main></html>`);
    },
    async challengeForAuthorizationCode(client, code) { return codeData(client, code).codeChallenge; },
    async exchangeAuthorizationCode(client, code, _verifier, redirectUri, target) {
      checkResource(target);
      const data = codeData(client, code);
      if (redirectUri !== data.redirectUri) throw new InvalidGrantError('redirect_uri no coincide');
      db.exec('BEGIN IMMEDIATE');
      try {
        const deleted = db.prepare('DELETE FROM oauth_codes WHERE id=?').run(hash(code));
        if (!deleted.changes) throw new InvalidGrantError('Código consumido');
        const tokens = issue(client, data.scopes); db.exec('COMMIT'); return tokens;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    async exchangeRefreshToken(client, token, scopes, target) {
      checkResource(target);
      const row = db.prepare("SELECT * FROM oauth_tokens WHERE hash=? AND kind='refresh'").get(hash(token));
      if (!row || row.client !== client.client_id || row.expires <= now()) throw new InvalidGrantError('Refresh token no válido');
      if (row.revoked) {
        db.prepare('UPDATE oauth_tokens SET revoked=1 WHERE family=?').run(row.family);
        throw new InvalidGrantError('Refresh token reutilizado; conexión revocada');
      }
      const granted = JSON.parse(row.scopes);
      if (scopes?.some(s => !granted.includes(s))) throw new InvalidScopeError('No se pueden ampliar permisos al renovar');
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE oauth_tokens SET revoked=1 WHERE hash=?').run(hash(token));
        const tokens = issue(client, scopes ?? granted, row.family); db.exec('COMMIT'); return tokens;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    async verifyAccessToken(token) {
      const row = db.prepare("SELECT * FROM oauth_tokens WHERE hash=? AND kind='access'").get(hash(token));
      if (!row || row.revoked || row.expires <= now()) throw new InvalidTokenError('Token no válido o caducado');
      return { token, clientId: row.client, scopes: JSON.parse(row.scopes), expiresAt: row.expires, resource: new URL(resource) };
    },
    async revokeToken(client, request) {
      const row = db.prepare('SELECT family FROM oauth_tokens WHERE hash=? AND client=?').get(hash(request.token), client.client_id);
      if (row) db.prepare('UPDATE oauth_tokens SET revoked=1 WHERE family=?').run(row.family);
    },
  };
  async function consent(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin !== origin) return res.status(403).send('Origen no válido');
    const transaction = req.body.transaction;
    if (typeof transaction !== 'string' || !/^[\w-]{43}$/.test(transaction)) return res.status(400).send('Solicitud no válida');
    const cookieName = `cm_auth_${transaction.slice(0,12)}`;
    const cookie = String(req.headers.cookie ?? '').split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`));
    if (cookie !== `${cookieName}=${transaction}`) return res.status(403).send('La autorización debe completarse en el mismo navegador');
    const row = db.prepare('SELECT json,expires FROM oauth_pending WHERE id=?').get(hash(transaction));
    if (!row || row.expires <= now()) return res.status(400).send('Solicitud caducada; vuelve a conectar');
    const bucket = Math.floor(now() / 600);
    db.prepare('DELETE FROM oauth_attempts WHERE bucket<?').run(bucket);
    db.prepare('INSERT INTO oauth_attempts VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1').run(bucket);
    if (db.prepare('SELECT count FROM oauth_attempts WHERE bucket=?').get(bucket).count > 20) return res.status(429).send('Demasiados intentos; espera diez minutos');
    if (!(await checkPassword(req.body.password, passwordHash))) return res.status(403).send('Contraseña incorrecta; vuelve atrás para reintentar');
    const pending = JSON.parse(row.json);
    // Eliminar atómicamente la transacción antes de emitir un código de un solo uso.
    const removed = db.prepare('DELETE FROM oauth_pending WHERE id=?').run(hash(transaction));
    if (!removed.changes) return res.status(400).send('Solicitud ya consumida');
    const code = random();
    db.prepare('INSERT INTO oauth_codes VALUES(?,?,?)').run(hash(code), JSON.stringify(pending), now() + 120);
    res.clearCookie(cookieName, { path: '/mcp/consent', httpOnly: true, secure, sameSite: 'lax' });
    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set('code', code);
    if (pending.state !== undefined) redirect.searchParams.set('state', pending.state);
    res.redirect(303, redirect.href);
  }
  return { provider, consent, resource, origin };
}
