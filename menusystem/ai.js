const path = require("path");
const { runNode } = require("../systemconverter/pluginRunner");
const PLUGIN_DIR = path.join(__dirname, "..", "_plugins", "AI");
async function runPlugin(pluginFile, text) {
  const fullPath = path.join(PLUGIN_DIR, pluginFile);
  const { json, stdout } = await runNode(fullPath, [text]);
  if (json.status && json.result?.text) return { model: json.result.model, text: json.result.text };
  return { model: pluginFile.replace(".js", ""), text: String(stdout).trim() };
}
async function chatgpt(text) { return runPlugin("chatgpt.js", text); }
async function deepai(text) { return runPlugin("deepai.js", text); }
async function gemini(text) { return runPlugin("gemini.js", text); }
async function deepseekV4Flash(text) { return runPlugin("deepseek-v4-flash.js", text); }
async function deepseekV4Pro(text) { return runPlugin("deepseek-v4-pro.js", text); }
async function gemini31Pro(text) { return runPlugin("Gemini-3.1-Pro.js", text); }
module.exports = { chatgpt, deepai, gemini, deepseekV4Flash, deepseekV4Pro, gemini31Pro };
