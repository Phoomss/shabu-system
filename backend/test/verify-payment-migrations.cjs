// Opt-in isolated databases only. Retains every DB/fixture, including rejected preflight data.
const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.resolve(root, '../reports/payment-evidence');
fs.mkdirSync(out, { recursive: true });
const adminUrl = new URL(
  process.env.SHABU_TEST_ADMIN_URL || 'postgresql://invalid/invalid',
);
if (
  process.env.ALLOW_SHABU_TEST_DB !== '1' ||
  adminUrl.hostname !== '127.0.0.1' ||
  adminUrl.port !== '55432' ||
  adminUrl.pathname !== '/shabu_test' ||
  adminUrl.username !== 'shabu_test'
)
  throw new Error('Isolated test DB opt-in required');
const latest = '20261021110000_payment_safety_foundation';
const stage = fs.mkdtempSync(
  path.join(os.tmpdir(), 'shabu-payment-migrations-'),
);
fs.mkdirSync(path.join(stage, 'migrations'));
for (const entry of fs.readdirSync(path.join(root, 'prisma/migrations'))) {
  if (entry !== latest)
    fs.cpSync(
      path.join(root, 'prisma/migrations', entry),
      path.join(stage, 'migrations', entry),
      { recursive: true },
    );
}
const config = path.join(stage, 'legacy.config.ts');
fs.writeFileSync(
  config,
  `export default { schema: ${JSON.stringify(path.join(root, 'prisma/schema.prisma'))}, migrations: { path: ${JSON.stringify(path.join(stage, 'migrations'))} }, datasource: { url: process.env.DATABASE_URL } };`,
);
const commands = [];
function prisma(args, url, expected = 0) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', ...args],
    { cwd: root, env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8' },
  );
  console.log(result.stdout, result.stderr, 'EXIT', result.status);
  commands.push({
    args,
    exitStatus: result.status,
    expectedExitStatus: expected,
  });
  assert.equal(result.status, expected);
  return result;
}
async function main() {
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const stamp = Date.now(),
    databases = {};
  try {
    for (const kind of ['empty', 'populated', 'duplicates']) {
      const name = `shabu_payment_${kind}_${stamp}`;
      await admin.query(`CREATE DATABASE "${name}"`);
      const url = new URL(adminUrl);
      url.pathname = '/' + name;
      databases[kind] = url.toString();
    }
  } finally {
    await admin.end();
  }
  fs.writeFileSync(
    path.join(out, 'test-databases.json'),
    JSON.stringify(databases, null, 2),
  );
  prisma(['migrate', 'deploy'], databases.empty);
  for (const kind of ['populated', 'duplicates']) {
    prisma(['migrate', 'deploy', '--config', config], databases[kind]);
    const db = new Client({ connectionString: databases[kind] });
    await db.connect();
    try {
      await db.query(`INSERT INTO "Role" (id,name) VALUES (1,'PAYMENT_FIXTURE');
        INSERT INTO "User" (id,"roleId",username,"passwordHash","fullName") VALUES ('legacy-user',1,'legacy','unused','Legacy');
        INSERT INTO "Tier" (id,name,"priceAdult","priceChild") VALUES (1,'Legacy',100.10,50.05);
        INSERT INTO "Table" (id,number) VALUES (1,'Legacy');
        INSERT INTO "Session" (id,"tableId","tierId","qrToken","endTime") VALUES ('legacy-session',1,1,'legacy-qr',now());
        INSERT INTO "Invoice" (id,"sessionId","totalAmount",discount,"netAmount","paymentMethod","createdBy") VALUES ('legacy-invoice-a','legacy-session',100.10,0.05,100.05,'CASH','legacy-user'),('legacy-invoice-b','legacy-session',50.05,0,50.05,'CASH','legacy-user');`);
      if (kind === 'duplicates')
        await db.query(
          `INSERT INTO "Session" (id,"tableId","tierId","qrToken","endTime") VALUES ('duplicate-active',1,1,'duplicate-qr',now())`,
        );
      const before = {};
      for (const table of ['User', 'Tier', 'Table', 'Session', 'Invoice'])
        before[table] = (
          await db.query(`SELECT * FROM "${table}" ORDER BY id`)
        ).rows;
      const result = prisma(
        ['migrate', 'deploy'],
        databases[kind],
        kind === 'duplicates' ? 1 : 0,
      );
      for (const table of Object.keys(before))
        assert.deepEqual(
          (await db.query(`SELECT * FROM "${table}" ORDER BY id`)).rows,
          before[table],
        );
      if (kind === 'duplicates') {
        // Prisma 7.4 can surface a generic aborted-transaction error after a SQL RAISE.
        // Verify the exact preflight failure using the identical migration SQL, then roll back this test connection.
        assert.notEqual(result.status, 0);
        await assert.rejects(
          db.query(
            fs.readFileSync(
              path.join(root, 'prisma/migrations', latest, 'migration.sql'),
              'utf8',
            ),
          ),
          /PAYMENT_PREFLIGHT_DUPLICATE_ACTIVE_SESSIONS/,
        );
        await db.query('ROLLBACK');
        assert.equal(
          (
            await db.query(
              `SELECT to_regclass('public."PaymentSettings"') AS name`,
            )
          ).rows[0].name,
          null,
        );
        console.log(
          'PASS duplicate preflight abort preserves all rows and rolls back DDL; reconciliation still required',
        );
      } else {
        assert.equal(
          (
            await db.query(
              'SELECT "promptPayNumber" FROM "PaymentSettings" WHERE id=1',
            )
          ).rows[0].promptPayNumber,
          null,
        );
        assert.equal(
          (
            await db.query(
              'SELECT count(*)::int AS n FROM "SessionOpenRequest"',
            )
          ).rows[0].n,
          0,
        );
        console.log(
          'PASS populated migration retains multiple legacy invoices and exact decimal values; no invented receiver/pricing backfill',
        );
      }
    } finally {
      await db.end();
    }
  }
  prisma(
    [
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    databases.empty,
  );
  prisma(
    [
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    databases.populated,
  );
  fs.writeFileSync(
    path.join(out, 'migration-results.json'),
    JSON.stringify(commands, null, 2),
  );
  console.log(
    'PASS migration checks; all databases retained; no reset/drop/truncate',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
