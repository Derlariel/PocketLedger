import { describe, expect, it } from "vitest";
import { assertSplitsEqual, availableBalance, balance, budgetRemaining, formatSatangs, parseBahtToSatangs, parseSignedBahtToSatangs } from "./money";

describe("money without floating point", () => {
  it("converts baht strings exactly", () => {
    expect(parseBahtToSatangs("1,234.56")).toBe(123456n);
    expect(parseBahtToSatangs("0.1")).toBe(10n);
    expect(parseSignedBahtToSatangs("-20.05")).toBe(-2005n);
    expect(() => parseBahtToSatangs("0.001")).toThrow();
  });
  it("calculates balance, available funds and budget", () => {
    expect(balance(10000n, 2500n, 700n)).toBe(11800n);
    expect(availableBalance(11800n, 3000n, 1200n)).toBe(7600n);
    expect(availableBalance(100n, 300n, 0n)).toBe(-200n);
    expect(budgetRemaining(50000n, 12345n)).toBe(37655n);
  });
  it("validates exact split totals", () => {
    expect(() => assertSplitsEqual(100n, [40n, 60n])).not.toThrow();
    expect(() => assertSplitsEqual(100n, [40n, 59n])).toThrow();
  });
  it("formats negative satangs", () => expect(formatSatangs("-12345")).toContain("−฿"));
});
