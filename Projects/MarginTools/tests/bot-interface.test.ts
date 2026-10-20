import { describe, it, expect, vi, beforeEach } from "vitest";
import { Bot } from "grammy";
const mocks = vi.hoisted(() => ({
  subscription: vi.fn(),
  proposals: vi.fn(),
  pdf: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("../packages/database", () => ({
  db: { telegramAccount: { updateMany: mocks.stop } },
}));
vi.mock("../packages/ai-agent", () => ({ invokeTool: mocks.subscription }));
vi.mock("../apps/bot/src/core", () => ({ linkAccount: vi.fn() }));
vi.mock("../apps/bot/src/proposals", () => ({
  ownProposals: mocks.proposals,
  ownProposalPdf: mocks.pdf,
}));
import {
  commandLabels,
  mainKeyboard,
  calculationKeyboard,
  registerInterface,
} from "../apps/bot/src/interface";

function harness() {
  const bot = new Bot("123:test", {
    botInfo: {
      id: 123,
      is_bot: true,
      first_name: "Test",
      username: "test_bot",
      can_join_groups: false,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  });
  const calls: Array<{ method: string; payload: any }> = [];
  bot.api.config.use(async (_previous, method, payload) => {
    calls.push({ method, payload });
    return { ok: true, result: true } as any;
  });
  registerInterface(bot, "http://localhost:3000");
  let update = 0;
  const from = { id: 456, is_bot: false, first_name: "User" };
  const chat = { id: 456, type: "private" as const, first_name: "User" };
  const message = (text: string) =>
    bot.handleUpdate({
      update_id: ++update,
      message: { message_id: update, date: 1, from, chat, text },
    });
  const callback = (data: string) =>
    bot.handleUpdate({
      update_id: ++update,
      callback_query: {
        id: String(update),
        from,
        chat_instance: "test",
        data,
        message: { message_id: update, date: 1, chat, text: "Menu" },
      },
    });
  return { calls, message, callback };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.subscription.mockImplementation(async (tool: string) =>
    tool === "get_public_plans"
      ? {
          plans: [
            {
              name: "Pro",
              monthlyPrice: "490",
              limits: { deals: 100, pdf: 100 },
            },
          ],
        }
      : { name: "Pro" },
  );
  mocks.proposals.mockResolvedValue({
    proposals: [{ id: "proposal-1", title: "Насос" }],
  });
  mocks.pdf.mockResolvedValue(Buffer.from("%PDF-test"));
});
describe("Кнопки Telegram", () => {
  it("предлагает все команды и тематические эмодзи", () => {
    expect(Object.keys(commandLabels)).toEqual([
      "start",
      "calculate",
      "proposal",
      "account",
      "pricing",
      "help",
      "stop",
    ]);
    expect(
      mainKeyboard.keyboard
        .flat()
        .map((button) => (typeof button === "string" ? button : button.text)),
    ).toEqual(expect.arrayContaining(Object.values(commandLabels)));
    for (const text of [
      ...Object.values(commandLabels),
      ...calculationKeyboard.inline_keyboard
        .flat()
        .map((button) => button.text),
    ])
      expect(text).toMatch(/\p{Extended_Pictographic}/u);
    expect(mainKeyboard.is_persistent).toBe(true);
  });
  it("выполняет команды кнопками, показывает КП и отправляет выбранный PDF", async () => {
    const h = harness();
    for (const text of Object.values(commandLabels)) await h.message(text);
    expect(
      h.calls.some((call) => call.payload.text?.includes("Pro · 490")),
    ).toBe(true);
    expect(
      h.calls.some((call) =>
        call.payload.text?.includes("Ваш тариф: <b>Pro</b>"),
      ),
    ).toBe(true);
    expect(mocks.stop).toHaveBeenCalledWith({
      where: { telegramId: "456" },
      data: { marketing: false },
    });
    expect(
      h.calls.some((call) =>
        call.payload.reply_markup?.inline_keyboard
          ?.flat()
          .some((button: any) => button.callback_data === "pdf:proposal-1"),
      ),
    ).toBe(true);
    await h.callback("pdf:proposal-1");
    expect(mocks.pdf).toHaveBeenCalledWith("456", "proposal-1");
    expect(h.calls.some((call) => call.method === "sendDocument")).toBe(true);
  });
  it("считает цену пошагово, сохраняет шаг после неверного значения и отменяет ввод", async () => {
    const h = harness();
    await h.callback("calc:selling-margin");
    await h.message("80 000");
    await h.message("100");
    expect(h.calls.at(-1)?.payload.text).toContain("Число не принято");
    await h.message("20");
    expect(h.calls.at(-1)?.payload.text).toContain(
      "Продажа, ₽: <b>100 000</b>",
    );
    expect(h.calls.at(-1)?.payload.reply_markup).toEqual(mainKeyboard);
    await h.callback("calc:margin");
    await h.message("❌ Отменить расчёт");
    expect(h.calls.at(-1)?.payload.text).toBe("Расчёт отменён.");
  });
  it("обрабатывает режимы НДС, скидку и отсутствие безубыточности без ИИ", async () => {
    const h = harness();
    for (const [key, values, expected] of [
      ["vat-included", ["1 200,00", "20"], "НДС, ₽: <b>200</b>"],
      [
        "discount",
        ["800", "1000", "30", "0"],
        "Торговая прибыль, ₽: <b>-100</b>",
      ],
      [
        "break-even",
        ["500", "10", "20"],
        "конечная точка безубыточности отсутствует",
      ],
    ] as const) {
      await h.callback(`calc:${key}`);
      for (const value of values) await h.message(value);
      expect(h.calls.at(-1)?.payload.text).toContain(expected);
    }
    expect(mocks.subscription).not.toHaveBeenCalled();
  });
  it("открывает прежние inline-кнопки и не отправляет недоступный PDF", async () => {
    const h = harness();
    await h.callback("help");
    expect(
      h.calls.at(-1)?.payload.reply_markup.inline_keyboard.flat(),
    ).toContainEqual({
      text: "🌐 Открыть сайт",
      url: "http://127.0.0.1:3000/",
    });
    mocks.pdf.mockRejectedValueOnce(new Error("КП не найдено."));
    await h.callback("pdf:other");
    expect(h.calls.at(-1)?.payload.text).toBe("КП не найдено.");
    expect(h.calls.some((call) => call.method === "sendDocument")).toBe(false);
  });
  it("оформляет ответы в HTML, экранирует названия и выносит URL в кнопки", async () => {
    const h = harness();
    mocks.subscription.mockResolvedValueOnce({
      plans: [
        {
          name: "Pro <script>&",
          monthlyPrice: "1234.50",
          limits: { deals: 1000, pdf: 100 },
        },
      ],
    });
    await h.message(commandLabels.pricing);
    const pricing = h.calls.at(-1)!.payload;
    expect(pricing.parse_mode).toBe("HTML");
    expect(pricing.text).toContain("Pro &lt;script&gt;&amp; · 1 234,5");
    expect(pricing.text).toContain("\n\n");
    expect(pricing.text).not.toContain("http");
    expect(pricing.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "💳 Посмотреть тарифы на сайте",
      url: "http://127.0.0.1:3000/pricing/",
    });
    await h.message(commandLabels.help);
    expect(h.calls.at(-1)!.payload.text).not.toContain("http");
    expect(
      h.calls
        .at(-1)!
        .payload.reply_markup.inline_keyboard.flat()
        .map((button: any) => button.url),
    ).toEqual([
      "http://127.0.0.1:3000/help/",
      "http://127.0.0.1:3000/app/telegram/",
      "http://127.0.0.1:3000/",
    ]);
  });
});
