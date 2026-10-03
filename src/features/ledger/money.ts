const BAHT_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d{1,2}))?$/;

export function parseBahtToSatangs(value: string): bigint {
  const normalized = value.trim().replaceAll(",", "");
  const match = BAHT_PATTERN.exec(normalized);
  if (!match) throw new Error("จำนวนเงินต้องเป็นเลขบวกและมีทศนิยมไม่เกิน 2 ตำแหน่ง");
  const [baht, satang = ""] = normalized.split(".");
  return BigInt(baht) * 100n + BigInt(satang.padEnd(2, "0"));
}

export function parseSignedBahtToSatangs(value: string): bigint {
  const normalized = value.trim().replaceAll(",", "");
  const negative = normalized.startsWith("-");
  const absolute = negative ? normalized.slice(1) : normalized;
  const result = parseBahtToSatangs(absolute);
  return negative ? -result : result;
}

export function formatSatangs(value: bigint | string): string {
  const satangs = typeof value === "bigint" ? value : BigInt(value);
  const negative = satangs < 0n;
  const absolute = negative ? -satangs : satangs;
  const baht = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "−" : ""}฿${baht.toLocaleString("th-TH")}.${fraction}`;
}

export function balance(opening: bigint, inflows: bigint, outflows: bigint) {
  return opening + inflows - outflows;
}

export function availableBalance(current: bigint, activeReservations: bigint, reservedPayables: bigint) {
  return current - activeReservations - reservedPayables;
}

export function budgetRemaining(budget: bigint, netExpense: bigint) {
  return budget - netExpense;
}

export function assertSplitsEqual(total: bigint, splits: readonly bigint[]) {
  if (splits.reduce((sum, part) => sum + part, 0n) !== total) throw new Error("ผลรวมหมวดหมู่ต้องเท่ากับยอดรายการ");
}
