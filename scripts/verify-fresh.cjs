// Copies current sources into a NEW temporary checkout. No existing app DB or credentials are used.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "reports/lifecycle-evidence");
fs.mkdirSync(out, { recursive: true });
const req = createRequire(path.join(root, "backend/package.json"));
const { Client } = req("pg");
if (process.env.ALLOW_SHABU_TEST_DB !== "1")
  throw Error("Isolated test DB opt-in required");
const admin = new URL(
  process.env.SHABU_TEST_ADMIN_URL ||
    JSON.parse(
      fs.readFileSync(
        path.join(root, "reports/workflow-evidence/test-database.json"),
      ),
    ).url,
);
if (
  admin.hostname !== "127.0.0.1" ||
  admin.port !== "55432" ||
  admin.username !== "shabu_test"
)
  throw Error("Refusing non-isolated DB");
admin.pathname = "/shabu_test";
const stamp = Date.now();
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "shabu-lifecycle-"));
const interfaces = Object.values(os.networkInterfaces())
  .flat()
  .filter((x) => x && x.family === "IPv4" && !x.internal);
const lan = process.env.SHABU_TEST_LAN_HOST || interfaces[0]?.address;
const host = lan || "127.0.0.1";
const backendPort = 3300,
  frontendPort = 3301;
const origin = `http://${host}:${frontendPort}`,
  apiOrigin = `http://${host}:${backendPort}`;
const secret = crypto.randomBytes(32).toString("hex"),
  refreshSecret = crypto.randomBytes(32).toString("hex");
const env = {
  ...process.env,
  npm_config_cache: path.join(stage, ".npm-cache"),
  JWT_SECRET: secret,
  JWT_REFRESH_SECRET: refreshSecret,
  CUSTOMER_JWT_SECRET: "",
  STAFF_PERMISSION_GRANTS: "{}",
  KITCHEN_USER_ASSIGNMENTS: "{}",
  NODE_ENV: "development",
  CORS_ORIGINS: `${origin},http://127.0.0.1:${frontendPort}`,
  NEXT_PUBLIC_API_URL: apiOrigin,
  NEXT_PUBLIC_SOCKET_URL: apiOrigin,
  NEXT_PUBLIC_APP_URL: origin,
};
const commands = [],
  children = [];
