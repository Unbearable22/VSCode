import { test, expect, request } from "@playwright/test";
test("Гость → регистрация с расчётом → сделка → КП → PDF → оплата → отзыв", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/calculators/selling-price/");
  await page.getByLabel("Закупочная цена, ₽", { exact: true }).fill("800");
  await page.getByLabel("Желаемая маржа, %").fill("20");
  await expect(page.locator(".main-result")).toContainText("1");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page).toHaveURL(/auth\/register/);
  const email = `e2e-${Date.now()}@example.test`;
  await page.getByLabel("Ваше имя").fill("Тест менеджера");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill("Test-password-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page).toHaveURL(/app\/calculations/);
  await expect(page.locator("tbody")).toContainText("Цена продажи");
  await page.goto("/app/deals/new/");
  await page.getByLabel("Название сделки").fill("Поставка компрессоров");
  await page.getByLabel("Наименование 1", { exact: true }).fill("Компрессор");
  await page.getByLabel("Закупка 1", { exact: true }).fill("800");
  await page.getByLabel("Продажа 1", { exact: true }).fill("1000");
  await page.getByLabel("Количество 1", { exact: true }).fill("1,5");
  await page.getByLabel("Общие расходы, ₽").fill("50");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Черновик сохранён");
  await page.getByRole("button", { name: "Создать КП", exact: true }).click();
  await page
    .getByLabel("Условия оплаты", { exact: true })
    .fill("Предоплата 50%");
  await page.getByRole("button", { name: "Создать версию" }).click();
  await expect(page).toHaveURL(/app\/proposals/);
  await page.locator(".proposal-list-item").click();
  await expect(page.locator(".document")).toContainText("Компрессор");
  await expect(page.locator(".document")).not.toContainText("Закупка");
  const proposals = await (await context.request.get("/api/proposals")).json();
  const p = proposals[0];
  const version = p.versions[0];
  expect(JSON.stringify(version.snapshot)).not.toMatch(
    /"(cost|profit|comment|expenses|margin)"/,
  );
  const pdf = await context.request.get(`/api/proposals/${p.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const share = await (
    await context.request.post(`/api/proposals/${p.id}/share`, {
      data: { versionId: version.id, days: 14 },
    })
  ).json();
  await page.goto(`/share/${share.token}/`);
  await expect(page.locator(".document")).toContainText("Предоплата 50%");
  const stranger = await request.newContext({
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
  });
  await stranger.post("/api/auth/register", {
    data: {
      name: "Другой пользователь",
      email: `other-${Date.now()}@example.test`,
      password: "Another-password-123",
      consent: true,
    },
  });
  expect((await stranger.get(`/api/deals/${proposals[0].id}`)).status()).toBe(
    200,
  );
  const ownDeals = await (await context.request.get("/api/deals")).json();
  expect(
    await (await stranger.get(`/api/deals/${ownDeals[0].id}`)).json(),
  ).toBeNull();
  expect((await stranger.get(`/api/proposals/${p.id}/pdf`)).status()).toBe(404);
  expect((await stranger.get("/api/admin/users")).status()).toBe(403);
  await stranger.dispose();
  const checkout = await (
    await context.request.post("/api/subscription/checkout", {
      data: { planCode: "pro", period: "month" },
    })
  ).json();
  expect(checkout.payment.status).toBe("pending");
  await context.request.post("/api/subscription/test", {
    data: { paymentId: checkout.payment.id, status: "paid" },
  });
  const first = await (await context.request.get("/api/me")).json();
  await context.request.post("/api/subscription/test", {
    data: { paymentId: checkout.payment.id, status: "paid" },
  });
  const second = await (await context.request.get("/api/me")).json();
  expect(first.plan.subscription.expiresAt).toBe(
    second.plan.subscription.expiresAt,
  );
  expect(second.plan.code).toBe("pro");
  const fail = await (
    await context.request.post("/api/subscription/checkout", {
      data: { planCode: "business", period: "year" },
    })
  ).json();
  await context.request.post("/api/subscription/test", {
    data: { paymentId: fail.payment.id, status: "failed" },
  });
  expect((await (await context.request.get("/api/me")).json()).plan.code).toBe(
    "pro",
  );
  const xlsx = await context.request.get(`/api/deals/${ownDeals[0].id}/xlsx`);
  expect(xlsx.status()).toBe(200);
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");
  await context.request.put(`/api/deals/${ownDeals[0].id}`, {
    data: {
      ...ownDeals[0],
      title: "Изменённая сделка",
      items: ownDeals[0].items.map((i: any) => ({ ...i, price: "9000" })),
    },
  });
  const old = await (
    await context.request.get(`/api/share/${share.token}`)
  ).json();
  expect(old.totals.total).toBe("1500.00");
  await context.request.delete(`/api/links/${share.id}`);
  expect(
    (await context.request.get(`/api/share/${share.token}`)).status(),
  ).toBe(404);
  await page.goto(`/share/${share.token}/`);
  await expect(
    page.getByRole("heading", { name: "Страница недоступна" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect((await context.request.delete('/api/settings', {data:{password:'wrong-password'}})).ok()).toBe(false);
  expect((await context.request.get('/api/me')).ok()).toBe(true);
  expect((await context.request.delete('/api/settings', {data:{password:'Test-password-123'}})).ok()).toBe(true);
  expect((await context.request.get('/api/me')).status()).toBe(401);
});
test("Мобильный расчёт и импорт TSV с предпросмотром", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".main-result")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.goto("/calculators/deal/");
  await page.getByRole("button", { name: "Импорт", exact: true }).click();
  await page
    .getByLabel("Табличные данные")
    .fill("Название\tКоличество\tЗакупка\tПродажа\nНасос\t2,5\t800\t1000");
  await expect(
    page.getByRole("heading", { name: "Предпросмотр" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Импортировать", exact: true })
    .click();
  await expect(page.getByLabel("Наименование 1", { exact: true })).toHaveValue(
    "Насос",
  );
  await expect(page.getByLabel("Количество 1", { exact: true })).toHaveValue(
    "2.5",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/deal-mobile.png",
    fullPage: true,
  });
});
test("Главная на широком экране", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "От закупочной цены",
  );
  await expect(page.locator(".calculator")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
});
