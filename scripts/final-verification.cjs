// Final QA: read current sources, create isolated TEST databases, preserve every failure.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const requireBackend = createRequire(path.join(root, "backend/package.json"));
const { Client } = requireBackend("pg");
if (process.env.ALLOW_SHABU_TEST_DB !== "1")
  throw Error("Explicit isolated DB opt-in required");
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
  throw Error("Refusing non-isolated target");
admin.pathname = "/shabu_test";
const retestFlag = process.argv.find((arg) => arg.startsWith("--retest="));
const matrixFlag = process.argv.find((arg) => arg.startsWith("--matrix="));
const previousRun =
  retestFlag?.slice("--retest=".length) ||
  matrixFlag?.slice("--matrix=".length);
if (previousRun && !/^run-\d+$/.test(previousRun))
  throw Error("Invalid retained run id");
const runId = previousRun || `run-${Date.now()}`;
const out = path.join(root, "reports/final-verification", runId);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(root, "reports/final-verification/latest-run.json"),
  JSON.stringify({ runId, directory: path.relative(root, out) }, null, 2),
);
const commands = previousRun
    ? JSON.parse(fs.readFileSync(path.join(out, "commands.json"), "utf8"))
    : [],
  databases = previousRun
    ? JSON.parse(
        fs.readFileSync(path.join(out, "databases.private.json"), "utf8"),
      )
    : {},
  processes = new Set();
