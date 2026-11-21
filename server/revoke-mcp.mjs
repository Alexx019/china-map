import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.env.DB_PATH ?? './data/china-map.db');
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--list') {
    const clients = db.prepare('SELECT id,json FROM oauth_clients').all();
    console.log(JSON.stringify(clients.map(row => ({ id:row.id, name:JSON.parse(row.json).client_name ?? '(sin nombre)' })),null,2));
  } else if (args.length === 1 && args[0] === '--all') {
    console.log(`Tokens revocados: ${db.prepare('UPDATE oauth_tokens SET revoked=1 WHERE revoked=0').run().changes}`);
  } else if (args.length === 2 && args[0] === '--client') {
    console.log(`Tokens revocados: ${db.prepare('UPDATE oauth_tokens SET revoked=1 WHERE client=? AND revoked=0').run(args[1]).changes}`);
  } else throw new Error('Uso: node revoke-mcp.mjs --list | --all | --client ID');
} finally { db.close(); }
