const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const yaml = createRequire(path.join(root, "backend/package.json"))("js-yaml");
for (const name of fs.readdirSync(path.join(root, ".github/workflows"))) {
  const source = fs.readFileSync(
    path.join(root, ".github/workflows", name),
    "utf8",
  );
  const workflow = yaml.load(source);
  if (
    workflow.permissions?.contents !== "read" ||
    !workflow.on?.pull_request ||
    /git\s+(push|merge)|--delete|DISCORD_WEBHOOK|contents:\s*write/.test(source)
  )
    throw Error(name + ": CI policy violation");
  console.log(
    "PASS " +
      name +
      ": YAML parsed; PR trigger; contents:read; no merge/push/delete/webhook",
  );
}
