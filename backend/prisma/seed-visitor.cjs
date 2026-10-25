require('dotenv/config');

const path = require('node:path');
const { execFileSync } = require('node:child_process');

function run(script, env = process.env) {
  execFileSync(process.execPath, [path.join(__dirname, script)], {
    env,
    stdio: 'inherit',
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!process.env.DEMO_USER_PASSWORD || process.env.DEMO_USER_PASSWORD.length < 8) {
    throw new Error('Set DEMO_USER_PASSWORD to at least 8 characters before seeding visitors.');
  }

  run('seed.cjs', {
    ...process.env,
    SEED_DEFAULT_PASSWORD: process.env.DEMO_USER_PASSWORD,
  });

  // A visitor run must make the supplied password work even if demo users exist.
  run('seed-demo-users.cjs', { ...process.env, DEMO_RESET_PASSWORDS: 'true' });
  run('seed-test-data.cjs');
  console.log('Visitor data is ready. Sign in with a demo account and your chosen password.');
}

main().catch((error) => {
  console.error('Could not seed visitor data:', error);
  process.exitCode = 1;
});
