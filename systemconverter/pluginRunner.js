const { execFile } = require("child_process");
function runNode(pluginPath, args, { timeout = 120000, maxBuffer = 10 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    execFile("node", [pluginPath, ...args], { timeout, maxBuffer }, (err, stdout, stderr) => {
      if (err && !stdout) return reject(new Error(stderr || err.message));
      let json = null;
      try { json = JSON.parse(String(stdout).trim()); } catch {}
      if (!json) {
        const m = String(stdout).match(/\{[\s\S]*\}/g);
        if (m) for (let i = m.length - 1; i >= 0; i--) try { const p = JSON.parse(m[i]); if (p && ("status" in p || "result_path" in p || "result" in p)) { json = p; break; } } catch {}
      }
      if (!json) return reject(new Error(`Plugin output bukan JSON: ${String(stdout).slice(0,500) || stderr?.slice(0,500) || err?.message}`));
      resolve({ json, stdout: String(stdout).trim(), stderr });
    });
  });
}
module.exports = { runNode };
