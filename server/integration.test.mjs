import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApplication } from './app.mjs';
import { createCatalog } from './catalog.mjs';
import { hashPassword, consentOriginAllowed } from './auth.mjs';
import { publicAddress, downloadImage, saveImage } from './media.mjs';

const repo = resolve(import.meta.dirname, '..');
const password = 'test-password-not-a-production-secret';
const seedPath = join(repo,'public/data/places.json');
const manifestPath = join(repo,'public/data/thumbs/photos.json');
const seed = JSON.parse(await readFile(seedPath,'utf8'));

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(),'china-map-mcp-test-'));
  const dbPath = join(directory,'data.db');
  const db = new DatabaseSync(dbPath);
  const server = createServer();
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const passwordHash = await hashPassword(password);
  const app = createApplication({db,seedPath,manifestPath,mediaDirectory:join(directory,'media'),publicUrl:origin,passwordHash});
  server.on('request',app.app);
  t.after(async () => { server.closeAllConnections(); await new Promise(r=>server.close(r)); db.close(); await rm(directory,{recursive:true,force:true}); });
  // HTTP directo conserva Fetch Metadata tal como lo enviaría una navegación.
  // fetch() de Node sustituye Sec-Fetch-Mode por el modo de su propia petición.
  const form = (path, body, extra={}) => new Promise((resolve,reject) => {
    const payload = new URLSearchParams(body).toString();
    const req = httpRequest(origin+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(payload),...extra}},res=>{
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:Object.entries(res.headers).flatMap(([key,value])=>(Array.isArray(value)?value:[value]).map(item=>[key,item]))})));
      res.on('error',reject);
    });
    req.on('error',reject); req.end(payload);
  });
  async function login(scopes='map:read map:write', opaqueOrigin=false) {
    const registration = await fetch(origin+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      client_name:'Integration test',redirect_uris:['http://127.0.0.1/callback'],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',
    })});
    assert.equal(registration.status,201,await registration.clone().text());
    const client = await registration.json();
    const verifier = randomBytes(32).toString('base64url');
    const query = new URLSearchParams({ response_type:'code',client_id:client.client_id,redirect_uri:client.redirect_uris[0],
      code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',scope:scopes,resource:origin+'/mcp',state:'preserved-state' });
    const authorize = await fetch(origin+'/authorize?'+query,{redirect:'manual'});
    assert.equal(authorize.status,200,await authorize.clone().text());
    assert.equal(authorize.headers.get('referrer-policy'),'same-origin');
    const html = await authorize.text();
    const transaction = html.match(/name="transaction" value="([\w-]+)"/)[1];
    const cookie = authorize.headers.get('set-cookie').split(';')[0];
    const fetchMetadata = {'Sec-Fetch-Site':'same-origin','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'};
    const csrf = await form('/mcp/consent',{transaction,password},{Origin:'https://evil.example',Cookie:cookie,...fetchMetadata});
    assert.equal(csrf.status,403);
    const opaqueRejected = await form('/mcp/consent',{transaction,password},{Origin:'null',Cookie:cookie});
    assert.equal(opaqueRejected.status,403,'Un origen opaco sin Fetch Metadata no debe saltarse la protección CSRF');
    const noCookie = await form('/mcp/consent',{transaction,password},{Origin:'null',...fetchMetadata});
    assert.equal(noCookie.status,403,'Fetch Metadata no sustituye la cookie de consentimiento');
    const consent = await form('/mcp/consent',{transaction,password},opaqueOrigin ? {Origin:'null',Cookie:cookie,...fetchMetadata} : {Origin:origin,Cookie:cookie});
    assert.equal(consent.status,200,await consent.clone().text());
    assert.equal(consent.headers.get('location'),null,'El POST no redirige fuera del origen: Chromium lo bloquea con form-action self');
    const completed = await consent.text();
    assert.match(completed, /http-equiv="refresh"/);
    assert.match(completed, /name="referrer" content="no-referrer"/);
    assert.doesNotMatch(completed, /<form|<script/);
    assert.ok(!completed.includes(password),'La contraseña no sale en la página de regreso');
    const redirect = new URL(completed.match(/<a href="([^"]+)"/)[1].replaceAll('&amp;','&'));
    const repeated = await form('/mcp/consent',{transaction,password},{Origin:origin,Cookie:cookie});
    assert.equal(repeated.status,400,'La autorización completada no se puede reenviar');
    assert.equal(redirect.searchParams.get('state'),'preserved-state');
    const exchange = { grant_type:'authorization_code',client_id:client.client_id,code:redirect.searchParams.get('code'),redirect_uri:client.redirect_uris[0],code_verifier:verifier,resource:origin+'/mcp' };
    const invalid = await form('/token',{...exchange,code_verifier:randomBytes(32).toString('base64url')});
    assert.equal(invalid.status,400,'PKCE incorrecto debe rechazarse');
    const token = await form('/token',exchange);
    assert.equal(token.status,200,await token.clone().text());
    const tokens = await token.json();
    assert.equal((await form('/token',exchange)).status,400,'No se puede reutilizar el código');
    return {client,tokens};
  }
  async function mcp(token) {
    const client = new Client({name:'integration-client',version:'1.0.0'});
    await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{ requestInit:{headers:{Authorization:`Bearer ${token}`}} }));
    t.after(()=>client.close());
    return client;
  }
  return {...app,db,dbPath,directory,origin,form,login,mcp};
}

