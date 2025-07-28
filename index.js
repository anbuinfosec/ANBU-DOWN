const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { formatDuration } = require("./utils");

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const API = "https://api.anbuinfosec.xyz/api/downloader/download";
const AUTO_DELETE_MS = 24 * 60 * 60 * 1000; // 24 hours
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
const CHANNEL_USERNAME = '@anbuinfosec_official'; // Make sure this is your exact channel username with '@'
const CHANNEL_JOIN_URL = 'https://t.me/anbuinfosec_official';
const DEVELOPER_URL = 'https://t.me/anbuinfosec';

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  logger.info(`Created downloads directory at ${DOWNLOADS_DIR}`);
}

const userMediaMap = new Map();
const userLastAction = {};
const startTime = Date.now();

function autoDelete(ctx, messageId) {
  setTimeout(async () => {
    try {
      await ctx.deleteMessage(messageId);
      logger.info(`Deleted message ${messageId} for chat ${ctx.chat.id}`);
    } catch (e) {
      logger.warn(`Failed to delete message ${messageId}: ${e.message}`);
    }
  }, AUTO_DELETE_MS);
}

// Middleware to check channel membership before processing any private messages (text or callbacks)
bot.use(async (ctx, next) => {
  try {
    if (!ctx.from || ctx.from.is_bot) return next();
    if (ctx.chat && ctx.chat.type !== 'private') return next();

    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    logger.info(`Membership check for user ${ctx.from.id}: ${JSON.stringify(member)}`);

    // If not joined or restricted, prompt to join
    if (!member || member.status === 'left' || member.status === 'kicked' || member.status === 'restricted') {
      if (ctx.message && ctx.message.text) {
        userLastAction[ctx.from.id] = { type: 'text', data: ctx.message.text };
      } else if (ctx.callbackQuery && ctx.callbackQuery.data) {
        userLastAction[ctx.from.id] = { type: 'callback', data: ctx.callbackQuery.data };
      }

      await ctx.replyWithMarkdown(
        `🚫 *You must join our channel to use this bot!*\n\n[Join Channel](${CHANNEL_JOIN_URL})`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Join Channel', url: CHANNEL_JOIN_URL }],
              [{ text: 'Joined ✅', callback_data: 'joined_check' }]
            ]
          }
        }
      );
      return; // stop further processing until user joins
    }

    return next();
  } catch (err) {
    logger.error('Channel join check failed', { userId: ctx.from?.id, error: err.message });
    await ctx.replyWithMarkdown(
      `🚫 *You must join our channel to use this bot!*\n\n[Join Channel](${CHANNEL_JOIN_URL})`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Join Channel', url: CHANNEL_JOIN_URL }],
            [{ text: 'Joined ✅', callback_data: 'joined_check' }]
          ]
        }
      }
    );
  }
});

bot.start((ctx) => {
  logger.info(`User ${ctx.from.id} started the bot`);
  ctx.reply("Send me any social media video URL to download.");
});

bot.command("ping", async (ctx) => {
  const start = Date.now();
  const sent = await ctx.reply("Pong...");
  const ms = Date.now() - start;
  await ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null, `Pong! Response time: ${ms}ms`);
  logger.info(`Ping from user ${ctx.from.id}: ${ms}ms`);
  autoDelete(ctx, sent.message_id);
  autoDelete(ctx, ctx.message.message_id);
});

bot.command("uptime", (ctx) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  ctx.reply(`Bot uptime: ${formatDuration(uptimeSeconds)}`);
  logger.info(`Uptime requested by user ${ctx.from.id}`);
  autoDelete(ctx, ctx.message.message_id);
});

