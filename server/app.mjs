import express from 'express';
import { join } from 'node:path';
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createCatalog } from './catalog.mjs';
import { createAuth, SCOPES } from './auth.mjs';
import { createMapMcp } from './mcp.mjs';

export function createApplication({ db, seedPath, manifestPath, mediaDirectory, publicUrl, passwordHash = '', allowedOrigins = [] }) {
  const app = express();
  app.disable('x-powered-by');
  const catalog = createCatalog(db, seedPath, manifestPath);
  app.get('/data/places.json', (_req,res) => res.set('Cache-Control','no-cache').json(catalog.document()));
  app.get('/data/thumbs/photos.json', (_req,res) => res.set('Cache-Control','no-cache').json(catalog.photoManifest()));
  // Solo las imágenes normalizadas por el MCP; las fotos del repo las sigue sirviendo Caddy.
  app.get(/^\/data\/(photos|thumbs\/[sm])\/(mcp-[a-f0-9-]{36}\.jpg)$/, (req,res) => {
    res.set('Cache-Control','public, max-age=31536000, immutable');
    res.sendFile(join(mediaDirectory, req.params[0], req.params[1]));
  });
  if (!passwordHash) {
    app.all('/mcp', (_req,res) => res.status(503).json({ error:'MCP desactivado: configurar MCP_PASSWORD_HASH en Portainer' }));
    return { app, catalog, mcpEnabled:false };
  }
  if (!/^scrypt\$[\w-]{22}\$[\w-]{86}$/.test(passwordHash)) throw new Error('MCP_PASSWORD_HASH debe generarse con server/password.mjs');
  const parsedUrl = new URL(publicUrl);
  if (parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash || (parsedUrl.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(parsedUrl.hostname))) throw new Error('MCP_PUBLIC_URL debe ser un origen HTTPS sin ruta');
  const { provider, consent, resource, origin } = createAuth(db, publicUrl, passwordHash);
  app.use(mcpAuthRouter({ provider, issuerUrl:new URL(origin), resourceServerUrl:new URL(resource), scopesSupported:SCOPES, resourceName:'china-map' }));
  app.post('/mcp/consent', express.urlencoded({ extended:false, limit:'4kb' }), consent);
  const acceptedOrigins = new Set([origin, ...allowedOrigins]);
  app.all('/mcp', (req,res,next) => {
    const host = String(req.headers.host ?? '').split(':')[0];
    if (![parsedUrl.hostname,'localhost','127.0.0.1'].includes(host)) return res.status(403).json({error:'Host no permitido'});
    const requestOrigin = req.headers.origin;
    if (requestOrigin && !acceptedOrigins.has(requestOrigin)) return res.status(403).json({error:'Origin no permitido'});
    if (requestOrigin) { res.set('Access-Control-Allow-Origin',requestOrigin); res.vary('Origin'); }
    res.set('Access-Control-Expose-Headers','WWW-Authenticate, MCP-Protocol-Version');
    if (req.method === 'OPTIONS') return res.set('Access-Control-Allow-Methods','POST, GET, DELETE, OPTIONS')
      .set('Access-Control-Allow-Headers','Authorization, Content-Type, Accept, MCP-Protocol-Version').sendStatus(204);
    next();
  }, requireBearerAuth({ verifier:provider, requiredScopes:['map:read'], expectedResource:new URL(resource), resourceMetadataUrl:getOAuthProtectedResourceMetadataUrl(new URL(resource)) }),
  express.json({limit:'18mb'}), async (req,res) => {
    res.set('Cache-Control','no-store');
    if (req.method !== 'POST') return res.status(405).set('Allow','POST').json({error:'MCP Streamable HTTP sin sesiones; usar POST'});
    const mcp = createMapMcp(catalog, req.auth, mediaDirectory);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator:undefined, enableJsonResponse:true });
    res.on('close', () => { void transport.close(); void mcp.close(); });
    try { await mcp.connect(transport); await transport.handleRequest(req,res,req.body); }
    catch { if (!res.headersSent) res.status(500).json({jsonrpc:'2.0',id:null,error:{code:-32603,message:'Error interno MCP'}}); }
  });
  return { app, catalog, provider, mcpEnabled:true };
}
