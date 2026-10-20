import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { execFileSync, spawnSync } from "node:child_process";
import { proposalPdf } from "../packages/documents";
import {
  documentDate,
  documentRub,
} from "../packages/contracts/document-format";
import { exampleProposal } from "./fixtures/proposal";

const poppler = spawnSync("pdftotext", ["-v"]).status === 0;
const extract = (bytes: Buffer) =>
  execFileSync("pdftotext", ["-layout", "-", "-"], {
    input: bytes,
    encoding: "utf8",
  }).replace(/\u00a0/g, " ");
describe("Клиентский документ и PDF", () => {
  it("использует московские даты и точные суммы независимо от окружения", () => {
    expect(documentDate(exampleProposal.date)).toBe("15.10.2026");
    expect(documentDate(exampleProposal.validUntil)).toBe("29.10.2026");
    expect(documentRub("1234567.89")).toBe("1\u00a0234\u00a0567,89\u00a0₽");
    expect(documentRub("9007199254740991.15")).toBe(
      "9\u00a0007\u00a0199\u00a0254\u00a0740\u00a0991,15\u00a0₽",
    );
  });
  for (const template of ["standard", "compact", "presentation"]) {
    it(`формирует A4 и встроенные шрифты для ${template}`, async () => {
      const bytes = await proposalPdf({ ...exampleProposal, template });
      const document = await PDFDocument.load(bytes);
      expect(document.getPageCount()).toBe(1);
      expect(document.getPage(0).getWidth()).toBeCloseTo(595.28);
      expect(document.getPage(0).getHeight()).toBeCloseTo(841.89);
      expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    });
  }
  it("переносит длинные позиции и условия без потери страниц", async () => {
    const proposal = {
      ...exampleProposal,
      items: Array.from({ length: 50 }, (_, index) => ({
        ...exampleProposal.items[0],
        name: `Позиция ${index + 1} с длинным описанием оборудования`,
      })),
      paymentTerms: "Дополнительное условие оплаты. ".repeat(120),
      text: "Текст предложения. ".repeat(200),
    };
    const pdf = await PDFDocument.load(await proposalPdf(proposal));
    expect(pdf.getPageCount()).toBeGreaterThan(3);
  });
  it.skipIf(!poppler)(
    "сохраняет содержимое предпросмотра, табличные заголовки и исключает внутренние данные",
    async () => {
      const withPrivate = {
        ...exampleProposal,
        cost: "SECRET-COST",
        profit: "SECRET-PROFIT",
        comment: "SECRET-NOTE",
      };
      const content = extract(await proposalPdf(withPrivate));
      for (const value of [
        "Продавец",
        "Наименование",
        "Кол-во",
        "Цена",
        "НДС",
        "Сумма",
        "Сервер для тестовой поставки",
        "TEST-001",
        "1 000,00",
        "819,67",
        "180,33",
        "15.10.2026",
        "29.10.2026",
        "Условия оплаты",
        "Бесплатная доставка",
        "5 лет",
        "Создано в MarginTools",
      ])
        expect(content).toContain(value);
      expect(content).not.toMatch(/SECRET-|14\.10\.2026|28\.10\.2026/);
    },
  );
  it.skipIf(!poppler)(
    "повторяет заголовки таблицы и сохраняет последнюю позицию на нескольких страницах",
    async () => {
      const proposal = {
        ...exampleProposal,
        items: Array.from({ length: 60 }, (_, index) => ({
          ...exampleProposal.items[0],
          name: `Позиция ${index + 1}`,
          sku: "",
        })),
      };
      const bytes = await proposalPdf(proposal),
        pdf = await PDFDocument.load(bytes);
      const content = extract(bytes);
      expect(
        (content.match(/Наименование/g) || []).length,
      ).toBeGreaterThanOrEqual(pdf.getPageCount() - 1);
      expect(content).toContain("Позиция 60");
      expect(content).toContain("Действительно до 29.10.2026");
    },
  );
});
