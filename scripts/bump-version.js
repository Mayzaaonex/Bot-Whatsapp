#!/usr/bin/env node
// bump-version.js — bump package.json + README.md
// usage: node scripts/bump-version.js [patch|minor|major]  (default: patch)
const fs = require("fs");
const path = require("path");

const type = (process.argv[2] || "patch").toLowerCase();
if (!["patch","minor","major"].includes(type)) {
  console.error("type harus patch|minor|major");
  process.exit(1);
}

const pkgPath = path.join(__dirname, "../package.json");
const readmePath = path.join(__dirname, "../README.md");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const [maj, min, pat] = pkg.version.split(".").map(Number);
let next;
if (type === "major") next = `${maj+1}.0.0`;
else if (type === "minor") next = `${maj}.${min+1}.0`;
else next = `${maj}.${min}.${pat+1}`;

pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`package.json -> ${next}`);

// README.md -> badge + changelog
try {
  let md = fs.readFileSync(readmePath, "utf8");
  // update versi badge line: > Versi: X.Y.Z  atau Mayzaabot-vX.Y.Z
  md = md.replace(/(Versi:\s*)[\d.]+/, `$1${next}`);
  // update changelog table first row if exists, else insert
  const today = new Date().toISOString().slice(0,10);
  if (md.includes("## Changelog")) {
    md = md.replace(
      /## Changelog\s*\n/,
      `## Changelog\n\n| Versi | Tanggal | Catatan |\n|-------|---------|---------|\n| ${next} | ${today} | bump ${type} |\n`
    );
    // dedupe if we ran twice same day — keep only first insert per run, user can edit
  } else {
    md = md.replace(
      /## Kalau List juga gak muncul/,
      `## Changelog\n\n| Versi | Tanggal | Catatan |\n|-------|---------|---------|\n| ${next} | ${today} | bump ${type} |\n\n## Kalau List juga gak muncul`
    );
  }
  fs.writeFileSync(readmePath, md);
  console.log(`README.md -> ${next}`);
} catch (e) { console.warn("skip README:", e.message); }

console.log(`\nDone: v${next} (${type})`);
