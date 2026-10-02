


function normalizePhone(raw) {
  if (!raw) return "";
  let num = String(raw).replace(/\D/g, "");

  if (num.startsWith("0")) {
    num = "62" + num.slice(1);
  } else if (num.startsWith("620")) {

    num = "62" + num.slice(3);
  } else if (!num.startsWith("62")) {

    num = "62" + num;
  }
  return num;
}



function phoneToJid(phone) {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}



function jidToNumber(jid) {
  if (!jid) return null;
  if (
    jid.endsWith("@g.us") ||
    jid.endsWith("@newsletter") ||
    jid.endsWith("@lid") ||
    jid.endsWith("@broadcast")
  ) {
    return null;
  }
  const [user] = jid.split("@");

  return user.split(":")[0];
}



function jidType(jid) {
  if (!jid) return "unknown";
  if (jid.endsWith("@g.us")) return "group";
  if (jid.endsWith("@newsletter")) return "newsletter";
  if (jid.endsWith("@lid")) return "lid";
  if (jid.endsWith("@broadcast")) return "broadcast";
  if (jid.endsWith("@s.whatsapp.net")) return "personal";
  return "unknown";
}



function formatJidForLog(jid) {
  const type = jidType(jid);
  let number = jidToNumber(jid);

  if (!number && type === "lid" && _lidCache.has(jid)) {
    return `${_lidCache.get(jid)} (lid→personal)`;
  }

  return number ? `${number} (${type})` : `${jid} (${type})`;
}


const _lidCache = new Map();



async function resolvePNForLid(sock, lid) {
  if (!lid || !lid.endsWith("@lid")) return null;

  if (_lidCache.has(lid)) return _lidCache.get(lid);

  if (!sock?.signalRepository?.lidMapping?.getPNForLID) return null;

  try {
    const pnJid = await sock.signalRepository.lidMapping.getPNForLID(lid);
    if (!pnJid) return null;
    const number = jidToNumber(pnJid);
    if (!number) return null;

    _lidCache.set(lid, number);
    return number;
  } catch (e) {
    console.error(`⚠️  Gagal resolve LID ${lid}:`, e.message);
    return null;
  }
}



function getCachedPNForLid(lid) {
  return _lidCache.get(lid) || null;
}

module.exports = {
  normalizePhone,
  phoneToJid,
  jidToNumber,
  jidType,
  formatJidForLog,
  resolvePNForLid,
  getCachedPNForLid,
};
