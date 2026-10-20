import { db } from "../../../packages/database";
import { hashToken } from "../../../packages/database/security";
import { calculate, decimal } from "../../../packages/calculations";
export async function linkAccount(raw: string, telegramId: string) {
  return db.$transaction(async (tx) => {
    const id = hashToken(raw);
    const t = await tx.authToken.findUnique({
      where: { id },
      include: { user: true },
    });
    if (
      !t ||
      t.purpose !== "telegram" ||
      t.usedAt ||
      t.expiresAt < new Date() ||
      t.user.blocked
    )
      throw new Error(
        "Ссылка подключения недействительна или истекла. Получите новую в кабинете.",
      );
    const claimed = await tx.authToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!claimed.count) throw new Error("Ссылка уже использована.");
    const old = await tx.telegramAccount.findUnique({ where: { telegramId } });
    if (old && old.userId !== t.userId)
      throw new Error(
        "Этот Telegram уже связан с другим аккаунтом. Сначала отключите его.",
      );
    await tx.telegramAccount.upsert({
      where: { userId: t.userId },
      create: { userId: t.userId, telegramId },
      update: { telegramId },
    });
    await tx.analyticsEvent.create({ data: { name: "telegram_linked" } });
    return t.user.name;
  });
}
const currency = (s: unknown) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
    Number(s),
  ) + " ₽";
export function fallbackCalculation(text: string): string | null {
  const match = text.match(
    /закупк[аиу]?\s*(\d[\d\s]*(?:[.,]\d+)?)\s*(тысяч|тыс|к)?[\s\S]*?(марж[ауи]|наценк[ауи])\s*(\d+(?:[.,]\d+)?)\s*%/i,
  );
  if (match) {
    const cost = decimal(match[1])
      .mul(match[2] ? 1000 : 1)
      .toString();
    const r = calculate("selling-price", {
      cost,
      percent: match[4],
      mode: match[3].toLowerCase().startsWith("марж") ? "margin" : "markup",
    }) as any;
    return `Цена продажи — ${currency(r.price)}\nТорговая прибыль — ${currency(r.profit)}\nМаржа — ${r.margin}%, наценка — ${r.markup}%\n\nДополнительные расходы не включены.`;
  }
  return null;
}
