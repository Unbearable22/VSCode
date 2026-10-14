import type { Metadata } from "next";
import localFont from "next/font/local";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "MarginTools — расчёты и коммерческие предложения",
    template: "%s | MarginTools",
  },
  description:
    "Калькуляторы маржи, наценки и цены продажи. Сделки и коммерческие предложения для малого бизнеса.",
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
};
const documentFont = localFont({
  src: [
    { path: "../assets/DejaVuSans.ttf", weight: "400" },
    { path: "../assets/DejaVuSans-Bold.ttf", weight: "700" },
  ],
  variable: "--font-document",
  display: "swap",
});
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={documentFont.variable}>{children}</body>
    </html>
  );
}
