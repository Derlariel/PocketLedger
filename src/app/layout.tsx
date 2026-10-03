import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_Thai({ subsets: ["thai", "latin"], variable: "--font-noto-thai", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PocketLedger", template: "%s · PocketLedger" },
  description: "สมุดบัญชีส่วนตัวที่ตรวจสอบย้อนหลังได้",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th" suppressHydrationWarning><body className={noto.variable}>{children}</body></html>;
}
