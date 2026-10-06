const config = require("../../config");
const { normalizePhone } = require("../../systemconverter/jid");

function formatIntl(num) {
  const n = String(num || "");
  if (n.startsWith("62")) return `+${n.slice(0,2)} ${n.slice(2,5)} ${n.slice(5,9)} ${n.slice(9)}`.trim();
  return `+${n}`;
}

async function sendOwnerContact(sock, jid, quotedMsg) {
  const raw = (config.admins && config.admins[0]) || "";
  const waid = normalizePhone(raw) || "628000000000";
  const display = formatIntl(waid);
  const name = "Owner";
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nORG:Owner;\nTEL;type=CELL;type=VOICE;waid=${waid}:${display}\nEND:VCARD`;
  await sock.sendMessage(jid, {
    contacts: { displayName: name, contacts: [{ vcard }] }
  }, quotedMsg ? { quoted: quotedMsg } : undefined);
}

module.exports = { sendOwnerContact };
