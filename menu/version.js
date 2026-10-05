function getVersion() {
  try {
    return require("../package.json").version;
  } catch {
    return "unknown";
  }
}

function buildDirectText(title, emoji, commands) {
  const version = getVersion();
  let text = `${emoji} *${title} Commands*\n\n`;
  for (const c of commands) {
    text += `• *.${c.command}*\n`;
  }
  text += `\n> Mayzaabot-v${version}`;
  return text;
}

module.exports = { getVersion, buildDirectText };