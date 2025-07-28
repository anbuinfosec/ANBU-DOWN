# 📥 ANBU_DOWN — Telegram Media Downloader Bot

**ANBU_DOWN** is a Telegram bot built with [Telegraf](https://github.com/telegraf/telegraf) that allows users to download videos and audio from social media platforms using a custom API. It also enforces channel membership before allowing downloads.

---

## 🚀 Features

* ✅ Download video/audio from public social media links
* 🔗 Uses `https://api.anbuinfosec.xyz` as the media parser
* 🔐 Requires users to join a Telegram channel before using the bot
* 🧹 Deletes downloaded files after sending
* 🕒 Auto-deletes messages after 24 hours
* ⚙️ Simple commands: `/start`, `/ping`, `/uptime`
* 📦 Logs all actions using a custom logger

---

## 📁 Project Structure

```
.
├── index.js               # Main bot logic
├── logger.js              # Custom logger with colors
├── utils.js               # Utility functions (e.g. formatDuration)
├── downloads/             # Temporary directory to store media
├── .env                   # Environment variables
└── README.md              # You're here
```

---

## ⚙️ Requirements

* Node.js 18+
* Telegram Bot Token
* API key from `https://api.anbuinfosec.xyz`

---

## 📦 Installation

```bash
git clone https://github.com/anbuinfosec/ANBU_DOWN.git
cd ANBU_DOWN
npm install
```

---

## 🔐 Environment Variables

Create a `.env` file:

```env
BOT_TOKEN=your_telegram_bot_token
API_KEY=your_api_key_from_anbuinfosec
```

---

## 📌 Usage

```bash
node index.js
```

> ✅ On launch, the bot logs `ANBU_DOWN bot is running!`
> 🛡️ Make sure users have joined the channel set in `CHANNEL_USERNAME` before they can download media.

---

## 🧪 Commands

* `/start` — Shows a welcome message
* `/ping` — Bot response time
* `/uptime` — Shows how long the bot has been running

---

## 📤 How It Works

1. User sends a media link
2. Bot fetches metadata + download options via API
3. User selects video/audio quality
4. Bot downloads and sends the file
5. The file is deleted after sending

---

## 📺 Example API Call

```
GET https://api.anbuinfosec.xyz/api/downloader/download?url=<media_url>&apikey=<your_key>
```

---

## 💡 Tips

* Replace `@anbuinfosec_official` with your own channel in `index.js`
* Replace the API with any compatible downloader service if needed
* Use `pm2` or `systemd` to keep the bot running 24/7

---

## 📜 License

MIT © [anbuinfosec](https://t.me/anbuinfosec)