// Handler for the "Joined ✅" button callback
bot.action('joined_check', async (ctx) => {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    logger.info(`Membership check for user ${ctx.from.id} (joined_check): ${JSON.stringify(member)}`);

    if (!member || member.status === 'left' || member.status === 'kicked' || member.status === 'restricted') {
      await ctx.answerCbQuery('❌ You have not joined the channel yet.', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('✅ Membership confirmed!');

    if (ctx.callbackQuery.message) {
      await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    }

    const last = userLastAction[ctx.from.id];
    if (last) {
      delete userLastAction[ctx.from.id];

      if (last.type === 'text') {
        const fakeUpdate = {
          message: {
            ...ctx.callbackQuery.message,
            text: last.data,
            from: ctx.from,
            chat: ctx.chat,
            message_id: ctx.callbackQuery.message.message_id,
            date: Math.floor(Date.now() / 1000),
          }
        };
        await bot.handleUpdate(fakeUpdate);
      } else if (last.type === 'callback') {
        const fakeUpdate = {
          callback_query: {
            ...ctx.callbackQuery,
            data: last.data,
            from: ctx.from,
            message: ctx.callbackQuery.message,
            id: ctx.callbackQuery.id,
            chat_instance: ctx.callbackQuery.chat_instance
          }
        };
        await bot.handleUpdate(fakeUpdate);
      }
    } else {
      await ctx.replyWithMarkdown(
        '✅ You have joined the channel! Now send your request again.',
        Markup.inlineKeyboard([
          Markup.button.url('Join Channel', CHANNEL_JOIN_URL),
          Markup.button.url('Developer', DEVELOPER_URL)
        ], { columns: 2 })
      );
    }
  } catch (err) {
    logger.error('Joined check failed', { userId: ctx.from?.id, error: err.message || err.toString() });
    await ctx.replyWithMarkdown('❌ Error checking membership. Please try again.');
  }
});

bot.on("text", async (ctx) => {
  const url = ctx.message.text.trim();
  if (!url.startsWith("http")) return;
  logger.info(`Received URL from user ${ctx.from.id}: ${url}`);

  let processingMsg;
  try {
    processingMsg = await ctx.reply("Fetching media, please wait...");

    const res = await axios.get(`${API}?url=${encodeURIComponent(url)}&apikey=${process.env.API_KEY}`);
    const data = res.data;

    if (!data.status || !data.success || data.error || !data.medias || data.medias.length === 0) {
      await ctx.reply("Failed to fetch media or no media found.");
      return;
    }

    const caption =
      `Title: ${data.title || "N/A"}\n` +
      `Source: ${data.source || "N/A"}\n` +
      `Author: ${data.author || "N/A"}\n` +
      `Duration: ${formatDuration(data.duration)}`;

    const buttons = [];
    for (let i = 0; i < data.medias.length; i += 2) {
      const row = [];
      row.push(Markup.button.callback(`${data.medias[i].type.toUpperCase()} - ${data.medias[i].quality || "Audio"}`, `download_${i}`));
      if (data.medias[i + 1])
        row.push(Markup.button.callback(`${data.medias[i + 1].type.toUpperCase()} - ${data.medias[i + 1].quality || "Audio"}`, `download_${i + 1}`));
      buttons.push(row);
    }

    await ctx.replyWithPhoto(data.thumbnail, {
      caption,
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });

    userMediaMap.set(ctx.from.id, { medias: data.medias, title: data.title || "media" });
    await ctx.deleteMessage(processingMsg.message_id);
    autoDelete(ctx, ctx.message.message_id);

  } catch (err) {
    logger.error("Error fetching media:", err);
    if (processingMsg) {
      try {
        await ctx.editMessageText("Error fetching media, please try again.");
      } catch {}
    } else {
      ctx.reply("Error fetching media, please try again.");
    }
  }
});

bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  logger.info(`Button pressed by user ${ctx.from.id}: ${callbackData}`);

  await ctx.answerCbQuery();

  const match = callbackData.match(/^download_(\d+)$/);
  if (!match) return ctx.reply("Unknown action.");

  const index = parseInt(match[1], 10);
  const userData = userMediaMap.get(ctx.from.id);
  if (!userData || !userData.medias[index]) return ctx.reply("Media not found.");

  const media = userData.medias[index];
  logger.info(`Downloading media for user ${ctx.from.id}: ${media.type} - ${media.quality || "Audio"}`);

  let filepath;

  try {
    try {
      await ctx.editMessageCaption("Downloading media, please wait...");
    } catch {}

    const response = await axios.get(media.url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);

    const ext = media.type === "video" ? ".mp4" : media.type === "audio" ? ".mp3" : "";
    const safeTitle = (userData.title || "media")
      .replace(/[\\/:*?"<>|\n\r]+/g, "_")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "")
      .slice(0, 50);

    const filename = `${safeTitle}_${index}${ext}`;
    filepath = path.join(DOWNLOADS_DIR, filename);

    fs.writeFileSync(filepath, buffer);
    logger.info(`Saved media to ${filepath}`);

    try {
      await ctx.editMessageCaption("Uploading media, please wait...");
    } catch {}

    if (media.type === "video") {
      await ctx.replyWithVideo({ source: fs.createReadStream(filepath) }, { caption: "Here’s your video!", supports_streaming: true });
    } else if (media.type === "audio") {
      await ctx.replyWithAudio({ source: fs.createReadStream(filepath) }, { caption: "Here’s your audio!" });
    } else {
      await ctx.reply("Unsupported media type.");
    }

    try {
      await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    } catch {}

    autoDelete(ctx, ctx.callbackQuery.message.message_id);

  } catch (err) {
    logger.error("Error sending media:", err);
    try {
      await ctx.reply("Error sending media.");
    } catch {}
  } finally {
    try {
      if (filepath && fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info(`Deleted file ${filepath}`);
      }
    } catch (e) {
      logger.warn(`Failed to delete file ${filepath}: ${e.message}`);
    }
  }
});

bot.launch()
  .then(() => {
    logger.success("anbu-down bot is running!");
    console.log("✅ anbu-down bot started successfully.");
  })
  .catch(err => {
    logger.error("Failed to launch bot:", err);
    console.error("❌ Failed to launch bot:", err);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
});

process.on("warning", (warning) => {
  logger.warn("Warning:", warning.name, warning.message);
});

process.on("exit", (code) => {
  logger.info(`Process exited with code: ${code}`);
});
