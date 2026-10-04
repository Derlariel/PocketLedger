import { describe, expect, it } from "vitest";
import { generateCsv } from "@/features/exports/csv";
import { exportFilterSchema, resolveDateRange, sanitizeFilenamePart } from "@/features/exports/filters";
import { generatePdf } from "@/features/exports/pdf";
import { exportSummary, ledgerKey, transactionDelta, type ExportData, type ExportTransaction } from "@/features/exports/model";

const account = { id: "11111111-1111-4111-8111-111111111111", name: "บัญชี เงินเดือน", bankId: null, bankName: null, lastFour: "1234", currency: "THB", openingBalance: 10_000n, openingAtPeriod: 10_000n, closingAtPeriod: 11_500n, availableBalance: 11_500n };
const baseFilter = exportFilterSchema.parse({ format: "csv", accountId: account.id, preset: "custom", from: "2026-01-01", to: "2026-01-31", includeNotes: true });

function transaction(overrides: Partial<ExportTransaction> = {}): ExportTransaction {
  return { id: crypto.randomUUID(), accountId: account.id, counterAccountId: null, occurredAt: "2026-01-15T03:30:00.000Z", createdAt: "2026-01-15T03:31:00.000Z", updatedAt: "2026-01-15T03:31:00.000Z", type: "income", description: "เงินเดือน, มกราคม", note: "ทดสอบ\nบรรทัดใหม่", status: "posted", source: "manual", amount: 1_500n, flowDirection: 1, categories: [{ id: "22222222-2222-4222-8222-222222222222", name: "เงินเดือน", amount: 1_500n }], tags: [{ id: "33333333-3333-4333-8333-333333333333", name: "ประจำ" }], hasEvidence: true, ...overrides };
}

function data(transactions: ExportTransaction[], filter = baseFilter): ExportData {
  const ledger = new Map<string, { delta: bigint; running: bigint }>(); let running = account.openingBalance;
  for (const item of transactions) { if (item.status !== "draft") { const delta = item.amount * BigInt(item.flowDirection); running += delta; ledger.set(ledgerKey(item.id, account.id), { delta, running }); } }
  return { filter, generatedAt: new Date("2026-02-01T00:00:00.000Z"), fromDate: "2026-01-01", toDate: "2026-01-31", accounts: [account], transactions, ledgerByTransactionAccount: ledger };
}

describe("export filters", () => {
  it("resolves presets and rejects invalid custom ranges", () => {
    const filter = exportFilterSchema.parse({ format: "csv", preset: "last_month" });
    expect(resolveDateRange(filter, new Date("2026-10-04T00:00:00Z"))).toMatchObject({ fromDate: "2026-09-01", toDate: "2026-09-30" });
    expect(exportFilterSchema.safeParse({ format: "csv", preset: "custom", from: "2026-02-01", to: "2026-01-01" }).success).toBe(false);
  });

  it("retains category and tag filters and sanitizes filenames", () => {
    const parsed = exportFilterSchema.parse({ format: "pdf", categoryIds: ["22222222-2222-4222-8222-222222222222"], tagIds: ["33333333-3333-4333-8333-333333333333"] });
    expect(parsed.categoryIds).toHaveLength(1); expect(parsed.tagIds).toHaveLength(1);
    expect(sanitizeFilenamePart("Salary / Main: 1234")).toBe("salary-main-1234");
  });
});

describe("CSV exports", () => {
  it("exports Thai UTF-8, every row, escaping, and formula-injection protection", () => {
    const rows = [transaction({ description: "=SUM(1,2) เงินเดือน" }), transaction({ description: "คำอธิบาย \"quoted\"\nnext" })];
    const csv = generateCsv(data(rows));
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=SUM(1,2) เงินเดือน");
    expect(csv).toContain('คำอธิบาย ""quoted""\nnext');
    expect(csv.match(/\r\n/g)).toHaveLength(2);
    expect(csv).toContain("15.00");
  });

  it("supports empty and all-account exports without a misleading combined running balance", () => {
    expect(generateCsv(data([])).split("\r\n")).toHaveLength(1);
    const all = { ...baseFilter, accountId: "all" as const };
    const csv = generateCsv(data([transaction()], all));
    const columns = csv.split("\r\n")[1].split('","');
    expect(columns[14]).toBe("");
  });
});

describe("ledger export calculations", () => {
  it("handles transfer, refund, reversal, draft, and voided deltas without floating point", () => {
    const transfer = transaction({ type: "transfer", amount: 500n, flowDirection: -1, counterAccountId: "44444444-4444-4444-8444-444444444444" });
    const refund = transaction({ type: "refund", amount: 200n, flowDirection: 1 });
    const reversal = transaction({ type: "reversal", amount: 300n, flowDirection: 1 });
    const draft = transaction({ type: "expense", amount: 100n, flowDirection: -1, status: "draft" });
    const voided = transaction({ type: "expense", amount: 300n, flowDirection: -1, status: "voided" });
    const report = data([transfer, refund, reversal, draft, voided]);
    expect(transactionDelta(transfer, account.id, report.ledgerByTransactionAccount)).toBe(-500n);
    expect(transactionDelta(draft, account.id, report.ledgerByTransactionAccount)).toBe(-100n);
    expect(exportSummary(report, account.id)).toMatchObject({ income: 500n, expenses: 900n, net: -400n });
  });
});

describe("PDF exports", () => {
  it("creates a multi-page PDF with embedded Thai-capable font and repeated tables", async () => {
    const rows = Array.from({ length: 90 }, (_, index) => transaction({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, description: `รายการภาษาไทยลำดับ ${index + 1} พร้อมคำอธิบายยาวสำหรับทดสอบการขึ้นบรรทัดใหม่` }));
    const pdf = await generatePdf(data(rows, { ...baseFilter, format: "pdf" }));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(2);
    expect(pdf.byteLength).toBeGreaterThan(40_000);
  }, 20_000);
});
