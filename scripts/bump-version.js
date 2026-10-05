#!/usr/bin/env node

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

try {
  let md = fs.readFileSync(readmePath, "utf8");

  // badge
  md = md.replace(/version-[\d.]+-orange/, `version-${next}-orange`);

  const today = new Date().toISOString().slice(0,10);
  // insert 1 row after header "| Versi |" — single header, no dup
  if (md.includes("## Changelog")) {
    md = md.replace(
      /## Changelog\s*\n\s*\| Versi \| Tanggal \| Catatan \|\s*\n\s*\|[^\\n]*\|/,
      `## Changelog\n\n| Versi | Tanggal | Catatan |\n|-------|---------|---------|\n| ${next} | ${today} | bump ${type} |`
    );
  }
  fs.writeFileSync(readmePath, md);
  console.log(`README.md -> ${next}`);
} catch (e) { console.warn("skip README:", e.message); }

console.log(`\nDone: v${next} (${type})`);
