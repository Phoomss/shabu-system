// Re-run task 02 against a NEW isolated DB using current migrations and source.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
if (process.env.ALLOW_SHABU_TEST_DB !== "1")
  throw Error("Isolated DB opt-in required");
const target = new URL(
  process.env.SHABU_TEST_ADMIN_URL ||
    JSON.parse(
      fs.readFileSync(
        path.join(root, "reports/workflow-evidence/test-database.json"),
      ),
    ).url,
);
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "55432" ||
  target.username !== "shabu_test"
)
  throw Error("Refusing non-isolated DB");
target.pathname = "/shabu_test";
const env = {
  ...process.env,
  SHABU_TEST_ADMIN_URL: target.toString(),
  SHABU_TEST_METADATA_FILE: path.join(
    root,
    "reports/lifecycle-evidence/security-test-database.json",
  ),
  JWT_SECRET: crypto.randomBytes(32).toString("hex"),
  JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
  NODE_ENV: "development",
  CORS_ORIGINS: "http://localhost:3001,http://127.0.0.1:3001",
};
for (const [name, args] of [
  ["new isolated DB", ["run", "test:security:db"]],
  ["task 02 regression", ["run", "test:security:e2e"]],
]) {
  if (name === "task 02 regression")
    env.DATABASE_URL = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          "reports/lifecycle-evidence/security-test-database.json",
        ),
      ),
    ).url;
  console.log("RUN " + name);
  const result = spawnSync("npm", args, {
    cwd: path.join(root, "backend"),
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
