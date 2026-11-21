import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, checkPassword, parsePasswordHash } from './password-hash.mjs';

test('genera hashes sin dólares y admite el formato anterior', async () => {
  const password = 'test-password-never-used-in-production';
  const hash = await hashPassword(password);
  assert.ok(hash.startsWith('scrypt:'));
  assert.equal(hash.includes('$'),false);
  assert.equal(hash.length,116);
  assert.ok(await checkPassword(password,hash));
  assert.equal(await checkPassword('incorrecta',hash),false);
  assert.ok(await checkPassword(password,hash.replaceAll(':','$')));
  for (const invalid of ['scrypt:incompleto','MCP_PASSWORD_HASH='+hash,'"'+hash+'"',hash.replace(':','$')]) assert.equal(parsePasswordHash(invalid),null);
});