test('OAuth/PKCE y cliente MCP oficial: catálogo completo, fotos, revisiones y persistencia', async t => {
  const f = await fixture(t);
  const unauthorized = await fetch(f.origin+'/mcp',{method:'POST'});
  assert.equal(unauthorized.status,401);
  assert.match(unauthorized.headers.get('www-authenticate'),/oauth-protected-resource\/mcp/);
  const metadata = await (await fetch(f.origin+'/.well-known/oauth-protected-resource/mcp')).json();
  assert.equal(metadata.resource,f.origin+'/mcp');
  const {tokens} = await f.login();
  const client = await f.mcp(tokens.access_token);
  const list = await client.listTools();
  assert.ok(list.tools.some(t=>t.name==='add_photo'));
  assert.ok(list.tools.some(t=>t.name==='update_zone'));
  const call = async (name,args={}) => {
    const response = await client.callTool({name,arguments:args});
    assert.equal(response.isError,undefined,JSON.stringify(response));
    return response.structuredContent;
  };
  const info = await call('get_catalog_info');
  assert.equal(info.revision,0);
  const point = {...seed.places[0],id:'mcp-integration-test',name:'Punto creado desde MCP',photos:[]};
  const created = await call('create_place',{place:point,expected_revision:0});
  assert.equal(created.revision,1);
  const conflict = await client.callTool({name:'update_place',arguments:{id:point.id,patch:{name:'Cambio obsoleto'},expected_revision:0}});
  assert.equal(conflict.isError,true);
  assert.match(conflict.content[0].text,/CONFLICT/);
  const png = await sharp({create:{width:32,height:24,channels:3,background:'#337755'}}).png().toBuffer();
  const added = await call('add_photo',{place_id:point.id,base64:png.toString('base64'),expected_revision:1});
  assert.equal(added.revision,2);
  const photo = added.photo.path;
  const image = await fetch(f.origin+'/data/'+photo);
  assert.equal(image.status,200);
  const decoded = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
  assert.equal(decoded.format,'jpeg'); assert.equal(decoded.width,32);
  assert.equal((await fetch(f.origin+'/data/thumbs/s/'+photo.split('/').pop())).status,200);
  const manifest = await (await fetch(f.origin+'/data/thumbs/photos.json')).json();
  assert.equal(manifest[photo].w,32);
  const updated = await call('update_place',{id:point.id,patch:{why:'Descripción nueva',tips:[{text:'Una recomendación',source:{url:'https://example.com/source',title:'Fuente'}}],practical:{hours:'10:00–18:00',verified_at:'2026-11-21',sources:[{url:'https://example.com/hours',title:'Horario',fields:['hours']}]}},expected_revision:2});
  assert.equal(updated.revision,3);
  const publicDoc = await (await fetch(f.origin+'/data/places.json')).json();
  assert.equal(publicDoc.places.find(p=>p.id===point.id).why,'Descripción nueva');
  assert.equal((await call('get_place',{id:point.id})).place.photos[0],photo);
  const reopened = new DatabaseSync(f.dbPath);
  try { assert.equal(createCatalog(reopened,seedPath,manifestPath).document().places.find(p=>p.id===point.id).name,point.name); } finally { reopened.close(); }
  assert.ok((await call('get_edit_history')).history.length>=3);
  assert.equal((await call('export_catalog')).catalog.revision,3);
});

