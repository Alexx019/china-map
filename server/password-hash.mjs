// Solo usa Node: generar el hash no requiere instalar el servidor ni cargar Sharp.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  if (password.length < 12 || password.length > 200) throw new Error('Usar una contraseña de entre 12 y 200 caracteres');
  const salt = randomBytes(16).toString('base64url');
  return `scrypt$${salt}$${(await scrypt(password, salt, 64)).toString('base64url')}`;
}
export async function checkPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 200) return false;
  const [algorithm, salt, expected] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const wanted = Buffer.from(expected, 'base64url');
  const actual = await scrypt(password, salt, 64);
  return wanted.length === actual.length && timingSafeEqual(wanted, actual);
}
