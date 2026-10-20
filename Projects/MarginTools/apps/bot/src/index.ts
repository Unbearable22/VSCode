import "dotenv/config";
import { Bot } from "grammy";
import { db } from "../../../packages/database";
import { rateLimit } from "../../../packages/database/security";
import { answerWithAI } from "../../../packages/ai-agent";
import { fallbackCalculation } from "./core";
import { deliverNotifications } from "./notifications";
import { commandLabels, mainKeyboard, registerInterface } from "./interface";
import { escapeHtml, siteButtons } from "./presentation";
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error(
    "Telegram-бот не запущен: укажите TELEGRAM_BOT_TOKEN в .env. Сайт и калькуляторы работают независимо.",
  );
  process.exit(1);
}
const bot = new Bot(botToken),
  url = process.env.APP_URL || "http://localhost:3000";
const keyboard = mainKeyboard;
bot.use(async (ctx, next) => {
  if (!ctx.from) return;
  try {
    await rateLimit(`bot:${ctx.from.id}`, 20, 60);
    const enabled = await db.setting.findUnique({
      where: { key: "botEnabled" },
    });
    if (enabled?.value === false) {
      await ctx.reply(
        "⏸ <b>Бот временно выключен</b>\n\nКалькуляторы доступны на сайте.",
        {
          parse_mode: "HTML",
          reply_markup: siteButtons(url, [
            ["🧮 Открыть калькуляторы", "/calculators/"],
          ]),
        },
      );
      return;
    }
    await next();
  } catch {
    await ctx.reply(
      "⚠️ <b>Запрос временно не выполнен</b>\n\nПопробуйте позже или продолжите на сайте.",
      {
        parse_mode: "HTML",
        reply_markup: siteButtons(url, [["🌐 Открыть сайт", "/"]]),
      },
    );
  }
});
registerInterface(bot, url);
const help =
  "Выберите нужное действие кнопкой меню. Пример: «Закупка 80 тысяч, хочу маржу 20%».";
bot.on("message:text", async (ctx) => {
  try {
    const basic = fallbackCalculation(ctx.message.text);
    if (basic) {
      await ctx.reply("🧮 <b>Результат расчёта</b>\n\n" + escapeHtml(basic), {
        parse_mode: "HTML",
        reply_markup: siteButtons(url, [
          ["📝 Создать сделку на сайте", "/calculators/deal/"],
        ]),
      });
      return;
    }
    const answer = await answerWithAI(String(ctx.from.id), ctx.message.text);
    await ctx.reply(answer.slice(0, 4000), { reply_markup: keyboard });
  } catch {
    await db.auditLog.create({ data: { action: "error.bot" } });
    await ctx.reply(
      "💬 <b>ИИ сейчас недоступен</b>\n\nРасчёты, тарифы и меню продолжают работать.\n\n" +
        help,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  }
});
bot.catch(async () => {
  await db.auditLog.create({ data: { action: "error.telegram" } });
  console.error("Ошибка Telegram. Подробности запроса не записаны.");
});
let delivering = false;
const timer = setInterval(async () => {
  if (delivering) return;
  delivering = true;
  try {
    await deliverNotifications(bot);
  } catch {
    console.error("Не удалось обработать очередь уведомлений.");
  } finally {
    delivering = false;
  }
}, 30000);
const stop = () => {
  clearInterval(timer);
  bot.stop();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
async function main() {
  console.log("MarginTools: Telegram-бот запускается.");
  try {
    await bot.api.setMyCommands(
      Object.entries(commandLabels).map(([command, description]) => ({
        command,
        description,
      })),
    );
    await bot.start({ onStart: () => console.log("Telegram-бот готов.") });
  } catch {
    clearInterval(timer);
    console.error(
      "Telegram-бот не запущен. Проверьте токен, соединение и отсутствие другого процесса бота.",
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
void main();
