const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

function fmtBytes(b) {
  if (b === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let n = Number(b);
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
}

function fmtUptime(s) {
  s = Math.floor(s);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function cpuUsagePercent() {
  try {
    const cpus = os.cpus();
    let idle = 0, total = 0;
    for (const c of cpus) {
      const t = c.times;
      idle += t.idle;
      total += t.user + t.nice + t.sys + t.idle + t.irq;
    }
    if (!total) return 0;
    return ((total - idle) / total * 100);
  } catch { return 0; }
}

function diskInfo() {
  // cross-platform: statfs (Node 19+) else df / wmic fallback
  try {
    if (typeof fs.statfsSync === "function") {
      const s = fs.statfsSync(process.cwd());
      // s.bsize * s.blocks = total, s.bsize * s.bfree = free (Linux) / bavail
      const bsize = s.bsize || 4096;
      const total = (s.blocks || 0) * bsize;
      const free = (s.bfree ?? s.bavail ?? 0) * bsize;
      if (total > 0) return { total, free, used: total - free };
    }
  } catch {}
  // fallback: df
  try {
    if (os.platform() !== "win32") {
      const out = execSync("df -k .", { timeout: 1500, encoding: "utf8" });
      const line = out.trim().split("\n").pop();
      const parts = line.trim().split(/\s+/);
      // Filesystem 1K-blocks Used Available Use% Mounted
      const total = parseInt(parts[1], 10) * 1024;
      const used = parseInt(parts[2], 10) * 1024;
      const free = parseInt(parts[3], 10) * 1024;
      if (total > 0) return { total, free, used };
    } else {
      // Windows: wmic / fsutil — best effort via C: drive
      const out = execSync("wmic logicaldisk get size,freespace,caption", { timeout: 1500, encoding: "utf8" });
      for (const line of out.split("\n")) {
        if (line.includes("C:")) {
          const nums = line.match(/\d+/g);
          if (nums && nums.length >= 2) {
            const free = parseInt(nums[0], 10);
            const total = parseInt(nums[1], 10);
            if (total > 0) return { total, free, used: total - free };
          }
        }
      }
    }
  } catch {}
  return null;
}

function buildPingText(latencyMs) {
  const cpus = os.cpus();
  const cpuModel = (cpus[0]?.model || "Unknown CPU").trim();
  const cpuCores = cpus.length;
  const cpuSpeed = cpus[0]?.speed ? `${cpus[0].speed} MHz` : "";
  const cpuPct = cpuUsagePercent().toFixed(1);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPct = totalMem ? (usedMem / totalMem * 100).toFixed(1) : "0";

  const heap = process.memoryUsage();
  const disk = diskInfo();

  const platform = `${os.platform()} ${os.arch()} (${os.type()} ${os.release()})`;
  const nodeVer = process.version;
  const botVer = (() => { try { return require("../../package.json").version; } catch { return "?"; } })();

  let diskLine = "Disk: N/A";
  if (disk) {
    const pct = disk.total ? (disk.used / disk.total * 100).toFixed(1) : "0";
    diskLine = `Disk: ${fmtBytes(disk.used)} / ${fmtBytes(disk.total)} (${pct}%) free ${fmtBytes(disk.free)}`;
  }

  const latencyStr = latencyMs != null ? `${latencyMs} ms` : "N/A";

  return (
    `🏓 *PONG*\n\n` +
    `• Latency: *${latencyStr}*\n` +
    `• Node: *${nodeVer}* | Bot: *v${botVer}*\n` +
    `• Platform: ${platform}\n` +
    `• Host: ${os.hostname()}\n` +
    `• CPU: ${cpuModel} ${cpuSpeed ? `(${cpuSpeed})` : ""}\n` +
    `  Cores: ${cpuCores} | Usage: ${cpuPct}%\n` +
    `• RAM: ${fmtBytes(usedMem)} / ${fmtBytes(totalMem)} (${memPct}%)\n` +
    `  Heap: ${fmtBytes(heap.rss)} (RSS) | ${fmtBytes(heap.heapUsed)}/${fmtBytes(heap.heapTotal)}\n` +
    `• ${diskLine}\n` +
    `• Uptime: bot ${fmtUptime(process.uptime())} | system ${fmtUptime(os.uptime())}`
  );
}

module.exports = { buildPingText };
