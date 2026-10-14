import { InlineKeyboard } from "grammy";

export function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function siteButtons(base: string, links: Array<[string, string]>) {
  const buttons = new InlineKeyboard();
  for (const [label, path] of links) {
    const destination = new URL(path, base);
    // Telegram rejects HTTP button URLs with a host that has no dot.
    if (destination.hostname === "localhost")
      destination.hostname = "127.0.0.1";
    buttons.url(label, destination.toString()).row();
  }
  return buttons;
}

export function displayNumber(value: unknown) {
  const text = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text)) return escapeHtml(text);
  const [integer, fraction] = text.split(".");
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ") +
    (fraction && /[1-9]/.test(fraction)
      ? "," + fraction.replace(/0+$/, "")
      : "")
  );
}
