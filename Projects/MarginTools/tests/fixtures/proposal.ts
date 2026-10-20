import type { PublicProposal } from "../../packages/contracts/proposal";

export const exampleProposal: PublicProposal = {
  title: "Поставка серверного оборудования",
  number: "ПРИМЕР-01",
  date: "2026-10-14T21:10:00.000Z",
  validUntil: "2026-10-28T21:10:00.000Z",
  template: "standard",
  company: { name: "", details: "", contacts: "" },
  client: null,
  items: [
    {
      name: "Сервер для тестовой поставки",
      sku: "TEST-001",
      quantity: "1",
      unit: "шт.",
      price: "1000.00",
      vatMode: "included",
      vatRate: "22",
      base: "819.67",
      vat: "180.33",
      total: "1000.00",
    },
  ],
  totals: { base: "819.67", vat: "180.33", total: "1000.00" },
  paymentTerms: "100% предоплата",
  deliveryTerms: "Бесплатная доставка",
  warranty: "5 лет",
  text: "Демонстрационные данные для проверки документа.",
  watermark: true,
};
