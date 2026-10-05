const META_AI_JID = "867051314767696@bot";

async function addMetaAI(sock, from) {
  try {
    await sock.groupParticipantsUpdate(from, [META_AI_JID], "add");
    return { success: true, text: "✅ Sukses add Meta AI ke grup." };
  } catch (e) {
    console.error("❌ Gagal addmeta:", e);
    return { success: false, text: `❌ Gagal nambahin Meta AI ke grup.\n${e?.message || e}` };
  }
}

module.exports = { addMetaAI, META_AI_JID };
