const { buildDirectText } = require("./version");

const commands = [
  { command: "removebg", description: "Hapus background dari foto secara otomatis", usage: "kirim/reply foto lalu ketik .removebg", example: ".removebg" },
  { command: "tosketch", description: "Ubah foto jadi gambar sketsa pensil", usage: "kirim/reply foto lalu ketik .tosketch", example: ".tosketch" },
  { command: "hitamkan", description: "Ubah foto jadi hitam putih", usage: "kirim/reply foto lalu ketik .hitamkan", example: ".hitamkan" },
  { command: "topixel", description: "Ubah foto jadi pixel art", usage: "kirim/reply foto lalu ketik .topixel", example: ".topixel" },
  { command: "enhancer", description: "Pertajam & perbagus kualitas foto", usage: "kirim/reply foto lalu ketik .enhancer", example: ".enhancer" },
  { command: "image2prompt", description: "Analisis foto dan hasilkan prompt AI dari gambar", usage: "kirim/reply foto lalu ketik .image2prompt", example: ".image2prompt" },
  { command: "img2img", description: "Edit foto sesuai prompt yang kamu kasih", usage: "kirim/reply foto + caption .img2img <prompt>", example: ".img2img ubah background jadi pantai" },
];

module.exports = {
  key: "aiimage",
  emoji: "🖼️",
  title: "AI Image",
  description: "",
  get directText() { return buildDirectText("AI Image", "🖼️", commands); },
  commands,
};