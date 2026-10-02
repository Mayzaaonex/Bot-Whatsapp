# WA Bot Base — @itsliaaa/baileys + Menu List Interaktif

## ⚠️ Sebelum mulai — baca ini

Project ini sekarang pakai **`@itsliaaa/baileys`**, sebuah fork komunitas
(bukan library resmi WhiskeySockets/Baileys). Fork ini nambahin dukungan
buat pesan interaktif (buttons, list, native flow) yang lebih rapi.

Yang perlu kamu tau:
- Ini tetap library **tidak resmi**, dibuat & di-maintain sendirian oleh
  satu developer (bukan tim besar) — https://github.com/itsliaaa/baileys
- Resiko: bisa berhenti di-update kapan aja, ada resiko supply-chain
  (install kode dari sumber pihak ketiga), dan gak ada jaminan WA gak
  akan nge-block fitur List ini juga suatu saat nanti.
- Kalau nanti fitur List ini juga gak reliable, base menu teks/angka versi
  sebelumnya (tanpa dependency tambahan) tetap jadi fallback paling aman.

## Cara jalanin

1. Pastikan Node.js versi 18+ sudah terpasang.
2. Install dependency:
   ```
   npm install
   ```
3. Jalankan bot:
   ```
   npm start
   ```
4. Scan QR yang muncul di terminal pakai WhatsApp di HP kamu.

## Cara pakai bot

- `.menu` → nampilin **List interaktif** berisi 11 kategori
  (ai, aiimage, maker, downloader, stream, search, stalker, tools,
  random, berita, game). List cuma jalan di chat pribadi (bukan grup).
- `.allmenu` → teks biasa, nampilin SEMUA command dari SEMUA kategori
  sekaligus (List gak muat kalau isinya sebanyak ini)
- `.ai` (atau kategori lain) → List interaktif isi kategori itu
- `.gemini` (tanpa isi apapun) → teks cara pakai command itu + contoh
- `.gemini <teks>` → jalanin command itu beneran (masih placeholder)

Klik salah satu opsi di List otomatis kekirim balik ke bot kayak user
ngetik manual (misal klik ".gemini" di List = sama kayak ngetik ".gemini").

## Whitelist grup

Bot **cuma merespon di grup yang udah di-whitelist**. Grup lain diemin total
(gak ada balasan, gak ada reaction). Chat pribadi tetap jalan seperti biasa.

- `.idgc` → (owner only) tampilin ID grup. Jalan di semua grup.
- `.setgc <idgc>` → (owner only) whitelist grup itu. Bisa dikirim dari chat mana aja.
- `.delgc <idgc>` → (owner only) cabut grup dari whitelist.
- Datanya disimpen di `database/whitelist.json`.
- `database/bot_config.json` nyimpen prefix (berubah tiap `.setprefix`).

## Struktur folder

```
wabase/
├── index.js                         -> entry point; koneksi WA, QR, autoread,
│                                      parsing pesan/List/nativeFlow, kick watcher
├── config.js                        -> runtime config: prefix, whitelist private/grup,
│                                      owner check termasuk resolve @lid
├── config.json                      -> config manual: prefix awal, admins, adminJids
├── package.json                     -> dependency + npm start
├── package-lock.json                -> lock dependency npm
├── README.md                        -> dokumentasi project
│
├── handlers/
│   └── messageHandler.js            -> semua routing command, guard whitelist,
│                                      owner command, AI, sticker, downloader, tools
│
├── menu/
│   ├── mainmenu.js                  -> registry seluruh kategori + findCategory/findCommand
│   ├── menuText.js                  -> builder menu List, nativeFlow, text, usage, allmenu
│   ├── ai.js                        -> menu command AI
│   ├── aiimage.js                   -> menu command AI Image
│   ├── maker.js                     -> menu sticker, brat, bratvid, wm
│   ├── downloader.js                -> menu TikTok, Instagram, Facebook
│   ├── stream.js                    -> menu streaming
│   ├── search.js                    -> menu pencarian
│   ├── stalker.js                   -> menu stalker
│   ├── tools.js                     -> menu tools: sticker, toimg, rvo, getprofile, dll
│   ├── random.js                    -> menu random
│   ├── berita.js                    -> menu berita
│   ├── game.js                      -> menu game
│   └── owner.js                     -> menu command admin/owner
│
├── menusystem/
│   ├── ai.js                        -> provider API Gemini, ChatGPT, DeepSeek, dll
│   ├── aiimage.js                   -> removebg, sketch, enhancer, img2img, dll
│   ├── maker.js                     -> request brat/bratvid + download media API
│   ├── downloader.js                -> detect URL TikTok/IG/FB, panggil API, parse result
│   └── menuImage.js                 -> pilih gambar random dari assets/ untuk header menu
│
├── systemconverter/
│   ├── jid.js                       -> normalisasi nomor, JID, mapping @lid ke nomor
│   ├── ffmpeg.js                    -> convert video/GIF ke animated WebP
│   ├── jpg-pngtowebp.js             -> convert gambar ke WebP sticker
│   ├── stickerMeta.js               -> EXIF pack/author + rename metadata sticker (.wm)
│   └── tempDir.js                   -> folder file sementara converter
│
├── database/
│   ├── bot_config.json              -> prefix runtime + whitelist chat private
│   └── whitelist.json               -> daftar JID grup yang boleh direspon bot
│
├── assets/
│   ├── 1.jpg                        -> gambar header menu
│   ├── 2.jpg                        -> gambar header menu
│   └── README.md                    -> catatan asset
│
├── env/
│   ├── .env.sticker                 -> packname/author default sticker
│
├── auth_info/                       -> sesi WhatsApp Baileys; rahasia, jangan dibagikan
│   ├── creds.json                   -> kredensial akun WhatsApp
│   ├── app-state-sync-*.json        -> state sinkronisasi WhatsApp
│   └── device-list-*.json           -> daftar device WhatsApp
│
└── node_modules/                    -> dependency hasil npm install; jangan diedit manual
```

Alur fitur baru:
- Tambah nama/usage command: `menu/<kategori>.js`
- Tambah kategori: buat `menu/<kategori>.js`, lalu register di `menu/mainmenu.js`
- Tambah logic command: `handlers/messageHandler.js`
- Buat integrasi API/helper: `menusystem/`
- Buat convert media/JID/sticker: `systemconverter/`
- Simpan state runtime: `database/`

## Cara nambah command / kategori baru

Buka file kategorinya di `menu/<kategori>.js`, tambah objek baru di array
`commands`. Otomatis kebaca di `.menu`, `.allmenu`, List kategori, dan usage.
Kategori baru: buat file baru lalu daftarkan di `menu/mainmenu.js`.

## Changelog

| Versi | Tanggal | Catatan |
|-------|---------|---------|
| 1.2.2 | 2026-09-29 | bump patch |
| Versi | Tanggal | Catatan |
|-------|---------|---------|
| 1.2.1 | 2026-09-29 | bump patch |

## Kalau List juga gak muncul di device kamu

Ini kemungkinan besar berarti WA di sisi kamu (device/app version)
konsisten nge-block segala jenis pesan interaktif tidak resmi — bukan
soal kodenya lagi. Solusi paling stabil di titik itu:
1. Balik ke menu teks/angka (base paling awal, gak ada dependency aneh)
2. Atau pindah ke WhatsApp Cloud API resmi dari Meta (dijamin muncul,
   tapi setup beda total, butuh akun Meta Business)
