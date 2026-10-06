# Bot WhatsApp Multi-Device

Bot WhatsApp berbasis Node.js + [`@itsliaaa/baileys`](https://github.com/itsliaaa/baileys) dengan menu interaktif (List / nativeFlow), downloader, sticker tools, AI, dan kontrol owner/whitelist grup.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Baileys](https://img.shields.io/badge/Baileys-community%20fork-blue)](https://github.com/itsliaaa/baileys)
[![Version](https://img.shields.io/badge/version-1.2.22-orange)](./package.json)
[![License](https://img.shields.io/badge/license-ISC-lightgrey)](#)

## Daftar Isi
- [Fitur](#fitur)
- [Persyaratan](#persyaratan)
- [Instalasi & Menjalankan](#instalasi--menjalankan)
- [Cara Pakai](#cara-pakai)
- [Whitelist Grup](#whitelist-grup)
- [Konfigurasi Owner](#konfigurasi-owner)
- [Struktur Folder](#struktur-folder)
- [Tambah Command / Kategori](#tambah-command--kategori)
- [Catatan Baileys Fork](#catatan-baileys-fork)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)

## Fitur
- **Menu interaktif**: `.menu` (kategori), `.allmenu` (semua command), usage per-command
- **AI**: `gemini`, `chatgpt`, `deepai`, `deepseek`, dll (`menu/ai.js` + `menusystem/ai.js`)
- **AI Image**: `removebg`, `tosketch`, `hitamkan`, `enhancer`, `image2prompt`, `img2img`, `topixel`
- **Sticker tools**: `.s` / `.stiker`, `.toimg`, `.wm` (rename pack), `.brat`, `.bratvid`
- **Downloader**: TikTok, Instagram, Facebook, Spotify, Pinterest, Douyin, YouTube (`ytmp3`/`ytmp4`)
- **Stream/Search/Stalker/Random/Berita/Game** — masing-masing kategori di `menu/`
- **Kontrol owner**: `.setprefix`, `.setnick`, `.useprofile`, `.usebanner`, `listgc`/`joingc`/`outgc`
- **Whitelist**: private chat (`addwl`/`removewl`) + grup (`setgc`/`delgc`/`whitelist.json`)
- **JID-aware**: support nomor biasa dan `@lid` (LID resolve + cache)

## Persyaratan
- Node.js **18+** dan npm
- **FFmpeg** di `PATH` (untuk sticker video/GIF dan `bratvid`)
- Akun WhatsApp yang bisa scan QR

## Instalasi & Menjalankan

```bash
npm install
npm start
# atau
node index.js
```

Scan QR di terminal pakai WhatsApp HP kamu. Sesi login tersimpan di `auth_info/` (jangan di-commit, sudah di `.gitignore`).

Bump versi (sinkron `package.json` + entri `README.md` → Changelog):

```bash
npm run bump        # patch  1.2.2 -> 1.2.3
npm run bump:minor  # minor
npm run bump:major  # major
```

Versi bot diambil langsung dari `package.json` (tidak ada lagi `env/.env.versions`).

## Cara Pakai

| Perintah | Fungsi |
|---|---|
| `.menu` | List interaktif 11 kategori (hanya di chat pribadi) |
| `.allmenu` | Semua command sekaligus dalam teks |
| `.ai` `.maker` `.downloader` ... | Buka kategori tertentu |
| `.gemini <teks>` | Jalankan command AI (tanpa argumen = tampilkan usage) |
| `.s` (reply foto/video) | Jadikan sticker |
| `.owner` | Menu khusus owner (silent untuk non-owner) |

> Klik opsi di List/nativeFlow otomatis terkirim balik ke bot seperti mengetik manual (mis. klik `.gemini` = sama dengan mengetik `.gemini`).

## Whitelist Grup
Bot **hanya merespon di grup yang sudah di-whitelist**. Grup lain didiamkan total (tanpa balasan/reaction). Chat pribadi tetap normal.

- `.idgc` — (owner only) tampilkan ID grup saat ini. Jalan di semua grup.
- `.setgc <idgc>` — whitelist grup (bisa dari chat mana saja)
- `.delgc <idgc>` — cabut grup dari whitelist
- `.listgc` / `.listgrup` — daftar grup yang diikuti bot (owner only)
- `.joingc <link undangan>` — join via link lalu auto-whitelist
- `.outgc` / `.outgc <nomor|idgc>` — keluar grup
- Data disimpan di `database/whitelist.json`
- `database/bot_config.json` menyimpan prefix runtime (berubah via `.setprefix`)

## Konfigurasi Owner

Edit `config.json` di root:

```json
{
  "prefix": ".",
  "admins": ["081234567890"],
  "adminJids": []
}
```

- `admins` — nomor HP owner (format `08xxx` atau `628xxx`, keduanya dinormalisasi)
- `adminJids` — JID mentah untuk akun `@lid` yang tidak bisa di-resolve via nomor
- Prefix runtime bisa diubah tanpa restart: `.setprefix !` (tersimpan di `database/bot_config.json`)

## Struktur Folder

```
wabase/
├── index.js                 → entry point, koneksi WA, QR, autoread, kick watcher
├── config.js                → runtime config: prefix, whitelist, isOwner/isOwnerAsync
├── config.json              → config manual owner (admins, prefix awal)
├── package.json             → dependency + scripts (start, bump)
├── handlers/
│   └── messageHandler.js    → routing semua command, guard whitelist, reaction
├── menu/
│   ├── mainmenu.js          → registry kategori + findCategory/findCommand
│   ├── menuText.js          → builder List / nativeFlow / text / usage / allmenu
│   ├── ai.js aiimage.js maker.js downloader.js stream.js search.js
│   ├── stalker.js tools.js random.js berita.js game.js owner.js
├── menusystem/
│   ├── ai.js aiimage.js maker.js downloader.js menuImage.js
├── systemconverter/
│   ├── jid.js               → normalizePhone, jidToNumber, resolvePNForLid
│   ├── stickerMeta.js       → EXIF pack/author, restampStickerMeta (.wm)
│   ├── ffmpeg.js jpg-pngtowebp.js tempDir.js
├── database/
│   ├── whitelist.json       → daftar JID grup yang di-whitelist
│   └── bot_config.json      → prefix runtime (di-ignore git)
├── env/
│   └── .env.sticker         → packname/author default sticker
├── assets/                  → 1.jpg, 2.jpg (header menu)
├── auth_info/               → sesi Baileys (jangan dibagikan, di-ignore git)
└── _plugins/                → plugin AI & Downloader
```

## Tambah Command / Kategori

1. **Tambah command**: buka `menu/<kategori>.js`, tambah objek di array `commands`
   ```js
   { command: "namabaru", description: "...", usage: ".namabaru <arg>", example: ".namabaru halo" }
   ```
   Otomatis muncul di `.menu`, `.allmenu`, dan `buildCommandUsage`.

2. **Kategori baru**: buat `menu/<namakategori>.js`, lalu daftarkan di `menu/mainmenu.js`:
   ```js
   require("./namakategori"),
   ```

3. **Logic command**: implementasi di `handlers/messageHandler.js` (cek `parseCommand`, guard whitelist, `react`).

4. **Integrasi API/helper**: taruh di `menusystem/` atau `systemconverter/`.

## Catatan Baileys Fork

Project ini memakai **`@itsliaaa/baileys`** — fork komunitas (bukan resmi WhiskeySockets/Baileys) yang menambah dukungan pesan interaktif (buttons, list, native flow) lebih rapi.

- Library tidak resmi, di-maintain satu developer: https://github.com/itsliaaa/baileys
- Risiko: bisa berhenti di-update, ada risiko supply-chain, dan WA bisa memblokir fitur List sewaktu-waktu
- Jika List tidak reliable, fallback paling aman adalah menu teks/angka tanpa dependency tambahan

## Troubleshooting

**List tidak muncul di HP kamu**
> WA di device/app version tersebut memblokir pesan interaktif tidak resmi — bukan bug kode. Solusi: pakai `.allmenu` / menu teks, atau pindah ke WhatsApp Cloud API resmi Meta (setup berbeda total).

**Sticker video/GIF gagal**
> Pastikan FFmpeg terpasang dan `ffmpeg` ada di `PATH`. Di Windows cek `C:\ffmpeg\bin\ffmpeg.exe`.

**Bot tidak merespon di grup**
> Cek whitelist: grup harus di-`setgc` dulu oleh owner. Chat pribadi tidak terpengaruh whitelist grup.

**Prefix tidak berubah**
> `.setprefix` menyimpan ke `database/bot_config.json`. Jika file terhapus, prefix kembali ke `config.json`.

## Changelog

| Versi | Tanggal | Catatan |
|-------|---------|---------|
| 1.2.22 | 2026-10-06 | integrasi Tools (domaininfo, iplocation, qrgenerator, recordweb, removebg, ssweb, topixel) + deps cheerio/qrcode, handler import Tools |
| 1.2.21 | 2026-10-06 | menu AI Image sync plugins (hanya tosketch, hitamkan, image2prompt, img2img) |
| 1.2.20 | 2026-10-06 | .update progress edit pesan + countdown restart 5→0 |
| 1.2.19 | 2026-10-06 | ignore AGENTS.md di git |
| 1.2.18 | 2026-10-06 | sensor nomor (README/menu/handler contoh -> 081234567890, asli hanya di config.json) |
| 1.2.17 | 2026-10-06 | .owner kirim kontak vCard + .ownermenu list owner-only |
| 1.2.16 | 2026-10-06 | swgc kirim ke grup langsung |
| 1.2.15 | 2026-10-06 | fix ping PONG + swgc current-group |
| 1.2.14 | 2026-10-06 | fix IG box caption order |
| 1.2.10 | 2026-10-05 | IG download_url priority |
| 1.2.9 | 2026-10-05 | force update (reset --hard) |
| 1.2.8 | 2026-10-05 | fix checkupdate changelog (1 terbaru) |
| 1.2.7 | 2026-10-05 | public script command |
| 1.2.6 | 2026-10-05 | ping public + checkupdate/version/update owner, run via main.js |
| 1.2.5 | 2026-10-05 | bump patch |
| 1.2.4 | 2026-10-05 | bump patch |
| 1.2.3 | 2026-10-05 | add addmeta + swgc |
| 1.2.2 | 2026-09-29 | Hapus `env/.env.versions`, versi now dari `package.json`; bump script hanya sync `package.json` + README; perbaiki README |
| 1.2.1 | 2026-09-29 | bump patch |