test('permisos de solo lectura, audiencia, renovación y revocación', async t => {
  const f = await fixture(t);
  const {client:registered,tokens} = await f.login('map:read',true);
  const client = await f.mcp(tokens.access_token);
  const write = await client.callTool({name:'delete_place',arguments:{id:seed.places[0].id,expected_revision:0,confirm:true}});
  assert.equal(write.isError,true); assert.match(write.content[0].text,/map:write/);
  const wrongResource = await f.form('/token',{grant_type:'refresh_token',client_id:registered.client_id,refresh_token:tokens.refresh_token,resource:'https://other.example/mcp'});
  assert.equal(wrongResource.status,400);
  const refreshed = await f.form('/token',{grant_type:'refresh_token',client_id:registered.client_id,refresh_token:tokens.refresh_token,resource:f.origin+'/mcp'});
  assert.equal(refreshed.status,200,await refreshed.clone().text());
  const next = await refreshed.json();
  assert.ok(next.refresh_token !== tokens.refresh_token);
  const reused = await f.form('/token',{grant_type:'refresh_token',client_id:registered.client_id,refresh_token:tokens.refresh_token});
  assert.equal(reused.status,400);
  await assert.rejects(f.provider.verifyAccessToken(next.access_token));
  const second = await f.login('map:read');
  await f.provider.revokeToken(second.client,{token:second.tokens.refresh_token});
  await assert.rejects(f.provider.verifyAccessToken(second.tokens.access_token));
  const origin = await fetch(f.origin+'/mcp',{method:'POST',headers:{Origin:'https://evil.example',Authorization:`Bearer ${tokens.access_token}`}});
  assert.equal(origin.status,403);
});

test('fotos: bloqueo de SSRF, formatos activos y datos inválidos', async () => {
  for (const address of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','100.64.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1']) assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress('1.1.1.1'),true);
  await assert.rejects(downloadImage('https://127.0.0.1/secret'),/privadas/);
  await assert.rejects(downloadImage('http://example.com/photo.jpg'),/HTTPS/);
  await assert.rejects(saveImage({base64:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64')},tmpdir()),/Formato/);
});

test('una variable MCP incorrecta no tumba el catálogo y mantiene la edición cerrada', async () => {
  const goodHash = await hashPassword(password);
  for (const config of [
    {passwordHash:'scrypt$incompleto',publicUrl:'https://china.ariassouto.es',error:'MCP_PASSWORD_HASH_INVALID'},
    {passwordHash:goodHash,publicUrl:'https://china.ariassouto.es/mcp',error:'MCP_PUBLIC_URL_INVALID'},
    {passwordHash:goodHash,publicUrl:'no-es-una-url',error:'MCP_PUBLIC_URL_INVALID'},
  ]) {
    const db = new DatabaseSync(':memory:');
    try {
      const app = createApplication({db,seedPath,manifestPath,mediaDirectory:tmpdir(),...config});
      assert.equal(app.mcpEnabled,false);
      assert.equal(app.mcpError,config.error);
      assert.equal(app.catalog.document().places.length,seed.places.length);
    } finally { db.close(); }
  }
});

test('Fetch Metadata solo permite formularios same-origin, nunca cross-site ni subdominios', () => {
  const origin = 'https://china.ariassouto.es';
  const good = {'sec-fetch-site':'same-origin','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
  assert.equal(consentOriginAllowed({origin},origin),true);
  assert.equal(consentOriginAllowed({origin:'null',...good},origin),true);
  assert.equal(consentOriginAllowed(good,origin),true);
  assert.equal(consentOriginAllowed({origin:'https://evil.example',...good},origin),false);
  assert.equal(consentOriginAllowed({origin:'null',...good,'sec-fetch-site':'cross-site'},origin),false);
  assert.equal(consentOriginAllowed({origin:'null',...good,'sec-fetch-site':'same-site'},origin),false);
  assert.equal(consentOriginAllowed({origin:'null'},origin),false);
});
