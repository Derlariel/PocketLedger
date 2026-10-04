import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateCsv } from "../src/features/exports/csv";
import { exportFilterSchema } from "../src/features/exports/filters";
import { ledgerKey, type ExportData, type ExportTransaction } from "../src/features/exports/model";
import { generatePdf } from "../src/features/exports/pdf";

const outputDirectory = path.join(process.cwd(), "tmp", "pdfs");
const transactionCount = Math.max(1, Math.min(5_000, Number(process.env.EXPORT_VERIFY_ROWS) || 90));
const account = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "บัญชีเงินเดือน",
  bankId: "kbank",
  bankName: "Kasikornbank Public Company Limited",
  lastFour: "1234",
  currency: "THB",
  openingBalance: 125_000n,
  openingAtPeriod: 125_000n,
  closingAtPeriod: 275_000n,
  availableBalance: 275_000n,
};
const filter = exportFilterSchema.parse({
  format: "pdf",
  accountId: account.id,
  preset: "custom",
  from: "2026-01-01",
  to: "2026-01-31",
  includeNotes: true,
});
const transactions: ExportTransaction[] = Array.from({ length: transactionCount }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  accountId: account.id,
  counterAccountId: null,
  occurredAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T03:30:00.000Z`,
  createdAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T03:31:00.000Z`,
  updatedAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T03:31:00.000Z`,
  type: index % 3 ? "expense" : "income",
  description: `รายการภาษาไทยลำดับ ${index + 1} พร้อมคำอธิบายยาวสำหรับทดสอบการขึ้นบรรทัดใหม่`,
  note: index % 4 === 0 ? "หมายเหตุภาษาไทย\nบรรทัดที่สอง" : null,
  status: "posted",
  source: "manual",
  amount: index % 3 ? 7_500n : 20_000n,
  flowDirection: index % 3 ? -1 : 1,
  categories: [{ id: "22222222-2222-4222-8222-222222222222", name: index % 3 ? "อาหารและเครื่องดื่ม" : "เงินเดือน", amount: index % 3 ? 7_500n : 20_000n }],
  tags: [{ id: "33333333-3333-4333-8333-333333333333", name: "ทดสอบ" }],
  hasEvidence: index % 2 === 0,
}));
const ledgerByTransactionAccount = new Map<string, { delta: bigint; running: bigint }>();
let running = account.openingBalance;
for (const transaction of transactions) {
  const delta = transaction.amount * BigInt(transaction.flowDirection);
  running += delta;
  ledgerByTransactionAccount.set(ledgerKey(transaction.id, account.id), { delta, running });
}
account.closingAtPeriod = running;
account.availableBalance = running;
const data: ExportData = {
  filter,
  generatedAt: new Date("2026-02-01T00:00:00.000Z"),
  fromDate: "2026-01-01",
  toDate: "2026-01-31",
  accounts: [account],
  transactions,
  ledgerByTransactionAccount,
};

await mkdir(outputDirectory, { recursive: true });
const pdf = await generatePdf(data);
const csv = generateCsv({ ...data, filter: { ...filter, format: "csv" } });
if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("PDF signature validation failed.");
if (!csv.startsWith("\uFEFF")) throw new Error("CSV UTF-8 BOM validation failed.");
const pages = (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
await writeFile(path.join(outputDirectory, "pocketledger-export-verification.pdf"), pdf);
await writeFile(path.join(outputDirectory, "pocketledger-export-verification.csv"), csv, "utf8");
console.log(JSON.stringify({ pdfBytes: pdf.byteLength, pdfPages: pages, csvBytes: Buffer.byteLength(csv), transactions: transactions.length }));
