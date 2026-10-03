import { assertSplitsEqual, availableBalance, balance, budgetRemaining, parseBahtToSatangs } from "../src/features/ledger/money";
import { bangkokDayBounds, bangkokMonthBounds } from "../src/features/ledger/time";

function equal(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

equal(parseBahtToSatangs("1,234.56"), 123456n, "exact satang parsing");
equal(balance(10000n, 2500n, 700n), 11800n, "balance formula");
equal(availableBalance(11800n, 3000n, 1200n), 7600n, "available formula");
equal(availableBalance(100n, 300n, 0n), -200n, "negative available balance");
equal(budgetRemaining(50000n, 12345n), 37655n, "budget formula");
assertSplitsEqual(100n, [40n, 60n]);
equal(bangkokDayBounds(new Date("2026-01-15T20:00:00Z")).start.toISOString(), "2026-01-15T17:00:00.000Z", "Bangkok day boundary");
equal(bangkokMonthBounds(new Date("2025-12-31T18:00:00Z")).end.toISOString(), "2026-01-31T17:00:00.000Z", "Bangkok month boundary");

console.log("PocketLedger ledger smoke checks passed");
