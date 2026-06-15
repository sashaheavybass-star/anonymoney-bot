require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { load, save } = require('./storage');
const { renderCakeAnimation, renderHeartsAnimation, formatMoney } = require('./cake');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!BOT_TOKEN) {
  throw new Error('Не задан BOT_TOKEN в .env');
}

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
const telegramOptions = proxyUrl ? { agent: new HttpsProxyAgent(proxyUrl) } : {};

const bot = new Telegraf(BOT_TOKEN, { telegram: telegramOptions });

function isAdmin(ctx) {
  return ADMIN_IDS.includes(String(ctx.from.id));
}

const BTN_STATUS = '🍰 Статус';
const BTN_HEARTS = '💖 Подбросить сердечки';
const BTN_SET = '💰 Сумма сбора';
const BTN_GOAL = '🎯 Цель сбора';
const BTN_TITLE = '✏️ Название сбора';
const BTN_CANCEL = '❌ Отмена';

const WEBAPP_URL = process.env.WEBAPP_URL;

function appButton() {
  if (!WEBAPP_URL) return null;
  return Markup.inlineKeyboard([
    Markup.button.webApp('🍰 Открыть приложение', WEBAPP_URL),
  ]);
}

function mainKeyboard(ctx) {
  const rows = [[BTN_STATUS, BTN_HEARTS]];
  if (isAdmin(ctx)) {
    rows.push([BTN_SET, BTN_GOAL]);
    rows.push([BTN_TITLE]);
  }
  return Markup.keyboard(rows).resize();
}

// id пользователя -> что от него ждём ('set' | 'goal' | 'title')
const pendingInput = new Map();

async function sendPie(ctx) {
  const data = load();
  await ctx.sendChatAction('upload_video');
  const buffer = await renderCakeAnimation(data);
  await ctx.replyWithAnimation({ source: buffer }, {
    ...mainKeyboard(ctx),
  });
}

async function sendHearts(ctx) {
  const data = load();
  await ctx.sendChatAction('upload_video');
  const buffer = await renderHeartsAnimation(data);
  await ctx.replyWithAnimation({ source: buffer }, {
    ...mainKeyboard(ctx),
  });
}

bot.start(async (ctx) => {
  await ctx.reply(
    'Привет! Я показываю прогресс сбора средств на юбилей.\n\nИспользуйте панель кнопок ниже 👇',
    mainKeyboard(ctx)
  );
  const btn = appButton();
  if (btn) {
    await ctx.reply('Откройте мини-приложение:', btn);
  }
});

bot.command('app', async (ctx) => {
  const btn = appButton();
  if (!btn) return ctx.reply('Мини-приложение пока не настроено.');
  await ctx.reply('Откройте мини-приложение:', btn);
});

bot.hears(BTN_STATUS, sendPie);
bot.hears(BTN_HEARTS, sendHearts);

bot.hears(BTN_CANCEL, (ctx) => {
  pendingInput.delete(ctx.from.id);
  return ctx.reply('Отменено.', mainKeyboard(ctx));
});

bot.hears(BTN_SET, (ctx) => {
  if (!isAdmin(ctx)) return;
  pendingInput.set(ctx.from.id, 'set');
  return ctx.reply('Введите текущую собранную сумму (число):', Markup.keyboard([[BTN_CANCEL]]).resize());
});

bot.hears(BTN_GOAL, (ctx) => {
  if (!isAdmin(ctx)) return;
  pendingInput.set(ctx.from.id, 'goal');
  return ctx.reply('Введите цель сбора (число):', Markup.keyboard([[BTN_CANCEL]]).resize());
});

bot.hears(BTN_TITLE, (ctx) => {
  if (!isAdmin(ctx)) return;
  pendingInput.set(ctx.from.id, 'title');
  return ctx.reply('Введите новое название сбора:', Markup.keyboard([[BTN_CANCEL]]).resize());
});

bot.command('status', sendPie);

bot.command('setgoal', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Эта команда доступна только администратору.');
  const arg = ctx.message.text.split(' ').slice(1).join(' ').replace(/[^\d.,]/g, '').replace(',', '.');
  const value = parseFloat(arg);
  if (!arg || isNaN(value) || value <= 0) {
    return ctx.reply('Использование: /setgoal <сумма>\nНапример: /setgoal 100000');
  }
  const data = load();
  data.goal = value;
  save(data);
  await ctx.reply(`Цель установлена: ${formatMoney(value)} ₽`);
  await sendPie(ctx);
});

bot.command('set', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Эта команда доступна только администратору.');
  const arg = ctx.message.text.split(' ').slice(1).join(' ').replace(/[^\d.,]/g, '').replace(',', '.');
  const value = parseFloat(arg);
  if (!arg || isNaN(value) || value < 0) {
    return ctx.reply('Использование: /set <сумма>\nНапример: /set 35000');
  }
  const data = load();
  data.current = value;
  save(data);
  await ctx.reply(`Текущая сумма обновлена: ${formatMoney(value)} ₽`);
  await sendPie(ctx);
});

bot.command('settitle', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Эта команда доступна только администратору.');
  const title = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!title) {
    return ctx.reply('Использование: /settitle <название сбора>');
  }
  const data = load();
  data.title = title;
  save(data);
  await ctx.reply(`Название обновлено: «${title}»`);
});

bot.on('text', async (ctx) => {
  const mode = pendingInput.get(ctx.from.id);
  if (!mode || !isAdmin(ctx)) return;
  const text = ctx.message.text.trim();

  if (mode === 'title') {
    pendingInput.delete(ctx.from.id);
    const data = load();
    data.title = text;
    save(data);
    await ctx.reply(`Название обновлено: «${text}»`, mainKeyboard(ctx));
    return sendPie(ctx);
  }

  const value = parseFloat(text.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (isNaN(value) || value < 0) {
    return ctx.reply('Нужно ввести число. Попробуйте ещё раз или нажмите «Отмена».');
  }

  pendingInput.delete(ctx.from.id);
  const data = load();
  if (mode === 'set') {
    data.current = value;
    save(data);
    await ctx.reply(`Текущая сумма обновлена: ${formatMoney(value)} ₽`, mainKeyboard(ctx));
  } else if (mode === 'goal') {
    data.goal = value;
    save(data);
    await ctx.reply(`Цель установлена: ${formatMoney(value)} ₽`, mainKeyboard(ctx));
  }
  return sendPie(ctx);
});

bot.launch().then(() => console.log('Бот запущен'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
