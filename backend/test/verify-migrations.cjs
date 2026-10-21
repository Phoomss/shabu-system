// Creates only new databases on the explicitly authorized isolated test server.
// Never drops/resets a database, and never uses DATABASE_URL from .env.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const root = path.resolve(__dirname, '..');
const adminUrl = process.env.SHABU_TEST_ADMIN_URL;
if (process.env.ALLOW_SHABU_TEST_DB !== '1' || !adminUrl)
  throw new Error('Explicit isolated test DB opt-in required');
const parsed = new URL(adminUrl);
if (
  parsed.hostname !== '127.0.0.1' ||
  parsed.port !== '55432' ||
  parsed.pathname !== '/shabu_test' ||
  parsed.username !== 'shabu_test'
) {
  throw new Error('Refusing non-isolated database target');
}
const artifacts = path.resolve(root, '../reports/implementation01-evidence');
fs.mkdirSync(artifacts, { recursive: true });
function prisma(args, databaseUrl) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'node_modules/prisma/build/index.js'), ...args],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    },
  );
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  console.log('COMMAND', args.join(' '), 'EXIT', result.status);
  assert.equal(result.status, 0);
}
async function main() {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  const stamp = Date.now();
  const databases = {};
  try {
    for (const kind of ['empty', 'populated']) {
      const name = `shabu_f04_${kind}_${stamp}`;
      await admin.query(`CREATE DATABASE "${name}"`);
      const url = new URL(adminUrl);
      url.pathname = `/${name}`;
      databases[kind] = url.toString();
    }
  } finally {
    await admin.end();
  }

  prisma(['migrate', 'deploy'], databases.empty);
  const temp = fs.mkdtempSync(
    path.join(os.tmpdir(), 'shabu-legacy-migrations-'),
  );
  const migrations = path.join(temp, 'migrations');
  fs.mkdirSync(migrations);
  for (const entry of fs.readdirSync(path.join(root, 'prisma/migrations'))) {
    if (entry === '20261021070000_add_display_numbers') continue;
    fs.cpSync(
      path.join(root, 'prisma/migrations', entry),
      path.join(migrations, entry),
      { recursive: true },
    );
  }
  const config = path.join(temp, 'legacy.config.ts');
  fs.writeFileSync(
    config,
    `export default { schema: ${JSON.stringify(path.join(root, 'prisma/schema.prisma'))}, migrations: { path: ${JSON.stringify(migrations)} }, datasource: { url: process.env.DATABASE_URL } };`,
  );
  prisma(['migrate', 'deploy', '--config', config], databases.populated);
  const client = new Client({ connectionString: databases.populated });
  await client.connect();
  try {
    await client.query(`
      INSERT INTO "Role" (id,name) VALUES (1,'TEST');
      INSERT INTO "User" (id,"roleId",username,"passwordHash","fullName") VALUES ('legacy-user',1,'legacy','fixture','Legacy User');
      INSERT INTO "User" (id,"roleId",username,"passwordHash","fullName") VALUES ('legacy-user-2',1,'legacy-2','fixture','Legacy User 2');
      INSERT INTO "Table" (id,number) VALUES (1,'Legacy Table');
      INSERT INTO "Tier" (id,name,"priceAdult","priceChild") VALUES (1,'Legacy Tier',100,50);
      INSERT INTO "Session" (id,"tableId","tierId","qrToken","endTime") VALUES ('legacy-session',1,1,'legacy-token',now());
      INSERT INTO "Session" (id,"tableId","tierId","qrToken","endTime") VALUES ('legacy-session-2',1,1,'legacy-token-2',now());
      INSERT INTO "Order" (id,"sessionId") VALUES ('legacy-order','legacy-session');
      INSERT INTO "Order" (id,"sessionId") VALUES ('legacy-order-2','legacy-session-2');
      INSERT INTO "Invoice" (id,"sessionId","totalAmount","netAmount","paymentMethod","createdBy") VALUES ('legacy-invoice','legacy-session',100,100,'CASH','legacy-user');
      INSERT INTO "Invoice" (id,"sessionId","totalAmount","netAmount","paymentMethod","createdBy") VALUES ('legacy-invoice-2','legacy-session-2',50,50,'CASH','legacy-user-2');
    `);
    const before = {};
    for (const table of ['User', 'Session', 'Order', 'Invoice']) {
      before[table] = (
        await client.query(`SELECT * FROM "${table}" ORDER BY id`)
      ).rows;
    }
    prisma(['migrate', 'deploy'], databases.populated);
    for (const [table, field] of [
      ['User', 'userNumber'],
      ['Session', 'sessionNumber'],
      ['Order', 'orderNumber'],
      ['Invoice', 'invoiceNumber'],
    ]) {
      const after = (await client.query(`SELECT * FROM "${table}" ORDER BY id`))
        .rows;
      assert.equal(after.length, before[table].length);
      after.forEach((row, index) => {
        assert.ok(Number.isInteger(row[field]) && row[field] > 0);
        const original = { ...row };
        delete original[field];
        assert.deepEqual(original, before[table][index]);
      });
      // Query sequence default, nullability and uniqueness with actual writes in a rollback-only test transaction.
      await client.query('BEGIN');
      const next = await client.query(
        `SELECT nextval(pg_get_serial_sequence('"${table}"', '${field}')) AS value`,
      );
      assert.ok(
        Number(next.rows[0].value) >
          Math.max(...after.map((row) => row[field])),
      );
      await assert.rejects(
        () => client.query(`UPDATE "${table}" SET "${field}" = NULL`),
        (e) => e.code === '23502',
      );
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await assert.rejects(
        () =>
          client.query(`UPDATE "${table}" SET "${field}" = $1`, [
            after[0][field],
          ]),
        (e) => e.code === '23505',
      );
      await client.query('ROLLBACK');
      const index = await client.query(
        'SELECT indexdef FROM pg_indexes WHERE tablename=$1 AND indexname=$2',
        [table, `${table}_${field}_key`],
      );
      assert.match(index.rows[0].indexdef, /CREATE UNIQUE INDEX/);
      console.log(
        'PASS preserved rows/PK/FK, backfill, NOT NULL, unique index, sequence:',
        table,
      );
    }
  } finally {
    await client.end();
  }
  for (const url of Object.values(databases)) {
    prisma(
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      url,
    );
    prisma(['migrate', 'deploy'], url); // repeat is a no-op, not a duplicate backfill
  }
  fs.writeFileSync(
    path.join(artifacts, 'test-databases.json'),
    JSON.stringify(databases, null, 2),
  );
  console.log(
    'PASS migration on empty and populated databases; databases retained for inspection.',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
