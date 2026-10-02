const { categories } = require("./mainmenu");
const config = require("../config");

const SEPARATOR = "-------------------------------";

function catLabel(cat) {
  return `${cat.emoji} ${cat.title}`;
}

function buildMainMenuList(introText) {
  const p = config.prefix;
  return {
    text:
      introText || "Pilih salah satu kategori di bawah buat lihat isinya 👇",
    buttonText: "📋 Lihat Kategori",
    title: "📜 Menu Bot",
    sections: [
      {
        title: "Kategori",
        rows: categories.map((cat) => ({
          title: catLabel(cat),
          description: cat.description,
          rowId: `${p}${cat.key}`,
        })),
      },
    ],
  };
}

function buildMainMenuInteractive(introText, imageBuffer) {
  const p = config.prefix;
  return {
    image: imageBuffer,
    caption:
      introText || "Pilih salah satu kategori di bawah buat lihat isinya 👇",
    title: "📜 Menu Bot",
    optionText: "📋 Lihat Kategori",
    optionTitle: "📜 Menu Bot",
    nativeFlow: [
      {
        text: "📋 Pilih Kategori",
        sections: [
          {
            title: "Kategori",
            rows: categories.map((cat) => ({
              header: "",
              title: catLabel(cat),
              description: cat.description,
              id: `${p}${cat.key}`,
            })),
          },
        ],
      },
    ],
  };
}

function buildMainMenuText() {
  const p = config.prefix;
  let text = "*📜 MENU BOT*\n" + SEPARATOR + "\n\n";
  for (const cat of categories) {
    if (cat.isAllMenuSeparator) {
      text += `${cat.emoji} *${cat.description}*\n`;
      text += `   → ketik *${p}allmenu* buat lihat semua command\n`;
      text += SEPARATOR + "\n";
      continue;
    }
    text += `${cat.emoji} *${p}${cat.key}*\n${cat.description}\n`;
    text += SEPARATOR + "\n";
  }
  text += `\nKetik *${p}allmenu* buat lihat semua command sekaligus.`;
  return text;
}

function buildCategoryMenuList(category) {
  const p = config.prefix;
  return {
    text: `${category.description}\nPilih command buat lihat cara pakenya 👇`,
    buttonText: "📋 Lihat Command",
    title: `${category.emoji} ${category.title}`,
    sections: [
      {
        title: category.title,
        rows: category.commands.map((cmd) => ({
          title: `${p}${cmd.command}`,
          description: cmd.description,
          rowId: `${p}${cmd.command}`,
        })),
      },
    ],
  };
}

function buildCategoryMenuInteractive(category) {
  const p = config.prefix;
  return {
    text: `${category.description}\nPilih command buat lihat cara pakenya 👇`,
    optionText: "📋 Lihat Command",
    optionTitle: `${category.emoji} ${category.title}`,
    nativeFlow: [
      {
        text: "📋 Pilih Command",
        sections: [
          {
            title: category.title,
            rows: category.commands.map((cmd) => ({
              header: "",
              title: `${p}${cmd.command}`,
              description: cmd.description,
              id: `${p}${cmd.command}`,
            })),
          },
        ],
      },
    ],
  };
}

function buildCategoryMenuText(category) {
  const p = config.prefix;
  let text = `${category.emoji} *${category.title.toUpperCase()}*\n`;
  text += `${category.description}\n${SEPARATOR}\n\n`;
  for (const cmd of category.commands) {
    text += `• *${p}${cmd.command}* - ${cmd.description}\n`;
    text += SEPARATOR + "\n";
  }
  text += `\nKetik *${p}${category.commands[0].command}* (tanpa isi) buat lihat cara pakenya.`;
  return text;
}

function buildCommandUsage(category, command) {
  const p = config.prefix;
  const usage = command.usage.replace(/^\./g, p);
  const example = command.example.replace(/^\./g, p);
  return (
    `*${p}${command.command}* (${category.title})\n` +
    SEPARATOR +
    `\n\n${command.description}\n\n` +
    `📌 Cara pakai:\n${usage}\n\n` +
    `📝 Contoh:\n${example}`
  );
}

function buildAllMenu() {
  const p = config.prefix;
  let text = "*📜 ALL MENU (semua command)*\n" + SEPARATOR + "\n\n";
  for (const cat of categories) {
    if (cat.isAllMenuSeparator) continue;
    text += `${cat.emoji} *${cat.title.toUpperCase()}*\n`;
    for (const cmd of cat.commands) {
      text += `• *${p}${cmd.command}* - ${cmd.description}\n`;
    }
    text += SEPARATOR + "\n\n";
  }
  return text.trim();
}

module.exports = {
  buildMainMenuList,
  buildMainMenuInteractive,
  buildMainMenuText,
  buildCategoryMenuList,
  buildCategoryMenuInteractive,
  buildCategoryMenuText,
  buildCommandUsage,
  buildAllMenu,
};
