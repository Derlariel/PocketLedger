import type { ExportFilter } from "@/features/exports/filters";

export type ExportAccount = {
  id: string;
  name: string;
  bankId: string | null;
  bankName: string | null;
  lastFour: string | null;
  currency: string;
  openingBalance: bigint;
  openingAtPeriod: bigint;
  closingAtPeriod: bigint;
  availableBalance: bigint;
};

export type ExportTransaction = {
  id: string;
  accountId: string;
  counterAccountId: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  type: string;
  description: string;
  note: string | null;
  status: string;
  source: string;
  amount: bigint;
  flowDirection: -1 | 1;
  categories: { id: string; name: string; amount: bigint }[];
  tags: { id: string; name: string }[];
  hasEvidence: boolean;
};

export type LedgerValue = { delta: bigint; running: bigint };

export type ExportData = {
  filter: ExportFilter;
  generatedAt: Date;
  fromDate: string | null;
  toDate: string | null;
  accounts: ExportAccount[];
  transactions: ExportTransaction[];
  ledgerByTransactionAccount: Map<string, LedgerValue>;
};

export function ledgerKey(transactionId: string, accountId: string) {
  return `${transactionId}:${accountId}`;
}

export function transactionDelta(transaction: ExportTransaction, accountId: string | null, ledger: Map<string, LedgerValue>) {
  if (accountId) {
    const posted = ledger.get(ledgerKey(transaction.id, accountId));
    if (posted) return posted.delta;
    if (transaction.status !== "draft") return 0n;
    if (transaction.type === "transfer" && transaction.counterAccountId === accountId) return transaction.amount;
    return transaction.accountId === accountId ? transaction.amount * BigInt(transaction.flowDirection) : 0n;
  }
  let total = 0n;
  for (const [key, value] of ledger) if (key.startsWith(`${transaction.id}:`)) total += value.delta;
  if (total !== 0n || transaction.status !== "draft") return total;
  return transaction.type === "transfer" ? 0n : transaction.amount * BigInt(transaction.flowDirection);
}

export function accountForRow(data: ExportData, transaction: ExportTransaction, selectedAccountId: string | null) {
  return data.accounts.find((account) => account.id === (selectedAccountId ?? transaction.accountId));
}

export function exportSummary(data: ExportData, accountId: string | null) {
  let income = 0n; let expenses = 0n;
  const categories = new Map<string, bigint>();
  for (const transaction of data.transactions) {
    const delta = transactionDelta(transaction, accountId, data.ledgerByTransactionAccount);
    if (delta > 0n) income += delta;
    if (delta < 0n) expenses += -delta;
    const sign = delta < 0n ? -1n : delta > 0n ? 1n : 0n;
    for (const category of transaction.categories) categories.set(category.name, (categories.get(category.name) ?? 0n) + category.amount * sign);
  }
  return { income, expenses, net: income - expenses, categories: [...categories].sort((a, b) => a[0].localeCompare(b[0])) };
}
