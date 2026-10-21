const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = process.env.SHABU_TEST_ARTIFACT_DIR || path.resolve(root, '../reports/inventory-evidence');
if (process.env.ALLOW_SHABU_TEST_DB !== '1')
  throw Error('Isolated DB opt-in required');
const url = new URL(
  process.env.SHABU_TEST_ADMIN_URL ||
    JSON.parse(
      fs.readFileSync(
        path.resolve(out, '../workflow-evidence/test-database.json'),
      ),
    ).url,
);
if (
  url.hostname !== '127.0.0.1' ||
  url.port !== '55432' ||
  url.username !== 'shabu_test'
)
  throw Error('Refusing non-isolated DB');
url.pathname = '/shabu_test';
const stage = fs.mkdtempSync(
  path.join(require('node:os').tmpdir(), 'shabu-inventory-'),
);
fs.mkdirSync(path.join(stage, 'migrations'));
for (const name of fs.readdirSync(path.join(root, 'prisma/migrations'))) {
  if (name !== '20261021130000_inventory_ledger')
    fs.cpSync(
      path.join(root, 'prisma/migrations', name),
      path.join(stage, 'migrations', name),
      { recursive: true },
    );
}
const config = path.join(stage, 'legacy.config.ts');
fs.writeFileSync(
  config,
  `export default { schema: ${JSON.stringify(path.join(root, 'prisma/schema.prisma'))}, migrations: { path: ${JSON.stringify(path.join(stage, 'migrations'))} }, datasource: { url: process.env.DATABASE_URL } };`,
);
function migrate(args) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy', ...args],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'inherit',
    },
  );
  assert.equal(result.status, 0);
}
(async () => {
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  const name = `shabu_inventory_${Date.now()}`;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  url.pathname = '/' + name;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, 'test-database.json'),
    JSON.stringify({ url: url.toString() }),
  );
  migrate(['--config', config]);
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const row = (
      await client.query(
        `INSERT INTO "Ingredient" (name, unit, "currentStock") VALUES ('legacy fixture', 'g', 123.45) RETURNING id`,
      )
    ).rows[0];
    migrate([]);
    const r = (
      await client.query(
        `SELECT i."currentStock"::text AS balance, i."reorderThreshold", m.quantity::text FROM "Ingredient" i JOIN "StockMovement" m ON m."ingredientId" = i.id WHERE i.id = $1`,
        [row.id],
      )
    ).rows[0];
    assert.equal(r.balance, r.quantity);
    assert.equal(Number(r.balance), 123.45);
    assert.equal(r.reorderThreshold, null);
    console.log(
      'PASS populated migration preserves balance and opens ledger; no inferred threshold.',
    );
    migrate([]);
    assert.equal(
      Number(
        (await client.query('SELECT count(*) FROM "StockMovement"')).rows[0]
          .count,
      ),
      1,
    );
    console.log('PASS migration retry does not duplicate opening.');
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
