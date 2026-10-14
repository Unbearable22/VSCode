import { Bot, Context, InlineKeyboard, InputFile, Keyboard } from "grammy";
import { calculate, decimal } from "../../../packages/calculations";
import { db } from "../../../packages/database";
import { invokeTool } from "../../../packages/ai-agent";
import { linkAccount } from "./core";
import { ownProposals, ownProposalPdf } from "./proposals";
import { escapeHtml, displayNumber, siteButtons } from "./presentation";

export const commandLabels = {
  start: "🏠 Главное меню",
  calculate: "🧮 Рассчитать",
  proposal: "📄 Коммерческие предложения",
  account: "💼 Мой кабинет",
  pricing: "💳 Тарифы",
  help: "❓ Помощь",
  stop: "🔕 Отключить рассылку",
};
export const mainKeyboard = Keyboard.from([
  [commandLabels.calculate, commandLabels.proposal],
  [commandLabels.account, commandLabels.pricing],
  [commandLabels.help, commandLabels.start],
  [commandLabels.stop],
])
  .resized()
  .persistent();
const cancelLabel = "❌ Отменить расчёт";
type Definition = {
  label: string;
  kind: string;
  mode?: string;
  fields: Array<[string, string]>;
};
const cost: [string, string] = ["cost", "Введите закупочную цену, ₽."];
const price: [string, string] = ["price", "Введите цену продажи, ₽."];
const definitions: Record<string, Definition> = {
  margin: { label: "📊 Маржа", kind: "margin", fields: [cost, price] },
  markup: { label: "📈 Наценка", kind: "markup", fields: [cost, price] },
  "selling-margin": {
    label: "🎯 Цена от маржи",
    kind: "selling-price",
    mode: "margin",
    fields: [cost, ["percent", "Введите желаемую маржу, % (меньше 100)."]],
  },
  "selling-markup": {
    label: "🏷 Цена от наценки",
    kind: "selling-price",
    mode: "markup",
    fields: [cost, ["percent", "Введите желаемую наценку, %."]],
  },
  "vat-add": {
    label: "➕ Начислить НДС",
    kind: "vat",
    mode: "add",
    fields: [
      ["amount", "Введите сумму без НДС, ₽."],
      ["percent", "Введите применимую ставку НДС, %. Ставку выбираете вы."],
    ],
  },
  "vat-included": {
    label: "🧾 Выделить НДС",
    kind: "vat",
    mode: "included",
    fields: [
      ["amount", "Введите сумму с НДС, ₽."],
      ["percent", "Введите применимую ставку НДС, %. Ставку выбираете вы."],
    ],
  },
  discount: {
    label: "✂️ Скидка",
    kind: "discount",
    fields: [
      cost,
      price,
      ["percent", "Введите скидку, % (от 0 до 100)."],
      [
        "minimumProfit",
        "Введите минимальную торговую прибыль, ₽. Если ограничение не требуется, введите 0.",
      ],
    ],
  },
  "break-even": {
    label: "⚖️ Безубыточность",
    kind: "break-even",
    fields: [
      ["fixed", "Введите постоянные расходы, ₽."],
      price,
      ["variable", "Введите переменные расходы на единицу, ₽."],
    ],
  },
};
export const calculationKeyboard = InlineKeyboard.from(
  Object.entries(definitions).map(([key, value]) => [
    InlineKeyboard.text(value.label, `calc:${key}`),
  ]),
);
const labels: Record<string, string> = {
  cost: "Закупка, ₽",
  price: "Продажа, ₽",
  profit: "Торговая прибыль, ₽",
  margin: "Маржа, %",
  markup: "Наценка, %",
  base: "Сумма без НДС, ₽",
  vat: "НДС, ₽",
  total: "Итого, ₽",
  discount: "Сумма скидки, ₽",
  maxDiscount: "Максимальная скидка, %",
  units: "Количество для безубыточности",
  revenue: "Продажи для безубыточности, ₽",
  contribution: "Вклад единицы в покрытие расходов, ₽",
};
function resultText(kind: string, result: Record<string, unknown>) {
  const rows = Object.entries(result)
    .filter(([key]) => labels[key])
    .map(
      ([key, value]) =>
        `${labels[key]}: <b>${value === null ? "не определено" : displayNumber(value)}</b>`,
    );
  if (kind === "break-even" && result.units === null)
    rows.push("\n⚠️ При этой цене конечная точка безубыточности отсутствует.");
  if (result.feasible === false)
    rows.push("\n⚠️ Минимальная прибыль недостижима даже без скидки.");
  if (kind !== "vat" && kind !== "break-even")
    rows.push("\n<i>Дополнительные расходы и НДС не включены.</i>");
  return "🧮 <b>Результат расчёта</b>\n\n" + rows.join("\n");
}

