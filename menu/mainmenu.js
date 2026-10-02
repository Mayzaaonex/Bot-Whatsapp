const categories = [
  require("./ai"),
  require("./aiimage"),
  require("./maker"),
  require("./downloader"),
  require("./stream"),
  require("./search"),
  require("./stalker"),
  require("./tools"),
  require("./random"),
  require("./berita"),
  require("./game"),
  {
    key: "__allmenu__",
    emoji: "",
    title: "",
    description: "<--------------------------------------------->",
    isAllMenuSeparator: true, 
    commands: [],
  },
  require("./owner"), 
];


function findCategory(key) {
  return categories.find((cat) => cat.key === key.toLowerCase());
}

function findCommand(commandName) {
  const name = commandName.toLowerCase();
  for (const category of categories) {
    const found = category.commands.find((c) => c.command === name);
    if (found) return { category, command: found };
  }
  return null;
}

module.exports = { categories, findCategory, findCommand };
