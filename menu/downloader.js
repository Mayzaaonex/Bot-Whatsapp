module.exports = {
  key: "downloader",
  emoji: "⬇️",
  title: "Downloader",
  description: "Kirim link TikTok, Instagram, Facebook, Spotify, Pinterest, atau Douyin untuk auto-download.",
  commands: [
    {
      command: "tiktok",
      description: "Download video TikTok tanpa watermark",
      usage: ".tiktok <link>",
      example: ".tiktok https://vt.tiktok.com/xxxxx",
    },
    {
      command: "ig",
      description: "Download foto/video/reels Instagram",
      usage: ".ig <link>",
      example: ".ig https://instagram.com/p/xxxxx",
    },
    {
      command: "instagram",
      description: "Alias .ig",
      usage: ".ig <link>",
      example: ".ig https://instagram.com/p/xxxxx",
    },
    {
      command: "fb",
      description: "Download video Facebook",
      usage: ".fb <link>",
      example: ".fb https://facebook.com/watch/xxxxx",
    },
    {
      command: "facebook",
      description: "Alias .fb",
      usage: ".fb <link>",
      example: ".fb https://facebook.com/watch/xxxxx",
    },
    {
      command: "spotify",
      description: "Download audio Spotify",
      usage: ".spotify <link>",
      example: ".spotify https://open.spotify.com/track/xxxxx",
    },
    {
      command: "pindl",
      description: "Download gambar/video Pinterest",
      usage: ".pindl <link>",
      example: ".pindl https://pin.it/xxxxx",
    },
    {
      command: "ytmp3",
      description: "Download audio YouTube (MP3)",
      usage: ".ytmp3 <link>",
      example: ".ytmp3 https://youtu.be/xxxxx",
    },
    {
      command: "ytmp4",
      description: "Download video YouTube (MP4)",
      usage: ".ytmp4 <link>",
      example: ".ytmp4 https://youtu.be/xxxxx",
    },
    {
      command: "douyin",
      description: "Download video Douyin",
      usage: ".douyin <link>",
      example: ".douyin https://v.douyin.com/xxxxx",
    },
  ],
};
