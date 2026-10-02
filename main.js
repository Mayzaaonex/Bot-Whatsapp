const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = __dirname;
const ENTRY = path.join(ROOT, "index.js");
const INTERVAL = 700;
const DEBOUNCE = 300;
const WATCH_EXTS = new Set([".js", ".json"]);
const SKIP_DIRS = new Set(["node_modules", "auth_info", ".git", "tmp", ".tmp"]);

let child;
let restarting = false;

function snapshot(dir = ROOT, result = new Map()) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(name.name)) continue;
    const full = path.join(dir, name.name);

    if (name.isDirectory()) snapshot(full, result);
    else if (WATCH_EXTS.has(path.extname(name.name))) {
      try {
        result.set(full, fs.statSync(full).mtimeMs);
      } catch {}
    }
  }
  return result;
}

function start() {
  console.log("▶ node index.js");
  child = spawn(process.execPath, [ENTRY], {
    cwd: ROOT,
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("exit", (code, signal) => {
    if (!restarting) {
      console.log(`\n⚠ index.js exit (${code ?? signal}), restart...`);
      setTimeout(start, 1000);
    }
  });
}

function stop() {
  if (!child || child.killed) return;
  child.kill();
}

function restart(changed) {
  if (restarting) return;
  restarting = true;
  console.log(`\n🔄 Perubahan: ${changed.join(", ")}`);
  console.log("   restart index.js...");
  stop();
  setTimeout(() => {
    restarting = false;
    start();
  }, DEBOUNCE);
}

if (!fs.existsSync(ENTRY)) {
  console.error("index.js gak ketemu");
  process.exit(1);
}

console.log(`👀 Watcher jalan — ${ROOT}`);
console.log("   watch: .js, .json | edit lalu save → auto restart\n");

let previous = snapshot();
start();

setInterval(() => {
  const current = snapshot();
  const changed = [];
  const files = new Set([...previous.keys(), ...current.keys()]);

  for (const file of files) {
    if (previous.get(file) !== current.get(file)) {
      changed.push(path.relative(ROOT, file));
    }
  }

  if (changed.length) restart(changed.slice(0, 8));
  previous = current;
}, INTERVAL);

function shutdown() {
  stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
