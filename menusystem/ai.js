const { execFile } = require("child_process");
const path = require("path");

const PLUGIN_DIR = path.join(__dirname, "..", "_plugins", "AI");

function runPlugin(pluginFile, text) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(PLUGIN_DIR, pluginFile);
    execFile("node", [fullPath, text], { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${pluginFile}: ${stderr || err.message}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.status && parsed.result?.text) {
          resolve({ model: parsed.result.model, text: parsed.result.text });
        } else {
          resolve({ model: pluginFile.replace(".js", ""), text: stdout.trim() });
        }
      } catch {
        resolve({ model: pluginFile.replace(".js", ""), text: stdout.trim() });
      }
    });
  });
}

async function chatgpt(text) {
  return runPlugin("chatgpt.js", text);
}

async function deepai(text) {
  return runPlugin("deepai.js", text);
}

async function gemini(text) {
  return runPlugin("gemini.js", text);
}

async function deepseekV4Flash(text) {
  return runPlugin("deepseek-v4-flash.js", text);
}

async function deepseekV4Pro(text) {
  return runPlugin("deepseek-v4-pro.js", text);
}

async function gemini31Pro(text) {
  return runPlugin("Gemini-3.1-Pro.js", text);
}

module.exports = {
  chatgpt,
  deepai,
  gemini,
  deepseekV4Flash,
  deepseekV4Pro,
  gemini31Pro,
};