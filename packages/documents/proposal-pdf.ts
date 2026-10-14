import { PDFDocument, rgb, type PDFFont, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PublicProposal } from "../contracts/proposal";
import {
  documentDate,
  documentRub,
  proposalColumns,
} from "../contracts/document-format";
import { projectRoot } from "../files";

const pageWidth = 595.28,
  pageHeight = 841.89;
const ink = rgb(32 / 255, 44 / 255, 63 / 255);
const muted = rgb(102 / 255, 112 / 255, 133 / 255);
const blue = rgb(37 / 255, 99 / 255, 235 / 255);
const border = rgb(226 / 255, 232 / 255, 240 / 255);
const background = rgb(245 / 255, 247 / 255, 251 / 255);

export async function proposalPdf(s: PublicProposal, logo?: Buffer) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile(path.join(projectRoot, "apps/web/assets/DejaVuSans.ttf")),
    { subset: true },
  );
  const bold = await doc.embedFont(
    await readFile(
      path.join(projectRoot, "apps/web/assets/DejaVuSans-Bold.ttf"),
    ),
    { subset: true },
  );
  const compact = s.template === "compact",
    presentation = s.template === "presentation";
  const margin = compact ? 20 : 32,
    width = pageWidth - 2 * margin;
  const limit = pageHeight - 78,
    leading = 12,
    padding = compact ? 6 : 10;
  let page = doc.addPage([pageWidth, pageHeight]),
    y = margin;
  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    y = margin;
  };
  const ensure = (height: number) => {
    if (y + height <= limit) return false;
    newPage();
    return true;
  };
  const clean = (text: string) =>
    text
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const wrap = (text: string, max: number, size = 8.2, face = font) => {
    const lines: string[] = [];
    for (const paragraph of clean(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (
          face.widthOfTextAtSize((line ? line + " " : "") + word, size) <= max
        ) {
          line += (line ? " " : "") + word;
          continue;
        }
        if (line) {
          lines.push(line);
          line = "";
        }
        for (const character of word) {
          if (line && face.widthOfTextAtSize(line + character, size) > max) {
            lines.push(line);
            line = "";
          }
          line += character;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const text = (
    value: string,
    x: number,
    top: number,
    size = 8.2,
    face: PDFFont = font,
    color: RGB = ink,
    available?: number,
  ) => {
    const shift =
      available === undefined
        ? 0
        : available - face.widthOfTextAtSize(value, size);
    page.drawText(value, {
      x: x + shift,
      y: pageHeight - top - size,
      size,
      font: face,
      color,
    });
  };
  const line = (
    top: number,
    x = margin,
    length = width,
    color = border,
    thickness = 0.6,
  ) =>
    page.drawLine({
      start: { x, y: pageHeight - top },
      end: { x: x + length, y: pageHeight - top },
      thickness,
      color,
    });
  const flow = (
    value: string,
    size = 8.2,
    face = font,
    color = ink,
    available = width,
  ) => {
    if (!value) return;
    for (const item of wrap(value, available, size, face)) {
      ensure(size + 5);
      text(item, margin, y, size, face, color);
      y += size + 5;
    }
  };

  if (logo) {
    const image =
      logo[0] === 137 ? await doc.embedPng(logo) : await doc.embedJpg(logo);
    const dimensions = image.scaleToFit(84, 35);
    page.drawImage(image, {
      x: margin,
      y: pageHeight - y - dimensions.height,
      width: dimensions.width,
      height: dimensions.height,
    });
    y += dimensions.height + 12;
  }
  const headerTop = y;
  text("КОММЕРЧЕСКОЕ", pageWidth - margin - 135, headerTop, 7, bold, blue, 135);
  text(
    "ПРЕДЛОЖЕНИЕ",
    pageWidth - margin - 135,
    headerTop + 12,
    7,
    bold,
    blue,
    135,
  );
  flow(s.company.name || "Продавец", 14, bold, ink, width - 155);
  flow(s.company.details, 8.2, font, muted, width - 155);
  flow(s.company.contacts, 8.2, font, muted, width - 155);
  y = Math.max(y, headerTop + 28) + 14;
  ensure(2);
  line(y, margin, width, blue, 1.4);
  y += presentation ? 28 : compact ? 12 : 20;
  ensure(55);
  flow(s.title, presentation ? 23 : 18, bold, presentation ? blue : ink);
  y += 3;
  flow(`№ ${s.number} · ${documentDate(s.date)}`, 8.2, font, muted);
  y += compact ? 12 : 16;
  if (s.client) {
    ensure(42);
    flow("ДЛЯ", 6.5, font, muted);
    flow(s.client.name, 9.2, bold);
    flow(s.client.details, 8.2, font, muted);
    flow(s.client.contact, 8.2, font, muted);
    y += 12;
  }

  const columns = proposalColumns.map((column) => (column.width * width) / 100);
  const positions = columns.map(
    (_, index) =>
      margin + columns.slice(0, index).reduce((sum, value) => sum + value, 0),
  );
  const tableHeader = () => {
    ensure(30);
    page.drawRectangle({
      x: margin,
      y: pageHeight - y - 26,
      width,
      height: 26,
      color: background,
    });
    proposalColumns.forEach((column, index) =>
      text(
        column.label,
        positions[index] + 7,
        y + 8,
        7,
        bold,
        muted,
        index ? columns[index] - 14 : undefined,
      ),
    );
    y += 26;
    line(y);
  };
  ensure(60);
  tableHeader();
  for (const [index, item] of s.items.entries()) {
    const cells = [
      [
        ...wrap(item.name, columns[0] - 14).map((value) => ({
          value,
          small: false,
        })),
        ...(item.sku
          ? wrap(item.sku, columns[0] - 14, 7).map((value) => ({
              value,
              small: true,
            }))
          : []),
      ],
      ...[
        `${item.quantity} ${item.unit}`,
        documentRub(item.price),
        item.vatMode === "none" ? "—" : `${item.vatRate}%`,
        documentRub(item.total),
      ].map((value, cell) =>
        wrap(value, columns[cell + 1] - 14).map((value) => ({
          value,
          small: false,
        })),
      ),
    ];
    const count = Math.max(...cells.map((cell) => cell.length));
    let offset = 0;
    while (offset < count) {
      if (ensure(2 * padding + leading * Math.min(count - offset, 3)))
        tableHeader();
      const capacity = Math.max(
        1,
        Math.floor((limit - y - 2 * padding) / leading),
      );
      const length = Math.min(count - offset, capacity);
      cells.forEach((cell, column) =>
        cell
          .slice(offset, offset + length)
          .forEach((entry, row) =>
            text(
              entry.value,
              positions[column] + 7,
              y +
                padding +
                row * leading +
                (column
                  ? ((length - cell.slice(offset, offset + length).length) *
                      leading) /
                    2
                  : 0),
              entry.small ? 7 : 8.2,
              font,
              entry.small ? muted : ink,
              column ? columns[column] - 14 : undefined,
            ),
          ),
      );
      y += 2 * padding + length * leading;
      offset += length;
      if (index < s.items.length - 1 || offset < count) line(y);
      if (offset < count) {
        newPage();
        tableHeader();
      }
    }
  }

  y += 16;
  ensure(83);
  const totalsWidth = Math.min(224, width),
    totalsX = pageWidth - margin - totalsWidth;
  const total = (label: string, value: string, size = 8.5) => {
    text(label, totalsX, y, size);
    const formatted = documentRub(value);
    const available = totalsWidth - 90;
    const amountSize = Math.min(
      size,
      available / bold.widthOfTextAtSize(formatted, 1),
    );
    text(formatted, totalsX + 90, y, amountSize, bold, ink, available);
    y += size + 8;
  };
  total("Сумма без НДС", s.totals.base);
  total("НДС", s.totals.vat);
  y += 6;
  line(y, totalsX, totalsWidth);
  y += 11;
  total("Итого", s.totals.total, 11.5);
  y += 20;

  const terms = [
    ["Условия оплаты", s.paymentTerms],
    ["Поставка", s.deliveryTerms],
    ["Гарантия", s.warranty],
  ].filter(([, value]) => value);
  if (terms.length) {
    const gap = 14,
      columnWidth = (width - 2 * gap) / 3;
    const values = terms.map(([, value]) => wrap(value, columnWidth, 7.8));
    const count = Math.max(...values.map((value) => value.length));
    let offset = 0;
    while (offset < count) {
      ensure(18 + leading * Math.min(count - offset, 3));
      terms.forEach(([label], index) =>
        text(label, margin + index * (columnWidth + gap), y, 7.8, bold),
      );
      y += 17;
      const length = Math.min(
        count - offset,
        Math.max(1, Math.floor((limit - y) / leading)),
      );
      values.forEach((value, index) =>
        value
          .slice(offset, offset + length)
          .forEach((entry, row) =>
            text(
              entry,
              margin + index * (columnWidth + gap),
              y + row * leading,
              7.8,
              font,
              muted,
            ),
          ),
      );
      y += length * leading;
      offset += length;
      if (offset < count) newPage();
    }
    y += 14;
  }
  flow(s.text);
  const footerTop = Math.min(y + 22, pageHeight - 43);
  line(footerTop);
  text(
    `Действительно до ${documentDate(s.validUntil)}`,
    margin,
    footerTop + 12,
    7,
    font,
    muted,
  );
  if (s.watermark)
    text(
      "Создано в MarginTools",
      pageWidth - margin - 160,
      footerTop + 12,
      7,
      font,
      muted,
      160,
    );
  const pages = doc.getPages();
  pages.forEach((item, index) =>
    item.drawText(`${index + 1} / ${pages.length}`, {
      x: pageWidth - margin - 35,
      y: 16,
      size: 7,
      font,
      color: muted,
    }),
  );
  return Buffer.from(await doc.save());
}
