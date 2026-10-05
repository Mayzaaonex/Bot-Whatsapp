const { getVersion } = require("./version");

const commands = [
  { command: "gemini", description: "Chat pakai Google Gemini", usage: ".gemini <pertanyaan>", example: ".gemini halo, apa kabar?" },
  { command: "chatgpt", description: "Chat pakai ChatGPT", usage: ".chatgpt <pertanyaan>", example: ".chatgpt jelasin fotosintesis dong" },
  { command: "deepai", description: "Chat pakai DeepAI", usage: ".deepai <pertanyaan>", example: ".deepai apa itu machine learning?" },
  { command: "deepseekflash", description: "Chat pakai DeepSeek v4 Flash", usage: ".deepseekflash <pertanyaan>", example: ".deepseekflash jelasin quantum computing" },
  { command: "deepseekpro", description: "Chat pakai DeepSeek v4 Pro", usage: ".deepseekpro <pertanyaan>", example: ".deepseekpro buatin rencana bisnis simpel" },
  { command: "gemini31pro", description: "Chat pakai Gemini 3.1 Pro", usage: ".gemini31pro <pertanyaan>", example: ".gemini31pro ringkas artikel ini" },
];

module.exports = {
  key: "ai",
  emoji: "🤖",
  title: "AI",
  description: "",
  get directText() {
    const version = getVersion();
    return (
      "🤖 *AI Commands*\n\n" +
      "• *.gemini <pertanyaan>*\n" +
      "• *.chatgpt <pertanyaan>*\n" +
      "• *.deepai <pertanyaan>*\n" +
      "• *.deepseekflash <pertanyaan>*\n" +
      "• *.deepseekpro <pertanyaan>*\n" +
      "• *.gemini31pro <pertanyaan>*\n\n" +
      `> Mayzaabot-v${version}`
    );
  },
  commands,
};