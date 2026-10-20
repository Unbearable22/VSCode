import "dotenv/config";
import { test, expect } from "@playwright/test";
import { db } from "../../packages/database";

test("Администратор изменяет продукт, отвечает поддержке и видит журнал", async ({
  page,
  context,
}) => {
  const email = `admin-e2e-${Date.now()}@example.test`;
  const registration = await context.request.post("/api/auth/register", {
    data: {
      name: "Тест администратора",
      email,
      password: "Admin-test-password-123",
      consent: true,
    },
  });
  expect(registration.ok()).toBe(true);
  const user = await db.user.update({
    where: { email },
    data: { role: "admin" },
    include: { workspace: true },
  });
  try {
    const templates = await (
      await context.request.get("/api/admin/templates")
    ).json();
    const standard = templates.find((t: any) => t.code === "standard");
    try {
      const disabled = await context.request.post("/api/admin/templates", {
        data: { code: "standard", name: standard.name, enabled: false },
      });
      expect(disabled.ok()).toBe(true);
      const deal = await (
        await context.request.post("/api/deals", {
          data: {
            title: "Проверка шаблона",
            items: [
              { name: "Насос", quantity: "1", cost: "800", price: "1000" },
            ],
          },
        })
      ).json();
      const proposal = await context.request.post("/api/proposals", {
        data: {
          dealId: deal.id,
          title: "Недоступный шаблон",
          template: "standard",
          validDays: 14,
        },
      });
      expect(proposal.ok()).toBe(false);
      expect(
        (await (await context.request.get("/api/admin/templates")).json()).find(
          (t: any) => t.code === "standard",
        ).enabled,
      ).toBe(false);
    } finally {
      await context.request.post("/api/admin/templates", {
        data: {
          code: "standard",
          name: standard.name,
          enabled: standard.enabled,
        },
      });
    }
    await page.goto("/admin/knowledge-base/");
    await page.getByRole("button", { name: "Статья", exact: true }).click();
    const slug = `test-${Date.now()}`;
    await page.getByLabel("Адрес", { exact: true }).fill(slug);
    await page.getByLabel("Заголовок", { exact: true }).fill("Тестовая статья");
    await page
      .getByLabel("Текст статьи", { exact: true })
      .fill("Проверка редактирования базы знаний администратором.");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.locator("tbody")).toContainText("Тестовая статья");
    const support = await db.supportRequest.create({
      data: { userId: user.id, email, text: "Проверка поддержки" },
    });
    const answer = await context.request.post("/api/admin/leads", {
      data: {
        id: support.id,
        reply: "Ответ тестовой поддержки",
        status: "closed",
      },
    });
    expect(answer.ok()).toBe(true);
    expect(
      (await db.notification.findFirst({ where: { userId: user.id } }))?.text,
    ).toContain("Ответ тестовой поддержки");
    await page.goto("/admin/audit/");
    await expect(page.locator("tbody")).toContainText("admin.knowledge-base");
    await page.goto("/admin/bot/");
    await expect(
      page.getByRole("heading", { name: "Оценка расходов ИИ" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/admin-desktop.png",
      fullPage: true,
    });
    await db.knowledgeArticle.delete({ where: { slug } });
  } finally {
    await db.notification.deleteMany({ where: { userId: user.id } });
    await db.supportRequest.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
