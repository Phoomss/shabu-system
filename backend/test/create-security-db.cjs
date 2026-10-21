const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
if (process.env.ALLOW_SHABU_TEST_DB !== '1')
  throw new Error('Explicit isolated DB opt-in required');
const url = new URL(
  process.env.SHABU_TEST_ADMIN_URL || 'postgresql://invalid/invalid',
);
if (
  url.hostname !== '127.0.0.1' ||
  url.port !== '55432' ||
  url.pathname !== '/shabu_test' ||
  url.username !== 'shabu_test'
)
  throw new Error('Refusing non-isolated DB');
(async () => {
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const name = `shabu_security_${Date.now()}`;
  try {
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
  url.pathname = `/${name}`;
  const result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error('Test migration failed');
  const out = path.resolve(
    __dirname,
    '../../reports/security-evidence/test-database.json',
  );
  fs.writeFileSync(out, JSON.stringify({ url: url.toString() }, null, 2));
  console.log(
    'Created isolated security test DB; no existing database was changed.',
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
