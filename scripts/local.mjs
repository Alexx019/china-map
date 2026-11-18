#!/usr/bin/env node
// Arranca la web (Vite) y la API a la vez para probar en el ordenador: npm run local
// Con --prod sirve el build de producción (con service worker y modo sin conexión): npm run local -- --prod
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const prod = process.argv.includes('--prod');
const run = (name, cmd, args, env = {}) => {
  const p = spawn(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' });
  p.on('exit', (code) => {
    console.log(`[${name}] terminó (${code})`);
    process.exit(code ?? 0);
  });
  return p;
};

const procs = [run('api', 'node', ['server/index.mjs'], { PLACES_PATH: 'public/data/places.json', DB_PATH: '.cache/dev.db' })];
if (prod) {
  const build = spawn('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  build.on('exit', (code) => {
    if (code) process.exit(code);
    procs.push(run('web', 'npx', ['vite', 'preview', '--host']));
    console.log('\n  Abre http://localhost:4173 (producción: service worker y modo sin conexión)\n');
  });
} else {
  procs.push(run('web', 'npx', ['vite', '--host']));
  console.log('\n  Abre http://localhost:5173\n');
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => procs.forEach((p) => p.kill(sig)));
