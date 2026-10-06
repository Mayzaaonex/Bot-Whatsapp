async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function swgc(sock, from, sender, args, config, isOwner) {
  if (!(await isOwner(sock, sender))) return { success: false, text: "❌ Khusus owner." };
  const raw = args.trim();
  const i = raw.indexOf("|");
  if (i < 0) return { success: false, text: "Format: .swgc | <pesan> atau .swgc all | <pesan>" };
  const target = raw.slice(0, i).trim();
  const msg = raw.slice(i + 1).trim();
  if (!msg) return { success: false, text: "Pesan tidak boleh kosong." };
  let gids = [];
  const isAll = target.toLowerCase() === "all";
  if (isAll) {
    try { const gs = await sock.groupFetchAllParticipating(); gids = Object.keys(gs); } catch (e) { return { success: false, text: `❌ Gagal ambil semua grup: ${e.message}` }; }
  } else {
    let gid = target;
    if (!gid) gid = from && String(from).endsWith("@g.us") ? String(from) : "";
    else gid = gid.endsWith("@g.us") ? gid : `${gid}@g.us`;
    if (!/^\d+(-\d+)?@g\.us$/.test(gid)) return { success: false, text: "❌ ID grup tidak valid. Pakai: .swgc | <pesan> (di grup) atau .swgc <id>@g.us | <pesan>" };
    try { await sock.groupMetadata(gid); } catch (e) { return { success: false, text: `❌ Grup tidak ditemukan: ${e.message}` }; }
    gids = [gid];
  }
  let sent = 0, failed = 0;
  for (const gid of gids) {
    try { await sock.sendMessage(gid, { text: msg }); sent++; } catch { failed++; }
    if (gids.length > 1) await sleep(800);
  }
  return { success: true, text: `╭━━〔 📤 SWGC 〕━━╮\n│ 👥 Grup : ${gids.length}\n│ 📤 Terkirim : ${sent}\n│ ⚠️ Gagal : ${failed}\n╰━━━━━━━━━━━━━━╯` };
}
module.exports = { swgc };
