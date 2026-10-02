# /assets — Gambar Preview .menu

Taruh gambar di folder ini buat jadi preview pas orang ketik `.menu`.

- Nama file **bebas** — gak harus `1.jpg`, `2.jpg` urut. Boleh `budi.png`,
  `preview-baru.webp`, apa aja.
- Format yang didukung: `.jpg`, `.jpeg`, `.png`, `.webp`.
- Setiap `.menu` dipanggil, bot bakal milih **1 gambar secara ACAK**
  dari semua yang ada di folder ini.
- Mau nambah gambar? Tinggal copy file-nya ke sini, gak perlu restart
  bot atau edit kode apapun — langsung kebaca otomatis.
- Mau ganti yang 2 gambar bawaan (`1.jpg`, `2.jpg`)? Tinggal timpa /
  hapus filenya, ganti pake foto lu sendiri (bebas ukuran, disarankan
  persegi/square biar rapi pas jadi header di WA).

Full lokal — gak ada proses download dari internet sama sekali pas
`.menu` dipanggil, jadi gak ada delay.