const baseEnv = {
  ...process.env,
  ALLOW_SHABU_TEST_DB: "1",
  SHABU_TEST_ADMIN_URL: admin.toString(),
  DATABASE_URL: admin.toString(),
  JWT_SECRET: crypto.randomBytes(32).toString("hex"),
  JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
  NODE_ENV: "test",
  CORS_ORIGINS: "http://localhost:3001,http://127.0.0.1:3001",
  STAFF_PERMISSION_GRANTS: "{}",
  KITCHEN_USER_ASSIGNMENTS: "{}",
  CUSTOMER_JWT_SECRET: "",
};
function save() {
  fs.writeFileSync(
    path.join(out, "commands.json"),
    JSON.stringify(commands, null, 2),
  );
  fs.writeFileSync(
    path.join(out, "databases.private.json"),
    JSON.stringify(databases, null, 2),
  );
}
function snapshot(name) {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(
      (file) =>
        /^(backend\/(src|test|prisma)\/|frontend\/(src|test)\/|scripts\/|\.github\/workflows\/)/.test(
          file,
        ) ||
        /^(backend|frontend)\/(package(-lock)?\.json|.*config.*|Dockerfile)$/.test(
          file,
        ) ||
        ["docker-compose.yml", ".env.example"].includes(file),
    );
  const hashes = Object.fromEntries(
    [...new Set(files)]
      .filter(
        (file) =>
          fs.existsSync(path.join(root, file)) &&
          fs.statSync(path.join(root, file)).isFile(),
      )
      .map((file) => [
        file,
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      ]),
  );
  fs.writeFileSync(
    path.join(out, name),
    JSON.stringify(
      {
        head: execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: root,
          encoding: "utf8",
        }).trim(),
        node: process.version,
        hashes,
      },
      null,
      2,
    ),
  );
}
async function run(id, directory, args, extra = {}) {
  const entry = {
    id,
    directory,
    command: args,
    startedAt: new Date().toISOString(),
    log: id + ".log",
    status: "RUNNING",
  };
  commands.push(entry);
  save();
  console.log(`RUN ${id}: ${directory} ${args.join(" ")}`);
  const fd = fs.openSync(path.join(out, entry.log), "w");
  const child = spawn(args[0], args.slice(1), {
    cwd: path.join(root, directory),
    env: { ...baseEnv, ...extra },
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  processes.add(child);
  const result = await new Promise((resolve) => {
    child.once("error", (error) =>
      resolve({ exit: null, error: error.message }),
    );
    child.once("exit", (exit, signal) => resolve({ exit, signal }));
  });
  processes.delete(child);
  Object.assign(entry, result, {
    endedAt: new Date().toISOString(),
    status: result.exit === 0 ? "PASS" : "FAIL",
  });
  save();
  console.log(`${entry.status} ${id} exit=${result.exit}`);
  return entry;
}
async function db(prefix, id) {
  const name = `${prefix}_${Date.now()}`;
  if (!/^shabu_[a-z0-9_]+_\d+$/.test(name)) throw Error("Unsafe test DB name");
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
  const url = new URL(admin);
  url.pathname = "/" + name;
  databases[id] = url.toString();
  save();
  const migrated = await run(
    id + "-migrate",
    "backend",
    ["npm", "run", "migrate:deploy"],
    { DATABASE_URL: url.toString() },
  );
  if (migrated.status !== "PASS") throw Error(id + " test DB migration failed");
  return url.toString();
}
async function suite(id, config, prefix, options = {}) {
  const url = await db(prefix, id),
    artifact = path.join(out, id);
  fs.mkdirSync(artifact, { recursive: true });
  const extra = { DATABASE_URL: url, SHABU_TEST_ARTIFACT_DIR: artifact };
  if (id === "inventory") {
    const meta = path.join(artifact, "test-database.json");
    fs.writeFileSync(meta, JSON.stringify({ url }));
    extra.SHABU_INVENTORY_METADATA_FILE = meta;
  }
  return run(
    id,
    "backend",
    [
      "node",
      "node_modules/jest/bin/jest.js",
      "--runInBand",
      "--config",
      config,
      "--json",
      "--outputFile",
      path.join(out, id + ".results.json"),
    ],
    extra,
  );
}
function fixtureIssues(id) {
  id = id.replace(/-retest$/, "");
  if (/^(backend|frontend)-(build|lint)$|runtime|ci-policy/.test(id))
    return "F16";
  if (id === "id-migrations") return "F05,F16";
  if (id === "payment-migrations") return "F10,F16";
  if (id === "inventory-migrations") return "F14,F16";
  if (id === "security") return "F01,F02,F07";
  if (id === "workflow") return "F04,F06,F08,F09,F13";
  if (id === "payment") return "F03,F10,F11,F12";
  if (id === "ids") return "F04,F05";
  if (id === "inventory") return "F14";
  if (id === "journey") return "F02,F03,F06,F10,F13";
  if (id === "pricing-proposal") return "F03 design only";
  return "F01-F16 regression";
}
function testLevel(id) {
  if (id === "inventory")
    return "Service/PostgreSQL; gateway spy; HTTP case uses fixture guard (no JWT claim)";
  if (id === "payment")
    return "HTTP/JWT/PostgreSQL; event spies; actual backend restart";
  if (id === "pricing-proposal")
    return "Unapproved pure Decimal design fixture";
  if (id.includes("unit")) return "Unit / scaffold setup";
  return "HTTP/JWT/PostgreSQL; network sockets only where named in assertion";
}
function testIssues(id, suiteName) {
  if (id !== "backend-full-unit") return fixtureIssues(id);
  if (/ingredients/.test(suiteName)) return "F14";
  if (/security|auth|role|user/.test(suiteName)) return "F01,F02,F07,F15,F16";
  if (/payment|invoices/.test(suiteName)) return "F03,F10,F11,F12";
  if (/order-rules/.test(suiteName)) return "F13";
  if (/id|events/.test(suiteName)) return "F04,F07";
  if (/sessions/.test(suiteName)) return "F10,F11";
  if (/health/.test(suiteName)) return "F16";
  return "F09,F16 scaffold wiring";
}
function matrix() {
  const rows = [];
  let sequence = 0;
  const add = (row) =>
    rows.push({ caseId: `FV-${String(++sequence).padStart(3, "0")}`, ...row });
  for (const cmd of commands) {
    if (cmd.status === "RUNNING") continue;
    add({
      requirement: cmd.id.includes("lint")
        ? "F16 quality gate"
        : fixtureIssues(cmd.id),
      preconditions: "Current source; isolated TEST environment only",
      steps: `${cmd.directory}: ${cmd.command.join(" ")}`,
      expected: "Exit 0; no ignored failing tests",
      actual: `Exit ${cmd.exit}${cmd.error ? " " + cmd.error : ""}`,
      status: cmd.status,
      evidence: `reports/final-verification/${runId}/${cmd.log}`,
      bugReferences:
        cmd.status === "FAIL"
          ? [
              cmd.id.startsWith("journey")
                ? "BUG-FV-ORDER-RETRY"
                : cmd.id.includes("lint")
                  ? "BUG-FV-QUALITY-LINT"
                  : cmd.id === "backend-full-unit"
                    ? "BUG-FV-SCAFFOLD-UNIT"
                    : "BUG-FV-" + cmd.id.toUpperCase(),
            ]
          : [],
      level: "command",
    });
    const result = path.join(out, cmd.id + ".results.json");
    if (fs.existsSync(result)) {
      const report = JSON.parse(fs.readFileSync(result));
      for (const suite of report.testResults || []) {
        if (!(suite.assertionResults || []).length && suite.status === "failed")
          add({
            requirement: testIssues(cmd.id, suite.name),
            preconditions: "Suite imports and providers must resolve",
            steps: path.relative(root, suite.name),
            expected: "Suite loads and executes assertions",
            actual: (suite.message || "Suite failed before assertions").slice(
              0,
              1000,
            ),
            status: "FAIL",
            evidence: `reports/final-verification/${runId}/${cmd.id}.results.json`,
            bugReferences: ["BUG-FV-SCAFFOLD-UNIT"],
            level: "suite setup",
          });
        // Selected regression command is summarized above; full unit details avoid double-counting it.
        if (cmd.id === "backend-regression") continue;
        for (const test of suite.assertionResults || [])
          add({
            requirement: testIssues(cmd.id, suite.name),
            preconditions:
              cmd.id === "pricing-proposal"
                ? "Unapproved pure Decimal hypothesis; not imported by runtime"
                : cmd.id === "inventory"
                  ? "New DB; service fixtures; HTTP test injects actor guard; event gateway is a spy"
                  : cmd.id.includes("unit")
                    ? "Unit fixtures; not production acceptance"
                    : "New DB; synthetic users/menu/session; explicit test grants only",
            steps: test.fullName || test.title,
            expected:
              cmd.id === "pricing-proposal"
                ? "Unapproved synthetic pricing hypothesis only; not runtime acceptance"
                : `Expected behavior: ${test.title}`,
            actual:
              test.status === "passed"
                ? "Assertions passed"
                : (test.failureMessages || []).join("\n").slice(0, 1200) ||
                  test.status,
            status:
              test.status === "passed"
                ? "PASS"
                : test.status === "failed"
                  ? "FAIL"
                  : "NOT RUN",
            evidence: `reports/final-verification/${runId}/${cmd.id}.results.json :: ${test.fullName || test.title}`,
            bugReferences:
              test.status === "failed"
                ? [
                    cmd.id.startsWith("journey")
                      ? "BUG-FV-ORDER-RETRY"
                      : "BUG-FV-SCAFFOLD-UNIT",
                  ]
                : [],
            level: testLevel(cmd.id),
          });
      }
    }
    if (cmd.id === "frontend-tests") {
      const tap = fs.readFileSync(path.join(out, cmd.log), "utf8");
      for (const match of tap.matchAll(/^(ok|not ok) \d+ - (.+)$/gm))
        add({
          requirement:
            /refresh|auth|logout|Zustand|hydrate|credential|session invalidation/i.test(
              match[2],
            )
              ? "F15"
              : /decimal|receipt|monetary/i.test(match[2])
                ? "F03,F12 display only"
                : /socket|customer|staff/i.test(match[2])
                  ? "F02,F07"
                  : /kitchen|QR|KDS|stale|request/i.test(match[2])
                    ? "F08,F09"
                    : "F04",
          preconditions:
            "Node test VM using source modules; no browser or handset",
          steps: match[2],
          expected: `Expected client contract: ${match[2]}`,
          actual:
            match[1] === "ok"
              ? "Assertions passed"
              : "See TAP failure diagnostics",
          status: match[1] === "ok" ? "PASS" : "FAIL",
          evidence: `reports/final-verification/${runId}/${cmd.log} :: ${match[2]}`,
          bugReferences: [],
          level: "client module/adapter contract",
        });
    }
  }
  const journeyFacts = path.join(out, "journey/journey-facts.json");
  if (fs.existsSync(journeyFacts))
    for (const fact of JSON.parse(fs.readFileSync(journeyFacts, "utf8"))) {
      rows.push({
        caseId: fact.caseId,
        requirement:
          fact.caseId === "FV-R01"
            ? "F10,F13 retry acceptance"
            : "F02,F03,F06,F11,F13 journey checkpoint",
        preconditions:
          "Fresh isolated DB; synthetic fixture actor with explicit test grants; NOT production role policy",
        steps: fact.caseId,
        expected:
          fact.caseId === "FV-R01"
            ? "Same reference -> one order"
            : fact.caseId.endsWith("CHECKOUT")
              ? "503 policy pending; zero invoices; no fabricated PAID"
              : fact.caseId === "FV-J02"
                ? "Manual cleaning/available branch; unpaid reopening still 409"
                : "Expected checkpoint assertions from FV-J01 executable test",
        actual: JSON.stringify(fact.actual),
        status:
          fact.caseId === "FV-R01" && !fact.actual.sameResource
            ? "FAIL"
            : "PASS",
        evidence: `reports/final-verification/${runId}/journey/journey-facts.json`,
        bugReferences: fact.caseId === "FV-R01" ? ["BUG-FV-ORDER-RETRY"] : [],
        level: "Real HTTP/JWT/PostgreSQL checkpoint; not full settled journey",
      });
    }
  const sourceStart = path.join(out, "source-start.json"),
    sourceEnd = path.join(out, "source-end.json");
  if (fs.existsSync(sourceStart) && fs.existsSync(sourceEnd)) {
    const a = JSON.parse(fs.readFileSync(sourceStart)).hashes,
      b = JSON.parse(fs.readFileSync(sourceEnd)).hashes;
    const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
      (file) => a[file] !== b[file],
    );
    const productChanged = changed.filter((file) =>
      /^(backend|frontend)\/(src|prisma)\/|package(-lock)?\.json$|Dockerfile$|^docker-compose\.yml$/.test(
        file,
      ),
    );
    fs.writeFileSync(
      path.join(out, "source-integrity.json"),
      JSON.stringify(
        {
          productInputsUnchanged: productChanged.length === 0,
          productChanged,
          changedHarnessInputs: changed.filter(
            (file) => !productChanged.includes(file),
          ),
        },
        null,
        2,
      ),
    );
    rows.push({
      caseId: "FV-REPO-INTEGRITY",
      requirement: "F01-F16 latest working tree",
      preconditions:
        "Source-start/end SHA256 snapshots; staged and untracked source included",
      steps:
        "Compare application/schema/package/Docker inputs before/after; list harness-only fixes",
      expected: "No unverified product source changes during the run",
      actual: JSON.stringify({ productChanged, changedHarnessInputs: changed }),
      status: productChanged.length ? "BLOCKED" : "PASS",
      evidence: `reports/final-verification/${runId}/source-integrity.json`,
      bugReferences: [],
      level: "Source fingerprint check",
    });
  }
  const policy = (
    caseId,
    requirement,
    steps,
    expected,
    actual,
    bugReferences,
    level = "requirement",
  ) =>
    rows.push({
      caseId,
      requirement,
      preconditions:
        "Approved business expected and environment are required; no real money/customer data",
      steps,
      expected,
      actual,
      status: "BLOCKED",
      evidence: `reports/final-verification/${runId}/journey/journey-facts.json; reports/final-verification/${runId}/payment.results.json`,
      bugReferences,
      level,
    });
  policy(
    "FV-BLOCK-PRICING",
    "F03 / P0 release blocker",
    "Obtain authoritative quote; boundary discounts, VAT/service/rounding under approved policy",
    "Signed-off expected amounts and real runtime calculation",
    "Checkout/quote policy pending; 503 is tested safe-deny, not pricing acceptance",
    ["F03", "BUG-FV-PAYMENT-POLICY"],
  );
  policy(
    "FV-BLOCK-SETTLEMENT",
    "F10,F11 / P0 release blocker",
    "SERVED -> checkout -> payment confirmation -> invoice -> cleaning -> available",
    "One audited settlement and correct invoice/state updates with retry/concurrency",
    "No approved confirmation/settlement implementation; full happy path blocked",
    ["F03", "F10", "F11", "BUG-FV-PAYMENT-POLICY"],
  );
  policy(
    "FV-BLOCK-PAYQR",
    "F12",
    "Generate/decode payment QR and confirm recipient/currency/amount",
    "Approved standard/provider fixture and non-money sandbox acceptance",
    "Payment QR disabled; persisted settings are not a verified receiver or QR payload",
    ["F12", "BUG-FV-PAYMENT-POLICY"],
  );
  policy(
    "FV-BLOCK-INVOICE-RETRY",
    "F10",
    "Concurrent/retried valid checkout/payment request",
    "At most one committed approved invoice/payment event",
    "Current requests are rejected with zero invoices; cannot claim successful invoice idempotency",
    ["F10", "BUG-FV-PAYMENT-POLICY"],
  );
  policy(
    "FV-BLOCK-STOCK-POLICY",
    "F14",
    "Transition recipe deduction; eligible void returns once",
    "Approved timing/return/unit rules plus atomic event references",
    "Manual stock ledger tested; automatic deduction/restoration intentionally not wired without approval",
    ["F14", "BUG-FV-STOCK-POLICY"],
  );
  policy(
    "FV-BLOCK-PROD-GRANTS",
    "F01,F02,F07",
    "Verify deployed OWNER/MANAGER/STAFF/KITCHEN permission/assignment policy",
    "Approved production policy; safe grants and provisioning",
    "Fixture grants/default-deny are tested; production config not accessed or approved in this task",
    ["F01", "F02", "F07", "BUG-FV-PROD-POLICY"],
  );
  rows.push({
    caseId: "FV-NR-BROWSER",
    requirement: "F08,F15,F16",
    preconditions: "Browser-control runtime and browser/device",
    steps:
      "Browser reload/logout/401 burst; stale-state rendering; handset QR scan and reconnect",
    expected: "Verified UI/cookie behavior on real browser/device",
    actual:
      "No browser runtime exposed by tools; no physical handset. Node module and LAN interface smoke do not replace this.",
    status: "NOT RUN",
    evidence: `reports/final-verification/${runId}/environment-scope.json`,
    bugReferences: ["ENV-FV-BROWSER-MOBILE"],
    level: "browser/mobile",
  });
  rows.push({
    caseId: "FV-NR-BANK",
    requirement: "F12",
    preconditions: "Approved provider sandbox/QR spec; no real money",
    steps: "Provider sandbox confirmation/replay; banking QR decoding/scan",
    expected: "Verified non-money sandbox result",
    actual:
      "No approved provider contract/fixture available; no money or bank/customer data used.",
    status: "NOT RUN",
    evidence: "reports/F03_F10_F11_F12_PAYMENT_DECISIONS_TH.md",
    bugReferences: ["BUG-FV-PAYMENT-POLICY"],
    level: "provider",
  });
  fs.writeFileSync(
    path.join(out, "test-matrix.json"),
    JSON.stringify(rows, null, 2),
  );
  const cols = [
    "caseId",
    "requirement",
    "preconditions",
    "steps",
    "expected",
    "actual",
    "status",
    "evidence",
    "bugReferences",
    "level",
  ];
  const cell = (v) =>
    String(Array.isArray(v) ? v.join(",") : (v ?? ""))
      .replaceAll("|", "\\|")
      .replaceAll("\n", "<br>");
  fs.writeFileSync(
    path.join(root, "reports/FINAL_TEST_MATRIX_TH.md"),
    `# Final Test Matrix\n\nRun: ${runId}. Actuals are from this run only. PASS describes the stated test level, never untested production/browser behavior.\n\n| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|\n` +
      rows
        .map(
          (row) =>
            "| " +
            cols
              .map((col) => {
                if (col === "evidence")
                  return String(row[col])
                    .split("; ")
                    .map((part) => {
                      const [file, ...description] = part.split(" :: ");
                      return fs.existsSync(path.join(root, file))
                        ? `[${path.basename(file)}](${file.replace(/^reports\//, "")})${description.length ? " :: " + cell(description.join(" :: ")) : ""}`
                        : cell(part);
                    })
                    .join("<br>");
                if (col === "bugReferences")
                  return (row[col] || [])
                    .map((id) =>
                      /^(BUG|ENV)-/.test(id)
                        ? `[${id}](FINAL_BUG_REGISTER_TH.md#${id.toLowerCase()})`
                        : cell(id),
                    )
                    .join(", ");
                return cell(row[col]);
              })
              .join(" | ") +
            " |",
        )
        .join("\n") +
      "\n",
  );
  fs.writeFileSync(
    path.join(out, "test-matrix.csv"),
    [
      cols.join(","),
      ...rows.map((row) =>
        cols
          .map((col) => '"' + cell(row[col]).replaceAll('"', '""') + '"')
          .join(","),
      ),
    ].join("\n") + "\n",
  );
  const summary = {
    runId,
    verdict: "NO-GO for production public access",
    counts: Object.fromEntries(
      ["PASS", "FAIL", "BLOCKED", "NOT RUN"].map((status) => [
        status,
        rows.filter((row) => row.status === status).length,
      ]),
    ),
    reasons: [
      "F03 authoritative pricing/payment policy remains unresolved (P0 release blocker)",
      "No successful checkout/payment confirmation/invoice settlement path",
      "Full-repo failures are retained and block quality gates",
      "Order retry acceptance contract fails: duplicate resources observed over HTTP",
      "Production grant policy and browser/mobile/provider acceptance not verified",
    ],
    note: "Counts include command gates and their assertions; not a deduplicated feature/test pass rate",
  };
  fs.writeFileSync(
    path.join(out, "summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary));
}
async function main() {
  if (matrixFlag) {
    snapshot("source-end.json");
    matrix();
    process.exitCode = 1;
    return;
  }
  if (previousRun) {
    for (const [id, script] of [
      ["id-migrations-retest", "test/verify-migrations.cjs"],
      ["payment-migrations-retest", "test/verify-payment-migrations.cjs"],
    ]) {
      const artifacts = path.join(out, id);
      fs.mkdirSync(artifacts, { recursive: true });
      await run(id, "backend", ["node", script], {
        SHABU_TEST_ARTIFACT_DIR: artifacts,
      });
    }
    await run("backend-lint-retest", "backend", ["npm", "run", "lint"]);
    await run("new-tests-lint", "backend", [
      "node",
      "node_modules/eslint/bin/eslint.js",
      "test/final-verification.e2e-spec.ts",
      "test/inventory.e2e-spec.ts",
      "test/payment.e2e-spec.ts",
    ]);
    const legacyUrl = await db("shabu_final", "default-e2e");
    await run(
      "backend-default-e2e",
      "backend",
      [
        "npm",
        "run",
        "test:e2e",
        "--",
        "--runInBand",
        "--runTestsByPath",
        "test/app.e2e-spec.ts",
        "--json",
        "--outputFile",
        path.join(out, "backend-default-e2e.results.json"),
      ],
      { DATABASE_URL: legacyUrl },
    );
    await suite(
      "journey-retest",
      "test/jest-final-verification.json",
      "shabu_final",
    );
    const composeArtifacts = path.join(out, "compose-runtime-retest");
    fs.mkdirSync(composeArtifacts, { recursive: true });
    await run(
      "compose-runtime-retest",
      ".",
      ["node", "scripts/verify-compose.cjs"],
      { SHABU_TEST_ARTIFACT_DIR: composeArtifacts },
    );
    snapshot("source-end.json");
    matrix();
    process.exitCode = 1;
    return;
  }
  snapshot("source-start.json");
  await run("ci-policy", ".", ["node", "scripts/verify-ci-policy.cjs"]);
  const backendBuild = await run("backend-build", "backend", [
    "npm",
    "run",
    "build",
  ]);
  await Promise.all([
    run("backend-regression", "backend", [
      "npm",
      "run",
      "test:regression",
      "--",
      "--json",
      "--outputFile",
      path.join(out, "backend-regression.results.json"),
    ]),
    run("backend-full-unit", "backend", [
      "npm",
      "test",
      "--",
      "--runInBand",
      "--json",
      "--outputFile",
      path.join(out, "backend-full-unit.results.json"),
    ]),
    run("backend-lint", "backend", ["npm", "run", "lint"]),
    run("frontend-lint", "frontend", ["npm", "run", "lint"]),
    run("frontend-tests", "frontend", [
      "node",
      "--test",
      "--test-reporter=tap",
      ...fs
        .readdirSync(path.join(root, "frontend/test"))
        .filter((file) => file.endsWith(".test.mjs"))
        .map((file) => "test/" + file),
    ]),
    run("frontend-build", "frontend", ["npm", "run", "build"], {
      NODE_ENV: "production",
    }),
  ]);
  if (backendBuild.status === "PASS")
    await Promise.all([
      suite("security", "test/jest-security-e2e.json", "shabu_security"),
      suite("workflow", "test/jest-workflow-e2e.json", "shabu_workflow"),
      suite("payment", "test/jest-payment-e2e.json", "shabu_payment_empty"),
      suite("ids", "test/jest-id-e2e.json", "shabu_f04_empty"),
      suite("inventory", "test/jest-inventory-e2e.json", "shabu_inventory"),
      suite("journey", "test/jest-final-verification.json", "shabu_final"),
      run("pricing-proposal", "backend", [
        "npm",
        "run",
        "test:payment:proposal",
        "--",
        "--json",
        "--outputFile",
        path.join(out, "pricing-proposal.results.json"),
      ]),
    ]);
  // Migration scripts get dedicated artifact directories and create only NEW databases.
  for (const [id, script] of [
    ["id-migrations", "test/verify-migrations.cjs"],
    ["payment-migrations", "test/verify-payment-migrations.cjs"],
    ["inventory-migrations", "test/create-inventory-db.cjs"],
  ]) {
    const artifacts = path.join(out, id);
    fs.mkdirSync(artifacts, { recursive: true });
    await run(id, "backend", ["node", script], {
      SHABU_TEST_ARTIFACT_DIR: artifacts,
    });
  }
  for (const [id, script] of [
    ["fresh-runtime", "scripts/verify-fresh.cjs"],
    ["compose-runtime", "scripts/verify-compose.cjs"],
  ]) {
    const artifacts = path.join(out, id);
    fs.mkdirSync(artifacts, { recursive: true });
    await run(id, ".", ["node", script], {
      SHABU_TEST_ARTIFACT_DIR: artifacts,
    });
  }
  snapshot("source-end.json");
  matrix();
  process.exitCode = 1; // NO-GO is not turned into a green overall verification exit.
}
main().catch((error) => {
  console.error(error.stack);
  commands.push({
    id: "runner-error",
    directory: ".",
    command: [],
    exit: 1,
    status: "FAIL",
    log: "runner-error.log",
    error: error.message,
  });
  fs.writeFileSync(
    path.join(out, "runner-error.log"),
    error.stack || error.message,
  );
  save();
  matrix();
  process.exitCode = 1;
});
