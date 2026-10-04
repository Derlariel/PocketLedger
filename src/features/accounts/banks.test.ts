import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANKS, getBank, maskLastFour } from "@/features/accounts/banks";

describe("bank catalogue", () => {
  it("has unique banks backed by bundled logo assets", () => {
    expect(new Set(BANKS.map((bank) => bank.id)).size).toBe(BANKS.length);
    for (const bank of BANKS) {
      expect(bank.name).toBeTruthy();
      expect(bank.shortName).toBeTruthy();
      expect(bank.code).toBeTruthy();
      expect(existsSync(join(process.cwd(), "public", bank.logoPath.replace(/^\//, "")))).toBe(true);
      expect(getBank(bank.id)).toBe(bank);
    }
  });

  it("only renders a masked account-number suffix", () => {
    expect(maskLastFour("1234")).toBe("•••• 1234");
    expect(maskLastFour(null)).toBe("Not provided");
  });
});
