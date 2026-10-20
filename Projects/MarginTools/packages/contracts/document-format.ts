import { decimal } from "../calculations";

export const proposalColumns = [
  { label: "Наименование", width: 34 },
  { label: "Кол-во", width: 13 },
  { label: "Цена", width: 20 },
  { label: "НДС", width: 11 },
  { label: "Сумма", width: 22 },
] as const;

export function documentDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow" }).format(
    new Date(value),
  );
}

export function documentRub(value: unknown) {
  const [integer, fraction] = decimal(
    (typeof value === "string" || typeof value === "number" ? value : "0") ||
      "0",
  )
    .toFixed(2)
    .split(".");
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") +
    "," +
    fraction +
    "\u00a0₽"
  );
}