export function registerInterface(bot: Bot, url: string) {
  // Draft input is private to this chat and sender, expires after ten minutes.
  const sessions = new Map<
    string,
    {
      key: string;
      step: number;
      values: Record<string, string>;
      expires: number;
    }
  >();
  const sessionId = (ctx: Context) => `${ctx.chat?.id}:${ctx.from?.id}`;
  const reply = (ctx: Context, text: string, buttons?: InlineKeyboard) =>
    ctx.reply(text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: buttons || mainKeyboard,
    });
  const help =
    "❓ <b>Как я могу помочь</b>\n\nЯ ИИ-помощник MarginTools.\n\n🧮 <b>Расчёты</b>\nВыберите инструмент в меню и введите числа по очереди.\n\n💬 <b>Можно написать задачу</b>\n<i>«Закупка 80 тысяч, хочу маржу 20%»</i>\n\n📄 <b>Коммерческие предложения</b>\nПодключите Telegram в кабинете, чтобы получать готовые КП в PDF.\n\nНужна помощь? Откройте поддержку кнопкой ниже.";
  const sendPdf = async (ctx: Context, id: string) => {
    const bytes = await ownProposalPdf(String(ctx.from!.id), id);
    await ctx.replyWithDocument(
      new InputFile(bytes, "commercial-proposal.pdf"),
      { reply_markup: mainKeyboard },
    );
  };
  const handlers: Record<
    keyof typeof commandLabels,
    (ctx: Context, argument?: string) => Promise<unknown>
  > = {
    start: async (ctx, argument) => {
      if (argument) {
        const name = await linkAccount(argument, String(ctx.from!.id));
        return reply(
          ctx,
          `✅ <b>Аккаунт подключён</b>\n\n${escapeHtml(name)}, теперь доступны ваши коммерческие предложения и информация о тарифе.`,
        );
      }
      return reply(
        ctx,
        "🏠 <b>MarginTools</b>\n\nЯ ИИ-помощник для расчётов и подготовки коммерческих предложений.\n\n🧮 Рассчитайте цену, маржу, НДС или скидку.\n📄 Получите готовое КП в PDF.\n💼 Проверьте свой тариф и откройте кабинет.\n\n<i>Выберите действие в меню внизу чата.</i>",
      );
    },
    calculate: async (ctx, argument) => {
      if (argument) {
        const match = argument.match(
          /^(margin|markup|vat|discount|selling-price|break-even)\s+(\{[\s\S]*\})$/,
        );
        if (!match) return reply(ctx, "Выберите расчёт кнопкой «Рассчитать».");
        return reply(
          ctx,
          resultText(match[1], calculate(match[1], JSON.parse(match[2]))),
        );
      }
      return reply(
        ctx,
        "🧮 <b>Что рассчитаем?</b>\n\nВыберите инструмент. Затем я попрошу ввести необходимые числа.",
        calculationKeyboard,
      );
    },
    proposal: async (ctx, argument) => {
      if (argument) return sendPdf(ctx, argument.trim());
      const buttons = new InlineKeyboard().text(
        "📝 Создать КП",
        "new-proposal",
      );
      try {
        const { proposals } = await ownProposals(String(ctx.from!.id));
        for (const proposal of proposals)
          buttons
            .row()
            .text(`📄 ${proposal.title.slice(0, 50)}`, `pdf:${proposal.id}`);
        return reply(
          ctx,
          proposals.length
            ? "📄 <b>Ваши коммерческие предложения</b>\n\nВыберите документ ниже, чтобы получить PDF."
            : "📄 <b>Коммерческие предложения</b>\n\nГотовых КП пока нет. Создайте сделку и подготовьте документ в кабинете.",
          buttons,
        );
      } catch (error) {
        return reply(
          ctx,
          "📄 <b>Коммерческие предложения</b>\n\n" +
            escapeHtml((error as Error).message),
          siteButtons(url, [
            ["🔗 Подключить Telegram", "/app/telegram/"],
            ["📝 Создать КП", "/app/deals/new/"],
          ]),
        );
      }
    },
    account: async (ctx) => {
      try {
        const plan = (await invokeTool(
          "get_my_subscription",
          {},
          String(ctx.from!.id),
        )) as { name: string };
        return reply(
          ctx,
          `💼 <b>Мой кабинет</b>\n\nВаш тариф: <b>${escapeHtml(plan.name)}</b>\n\nСделки, расчёты и документы доступны на сайте.`,
          siteButtons(url, [["💼 Открыть кабинет", "/app/dashboard/"]]),
        );
      } catch (error) {
        return reply(
          ctx,
          "🔗 <b>Подключите свой аккаунт</b>\n\n" +
            escapeHtml((error as Error).message),
          siteButtons(url, [["🔗 Подключить Telegram", "/app/telegram/"]]),
        );
      }
    },
    pricing: async (ctx) => {
      const data = (await invokeTool(
        "get_public_plans",
        {},
        String(ctx.from!.id),
      )) as unknown as {
        plans: Array<{
          name: string;
          monthlyPrice: string | number;
          limits: { deals: number; pdf: number };
        }>;
      };
      return reply(
        ctx,
        "💳 <b>Тарифы MarginTools</b>\n\n" +
          data.plans
            .map(
              (plan) =>
                `<b>${escapeHtml(plan.name)} · ${displayNumber(plan.monthlyPrice)} ₽/мес.</b>\n• До ${displayNumber(plan.limits.deals)} сделок\n• ${displayNumber(plan.limits.pdf)} PDF в месяц`,
            )
            .join("\n\n") +
          "\n\n<i>Покупка за реальные деньги пока недоступна.</i>",
        siteButtons(url, [["💳 Посмотреть тарифы на сайте", "/pricing/"]]),
      );
    },
    help: (ctx) =>
      reply(
        ctx,
        help,
        siteButtons(url, [
          ["🛟 Поддержка", "/help/"],
          ["🔗 Подключить Telegram", "/app/telegram/"],
          ["🌐 Открыть сайт", "/"],
        ]),
      ),
    stop: async (ctx) => {
      await db.telegramAccount.updateMany({
        where: { telegramId: String(ctx.from!.id) },
        data: { marketing: false },
      });
      return reply(
        ctx,
        "🔕 <b>Рассылка отключена</b>\n\nПолезные сообщения больше не будут приходить. Расчёты и меню по-прежнему доступны.",
      );
    },
  };
  const run = async (
    ctx: Context,
    command: keyof typeof commandLabels,
    argument?: string,
  ) => {
    if (sessions.delete(sessionId(ctx)))
      await reply(ctx, "↩️ Вернулись в главное меню.");
    try {
      await handlers[command](ctx, argument);
    } catch {
      await reply(
        ctx,
        "Действие не выполнено. Проверьте введённые данные или попробуйте позже.",
      );
    }
  };
  for (const command of Object.keys(commandLabels) as Array<
    keyof typeof commandLabels
  >) {
    bot.command(command, (ctx) => run(ctx, command, ctx.match));
    bot.hears(commandLabels[command], (ctx) => run(ctx, command));
  }
  bot.hears(cancelLabel, async (ctx) => {
    sessions.delete(sessionId(ctx));
    await reply(ctx, "Расчёт отменён.");
  });
  bot.callbackQuery(
    /^(start|calculate|proposal|account|pricing|help|stop)$/,
    async (ctx) => {
      await ctx.answerCallbackQuery();
      await run(ctx, ctx.match[1] as keyof typeof commandLabels);
    },
  );
  bot.callbackQuery("new-proposal", async (ctx) => {
    await ctx.answerCallbackQuery();
    await reply(
      ctx,
      "📝 <b>Новое коммерческое предложение</b>\n\nДобавьте позиции сделки и укажите условия оплаты и поставки в кабинете.",
      siteButtons(url, [["📝 Создать КП на сайте", "/app/deals/new/"]]),
    );
  });
  bot.callbackQuery(/^pdf:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await sendPdf(ctx, ctx.match[1]);
    } catch (error) {
      await reply(ctx, escapeHtml((error as Error).message));
    }
  });
  bot.callbackQuery(/^calc:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const key = ctx.match[1],
      definition = definitions[key];
    if (!definition) {
      await reply(ctx, "Этот расчёт недоступен.");
      return;
    }
    for (const [id, session] of sessions)
      if (session.expires < Date.now()) sessions.delete(id);
    if (sessions.size >= 1000 && !sessions.has(sessionId(ctx))) {
      await reply(ctx, "Попробуйте начать расчёт позже.");
      return;
    }
    sessions.set(sessionId(ctx), {
      key,
      step: 0,
      values: definition.mode ? { mode: definition.mode } : {},
      expires: Date.now() + 600000,
    });
    await ctx.reply(
      `<b>${definition.label}</b>\n\n${definition.fields[0][1]}\n\n<i>Шаг 1 из ${definition.fields.length}</i>`,
      {
        parse_mode: "HTML",
        reply_markup: new Keyboard()
          .text(cancelLabel)
          .row()
          .text(commandLabels.start)
          .resized()
          .persistent(),
      },
    );
  });
  bot.on("message:text", async (ctx, next) => {
    const id = sessionId(ctx),
      session = sessions.get(id);
    if (!session) return next();
    if (session.expires < Date.now()) {
      sessions.delete(id);
      await reply(ctx, "Время ввода истекло. Начните новый расчёт.");
      return;
    }
    const definition = definitions[session.key];
    try {
      const number = decimal(ctx.message.text);
      if (!number.isFinite() || number.isNegative() || number.gt(1e12))
        throw new Error("Введите неотрицательное число до 1 трлн.");
      const field = definition.fields[session.step][0];
      if (
        field === "percent" &&
        ((session.key === "selling-margin" && number.gte(100)) ||
          (definition.kind === "discount" && number.gt(100)))
      )
        throw new Error(
          "Для маржи нужно значение меньше 100%, для скидки — не больше 100%.",
        );
      session.values[field] = number.toString();
      if (session.step + 1 < definition.fields.length) {
        session.step++;
        session.expires = Date.now() + 600000;
        await ctx.reply(
          `<b>${definition.label}</b>\n\n${definition.fields[session.step][1]}\n\n<i>Шаг ${session.step + 1} из ${definition.fields.length}</i>`,
          { parse_mode: "HTML" },
        );
      } else {
        const result = calculate(definition.kind, session.values);
        sessions.delete(id);
        await reply(ctx, resultText(definition.kind, result));
      }
    } catch (error) {
      await ctx.reply(
        `Число не принято. ${(error as Error).message.startsWith("[DecimalError]") ? "Введите число, например 800 или 1 200,50." : (error as Error).message}\n${definition.fields[session.step][1]}`,
      );
    }
  });
}
