import readline from 'node:readline';
import { hashPassword } from './password-hash.mjs';

if (!process.stdin.isTTY) throw new Error('Ejecutar en una consola interactiva: npm --prefix server run password');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdout.write('Contraseña nueva del propietario (mínimo 12 caracteres; no se muestra): ');
let password = '';
process.stdin.on('keypress', async (text, key) => {
  if (key.ctrl && key.name === 'c') { process.stdin.setRawMode(false); process.exit(1); }
  if (key.name === 'return') {
    process.stdin.setRawMode(false); process.stdin.pause();
    try { process.stdout.write(`\nMCP_PASSWORD_HASH=${await hashPassword(password)}\n`); }
    catch (e) { console.error(`\n${e.message}`); process.exitCode = 1; }
  } else if (key.name === 'backspace') password = password.slice(0, -1);
  else if (text && !key.ctrl && !key.meta && password.length < 200) password += text;
});
