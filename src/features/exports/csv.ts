import { accountForRow, ledgerKey, transactionDelta, type ExportData } from "@/features/exports/model";
import { getBank, maskLastFour } from "@/features/accounts/banks";

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function minorToDecimal(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

function bangkokDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}:${get("second")}` };
}

export function generateCsv(data: ExportData) {
  const selectedAccountId = data.filter.accountId === "all" ? null : data.filter.accountId;
  const headers = ["Transaction ID", "Date", "Time", "Type", "Description", "Category", "Tags", "Account", "Bank", "Masked Account Number", "Currency", "Money In", "Money Out", "Net Amount", "Running Balance", "Status", "Source", "Reference Number", "Has Evidence", "Notes", "Created At", "Updated At"];
  const rows = data.transactions.map((transaction) => {
    const account = accountForRow(data, transaction, selectedAccountId);
    const delta = transactionDelta(transaction, selectedAccountId, data.ledgerByTransactionAccount);
    const running = selectedAccountId ? data.ledgerByTransactionAccount.get(ledgerKey(transaction.id, selectedAccountId))?.running : undefined;
    const { date, time } = bangkokDateTime(transaction.occurredAt);
    return [
      transaction.id, date, time, transaction.type, transaction.description,
      transaction.categories.map((category) => category.name).join(" | "),
      transaction.tags.map((tag) => tag.name).join(" | "),
      account?.name ?? "", getBank(account?.bankId)?.name ?? account?.bankName ?? "", maskLastFour(account?.lastFour), account?.currency ?? "THB",
      delta > 0n ? minorToDecimal(delta) : "", delta < 0n ? minorToDecimal(-delta) : "", minorToDecimal(delta), running === undefined ? "" : minorToDecimal(running),
      transaction.status, transaction.source, "", transaction.hasEvidence ? "Yes" : "No", data.filter.includeNotes ? transaction.note ?? "" : "",
      new Date(transaction.createdAt).toISOString(), new Date(transaction.updatedAt).toISOString(),
    ];
  });
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
