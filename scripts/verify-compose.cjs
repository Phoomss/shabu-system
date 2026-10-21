// Builds/runs only a uniquely named TEST Compose project; stops it and retains its volume.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
if (process.env.ALLOW_SHABU_TEST_DB !== "1")
  throw Error("Test environment opt-in required");
const root = path.resolve(__dirname, ".."),
  out =
    process.env.SHABU_TEST_ARTIFACT_DIR ||
    path.join(root, "reports/lifecycle-evidence");
const project = `shabu-lifecycle-${Date.now()}`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shabu-compose-"));
const envFile = path.join(directory, ".env");
const host =
  Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && i.family === "IPv4" && !i.internal)?.address ||
  "127.0.0.1";
const password = crypto.randomBytes(24).toString("hex");
fs.writeFileSync(
  envFile,
  [
    "POSTGRES_USER=shabu_test",
    "POSTGRES_DB=shabu_test",
    `POSTGRES_PASSWORD=${password}`,
    `DATABASE_URL=postgresql://shabu_test:${password}@postgres:5432/shabu_test`,
    `JWT_SECRET=${crypto.randomBytes(32).toString("hex")}`,
    `JWT_REFRESH_SECRET=${crypto.randomBytes(32).toString("hex")}`,
    `CORS_ORIGINS=http://${host}:3331,http://127.0.0.1:3331`,
    "APP_NODE_ENV=development",
    "POSTGRES_PORT=55433",
    "BACKEND_PORT=3330",
    "FRONTEND_PORT=3331",
    `NEXT_PUBLIC_API_URL=http://${host}:3330`,
    `NEXT_PUBLIC_SOCKET_URL=http://${host}:3330`,
    `NEXT_PUBLIC_APP_URL=http://${host}:3331`,
    "STAFF_PERMISSION_GRANTS={}",
    "KITCHEN_USER_ASSIGNMENTS={}",
    "CUSTOMER_JWT_SECRET=",
  ].join("\n"),
);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, "compose-environment.json"),
  JSON.stringify({ project, envFile, host }),
);
// Compose shell variables override --env-file. Always force this test's generated values.
const testEnvironment = Object.fromEntries(
  fs
    .readFileSync(envFile, "utf8")
    .split("\n")
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
const base = [
  "compose",
  "--file",
  path.join(root, "docker-compose.yml"),
  "--project-name",
  project,
  "--env-file",
  envFile,
];
async function docker(args, name) {
  const fd = fs.openSync(path.join(out, name + ".log"), "w");
  console.log(
    `RUN docker compose ${args.join(" ")} (isolated project ${project})`,
  );
  const child = spawn("docker", [...base, ...args], {
    cwd: root,
    env: { ...process.env, ...testEnvironment, COMPOSE_PROFILES: "" },
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  assert.equal(code, 0, `Docker command failed: see ${name}.log`);
}
(async () => {
  try {
    await docker(["config", "--quiet"], "compose-config");
    await docker(["up", "--build", "-d"], "compose-build-up");
    for (let n = 0; n < 100; n++) {
      try {
        const health = await fetch(`http://${host}:3330/health`, {
          signal: AbortSignal.timeout(1000),
        });
        const login = await fetch(`http://${host}:3331/login`, {
          signal: AbortSignal.timeout(1000),
        });
        if (health.ok && login.ok) break;
      } catch {}
      if (n === 99) throw Error("Compose readiness timed out");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const cors = await fetch(`http://${host}:3330/auth/me`, {
      headers: { Origin: `http://${host}:3331` },
    });
    assert.equal(cors.status, 401);
    assert.equal(
      cors.headers.get("access-control-allow-origin"),
      `http://${host}:3331`,
    );
    assert.equal((await fetch(`http://${host}:3330/orders`)).status, 401);
    assert.equal(
      (
        await fetch(
          `http://${host}:3331/order/00000000-0000-4000-8000-000000000001`,
        )
      ).status,
      200,
    );
    for (let n = 0; n < 40; n++) {
      await docker(["ps", "--all"], "compose-status");
      const state = fs.readFileSync(
        path.join(out, "compose-status.log"),
        "utf8",
      );
      if (
        state
          .split("\n")
          .some(
            (line) => line.includes("frontend") && line.includes("(healthy)"),
          )
      )
        break;
      if (n === 39) throw Error("Frontend container health check timed out");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await docker(
      [
        "exec",
        "-T",
        "backend",
        "node",
        "-e",
        "const fs=require('node:fs');for(const p of ['dist/main.js','prisma.config.ts','prisma/schema.prisma','tsconfig.json'])if(!fs.existsSync(p))process.exit(1);console.log('PASS runner artifact and Prisma configuration present')",
      ],
      "compose-artifact",
    );
    console.log(
      "PASS Compose build, DB -> migrate -> backend -> frontend readiness, HTTP health/login/QR, anonymous 401 and LAN CORS. No seed executed.",
    );
  } finally {
    await docker(["stop"], "compose-stop");
    console.log(
      "Stopped only the test project. Test containers and database volume retained.",
    );
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
