// Start/stop only this script's child processes against the isolated test database.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const artifacts = path.join(root, 'reports/implementation01-evidence');
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (
  process.env.ALLOW_SHABU_TEST_DB !== '1' ||
  url.hostname !== '127.0.0.1' ||
  url.port !== '55432' ||
  !/^\/shabu_f04_empty_\d+$/.test(url.pathname)
) {
  throw new Error('Refusing to start against a non-isolated database');
}
const children = [];
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
function start(app, args, env) {
  const log = fs.openSync(path.join(artifacts, `${app}-start.log`), 'w');
  const child = spawn('npm', args, {
    cwd: path.join(root, app),
    env,
    detached: true,
    stdio: ['ignore', log, log],
  });
  fs.closeSync(log);
  children.push(child);
  return child;
}
async function ready(child, address) {
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null)
      throw new Error(`${address} process exited ${child.exitCode}`);
    try {
      const response = await fetch(address, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.status === 200) return response;
    } catch {
      /* startup in progress */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Startup timed out: ${address}`);
}
async function main() {
  try {
    await freePort(3000);
    await freePort(3001);
    const backend = start('backend', ['run', 'start:prod'], {
      ...process.env,
      PORT: '3000',
      NODE_ENV: 'development',
      JWT_SECRET: 'isolated-local-smoke-only',
      JWT_REFRESH_SECRET: 'isolated-local-smoke-refresh-only',
    });
    const menu = await ready(backend, 'http://127.0.0.1:3000/menu-items');
    const payload = await menu.json();
    assert.equal(payload.status, true);
    assert.ok(Array.isArray(payload.data));
    console.log(
      'PASS backend npm run start:prod: HTTP /menu-items 200 + database query',
    );
    const swagger = await fetch('http://127.0.0.1:3000/api-docs');
    assert.equal(swagger.status, 200);
    console.log('PASS backend /api-docs 200');
    const frontend = start(
      'frontend',
      ['run', 'start', '--', '--hostname', '127.0.0.1'],
      {
        ...process.env,
        NODE_ENV: 'production',
      },
    );
    const login = await ready(frontend, 'http://127.0.0.1:3001/login');
    assert.match(await login.text(), /Shabu/);
    console.log('PASS frontend npm run start: HTTP /login 200');
    const order = await fetch(
      'http://127.0.0.1:3001/order/00000000-0000-4000-8000-000000000001',
    );
    assert.equal(order.status, 200);
    console.log(
      'PASS frontend dynamic /order/[token] HTTP 200 (render smoke only, not browser acceptance)',
    );
  } finally {
    await Promise.all(
      children.map(async (child) => {
        if (child.exitCode !== null) return;
        const stopped = new Promise((resolve) => child.once('exit', resolve));
        process.kill(-child.pid, 'SIGTERM');
        await stopped;
      }),
    );
    console.log(
      'Stopped only smoke-test child process groups; database retained.',
    );
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