function record() {
  fs.writeFileSync(
    path.join(out, "fresh-commands.json"),
    JSON.stringify(
      {
        stage,
        database: `shabu_lifecycle_${stamp}`,
        lanHost: lan || null,
        commands,
      },
      null,
      2,
    ),
  );
}
async function command(app, args, name) {
  const log = fs.openSync(path.join(out, name + ".log"), "w");
  console.log(`RUN ${app}: ${args.join(" ")}`);
  const child = spawn(args[0], args.slice(1), {
    cwd: path.join(stage, app),
    env: {
      ...env,
      NODE_ENV: name.includes("build") ? "production" : "development",
    },
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  commands.push({
    directory: app,
    command: args.join(" "),
    exit: code,
    log: name + ".log",
  });
  record();
  assert.equal(code, 0, `${app} ${args.join(" ")} failed; see ${name}.log`);
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => server.close(resolve));
  });
}
function start(app, args, name, overrides) {
  const log = fs.openSync(path.join(out, name + ".log"), "w");
  const child = spawn(args[0], args.slice(1), {
    cwd: path.join(stage, app),
    env: { ...env, ...overrides },
    detached: true,
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  children.push(child);
  commands.push({
    directory: app,
    command: args.join(" "),
    log: name + ".log",
    child: true,
  });
  record();
  return child;
}
async function ready(child, address) {
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null)
      throw Error(`Child exited before readiness; ${address}`);
    try {
      const response = await fetch(address, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error(`Readiness timed out: ${address}`);
}
async function main() {
  // All env files and generated artifacts are excluded even when present in the working checkout.
  for (const app of ["backend", "frontend"])
    fs.cpSync(path.join(root, app), path.join(stage, app), {
      recursive: true,
      filter: (source) => {
        const name = path.basename(source);
        return (
          ![
            "node_modules",
            ".next",
            "dist",
            ".git",
            "coverage",
            ".DS_Store",
          ].includes(name) &&
          (!name.startsWith(".env") || name === ".env.example") &&
          !name.endsWith(".tsbuildinfo")
        );
      },
    });
  await freePort(backendPort);
  await freePort(frontendPort);
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "shabu_lifecycle_${stamp}"`);
  } finally {
    await client.end();
  }
  admin.pathname = `/shabu_lifecycle_${stamp}`;
  env.DATABASE_URL = admin.toString();
  fs.writeFileSync(
    path.join(out, "test-environment.json"),
    JSON.stringify({
      stage,
      url: admin.toString(),
      secret,
      refreshSecret,
      apiOrigin,
      origin,
      backendPort,
      frontendPort,
    }),
  );
  record();
  await command("backend", ["npm", "ci"], "fresh-backend-install");
  await command("backend", ["npm", "run", "prisma:generate"], "fresh-generate");
  await command("backend", ["npm", "run", "migrate:deploy"], "fresh-migrate");
  await command("backend", ["npm", "run", "build"], "fresh-backend-build");
  assert(fs.existsSync(path.join(stage, "backend/dist/main.js")));
  assert(!fs.existsSync(path.join(stage, "backend/dist/src/main.js")));
  await command("frontend", ["npm", "ci"], "fresh-frontend-install");
  await command("frontend", ["npm", "run", "build"], "fresh-frontend-build");
  // Match the Docker standalone runner layout, including static/public assets.
  fs.cpSync(
    path.join(stage, "frontend/public"),
    path.join(stage, "frontend/.next/standalone/public"),
    { recursive: true },
  );
  fs.cpSync(
    path.join(stage, "frontend/.next/static"),
    path.join(stage, "frontend/.next/standalone/.next/static"),
    { recursive: true },
  );
  const backend = start(
    "backend",
    ["npm", "run", "start:prod"],
    "fresh-backend-start",
    { PORT: String(backendPort) },
  );
  await ready(backend, `${apiOrigin}/health`);
  const frontend = start(
    "frontend",
    ["node", ".next/standalone/server.js"],
    "fresh-frontend-start",
    { PORT: String(frontendPort), HOSTNAME: "0.0.0.0", NODE_ENV: "production" },
  );
  await ready(frontend, `${origin}/login`);
  const freshRequire = createRequire(path.join(stage, "backend/package.json"));
  const { PrismaClient } = freshRequire("@prisma/client");
  const { PrismaPg } = freshRequire("@prisma/adapter-pg");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: admin.toString() }),
  });
  const bcrypt = freshRequire("bcrypt");
  const password = crypto.randomBytes(16).toString("hex");
  try {
    const role = await prisma.role.create({
      data: { name: `LIFECYCLE-${stamp}` },
    });
    const user = await prisma.user.create({
      data: {
        username: `lifecycle-${stamp}`,
        fullName: "Isolated lifecycle fixture",
        roleId: role.id,
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    const health = await fetch(`${apiOrigin}/health`);
    assert.equal(health.status, 200);
    assert.equal((await fetch(`${apiOrigin}/orders`)).status, 401);
    const login = await fetch(`${apiOrigin}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ username: user.username, password }),
    });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get("access-control-allow-origin"), origin);
    let cookie = login.headers.get("set-cookie").split(";")[0];
    assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(login.headers.get("set-cookie"), /SameSite=Strict/i);
    let token = (await login.json()).data.accessToken;
    const headers = { Authorization: `Bearer ${token}`, Origin: origin };
    const me = await fetch(`${apiOrigin}/auth/me`, { headers });
    assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).data.permissions, []);
    assert.equal((await fetch(`${apiOrigin}/orders`, { headers })).status, 403);
    const { JwtService } = freshRequire("@nestjs/jwt");
    const expired = new JwtService().sign(
      { sub: user.id, kind: "access" },
      { secret, expiresIn: -1 },
    );
    assert.equal(
      (
        await fetch(`${apiOrigin}/auth/me`, {
          headers: { Authorization: `Bearer ${expired}` },
        })
      ).status,
      401,
    );
    const refreshed = await fetch(`${apiOrigin}/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin },
    });
    assert.equal(refreshed.status, 200);
    cookie = refreshed.headers.get("set-cookie").split(";")[0];
    token = (await refreshed.json()).data.accessToken;
    assert.equal(
      (
        await fetch(`${apiOrigin}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      200,
    );
    const deniedCors = await fetch(`${apiOrigin}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "https://untrusted.example",
      },
    });
    assert.equal(deniedCors.headers.get("access-control-allow-origin"), null);
    const loggedOut = await fetch(`${apiOrigin}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: cookie },
    });
    assert.equal(loggedOut.status, 200);
    assert.equal(
      (
        await fetch(`${apiOrigin}/auth/refresh`, {
          method: "POST",
          headers: { Cookie: cookie },
        })
      ).status,
      401,
    );
    console.log(
      "PASS health/start:prod, login/me, expired access, refresh, logout/revocation, anonymous 401, empty-grant 403, exact CORS.",
    );
    const tier = await prisma.tier.create({
      data: { name: crypto.randomUUID(), priceAdult: 100, priceChild: 50 },
    });
    const table = await prisma.table.create({
      data: { number: crypto.randomUUID() },
    });
    const session = await prisma.session.create({
      data: {
        tierId: tier.id,
        tableId: table.id,
        qrToken: crypto.randomUUID(),
        endTime: new Date(Date.now() + 600000),
      },
    });
    const qr = await fetch(`${apiOrigin}/sessions/qr/${session.qrToken}`, {
      headers: { Origin: origin },
    });
    assert.equal(qr.status, 200);
    const customer = (await qr.json()).data;
    const qrPage = await fetch(`${origin}/order/${session.qrToken}`);
    assert.equal(qrPage.status, 200);
    const customerOrders = await fetch(`${apiOrigin}/customer/orders`, {
      headers: {
        Authorization: `Bearer ${customer.customerAccessToken}`,
        Origin: origin,
      },
    });
    assert.equal(customerOrders.status, 200);
    const clientRequire = createRequire(
      path.join(stage, "frontend/package.json"),
    );
    const { io } = clientRequire("socket.io-client");
    const socket = io(apiOrigin, {
      auth: { customerToken: customer.customerAccessToken },
      transports: ["websocket"],
      extraHeaders: { Origin: origin },
      autoConnect: false,
      reconnection: false,
    });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("Socket room join timeout")),
          5000,
        );
        socket.on("connect_error", reject);
        socket.on("connect", () =>
          socket.emit("session:join", { sessionId: session.id }),
        );
        socket.on("session:joined", () => {
          clearTimeout(timer);
          resolve();
        });
        socket.connect();
      });
    } finally {
      socket.disconnect();
    }
    console.log(
      `PASS QR HTTP + scoped customer API + authorized Socket.IO room over ${lan ? "LAN interface" : "loopback (LAN unavailable)"}.`,
    );
    console.log(
      "Browser/mobile rendering not asserted by this HTTP/socket smoke.",
    );
  } finally {
    await prisma.$disconnect();
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const child of children)
      if (child.exitCode === null) {
        const ended = new Promise((resolve) => child.once("exit", resolve));
        process.kill(-child.pid, "SIGTERM");
        await ended;
      }
    record();
    console.log(
      "Stopped only this test child processes; retained temporary checkout and isolated DB.",
    );
  });
