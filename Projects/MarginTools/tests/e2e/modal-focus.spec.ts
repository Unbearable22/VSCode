import { test, expect } from "@playwright/test";

test("Модальные формы сохраняют фокус при посимвольном вводе", async ({ page, context }) => {
  const password = "Focus-test-password-123";
  const registration = await context.request.post("/api/auth/register", {
    data: { name: "Проверка фокуса", email: `focus-${Date.now()}@example.test`, password, consent: true },
  });
  expect(registration.ok()).toBe(true);
  try {
    for (const kind of ["products", "clients"]) {
      await page.goto(`/app/${kind}/`);
      const add = page.getByRole("button", { name: "Добавить", exact: true });
      await add.click();
      const dialog = page.getByRole("dialog", { name: "Новая запись" });
      const name = dialog.getByLabel(kind === "products" ? "Наименование" : "Название клиента", { exact: true });
      await name.click();
      for (const character of "Компрессор Delda") {
        await page.keyboard.insertText(character);
        await expect(name).toBeFocused();
      }
      await expect(name).toHaveValue("Компрессор Delda");
      await page.keyboard.press("Home");
      await page.keyboard.insertText("1. ");
      await expect(name).toHaveValue("1. Компрессор Delda");
      await expect(name).toBeFocused();
      const second = dialog.getByLabel(kind === "products" ? "Артикул" : "Контактное лицо", { exact: true });
      await second.click();
      await page.keyboard.insertText("AB");
      await expect(second).toBeFocused();
      await page.keyboard.insertText("-123");
      await expect(second).toHaveValue("AB-123");
      if (kind === "clients") {
        const notes = dialog.getByRole("textbox", { name: "Заметки", exact: true });
        await notes.click();
        await page.keyboard.insertText("Первая строка");
        await expect(notes).toBeFocused();
        await page.keyboard.press("Enter");
        await page.keyboard.insertText("Вторая строка");
        await expect(notes).toHaveValue("Первая строка\nВторая строка");
      }
      const close = dialog.getByRole("button", { name: "Закрыть", exact: true });
      const save = dialog.getByRole("button", { name: "Сохранить", exact: true });
      await save.focus();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(save).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(add).toBeFocused();
      await add.click();
      await expect(dialog).toBeVisible();
      await close.click();
      await expect(add).toBeFocused();
    }
  } finally {
    const deletion = await context.request.delete("/api/settings", { data: { password } });
    expect(deletion.ok()).toBe(true);
  }
});
