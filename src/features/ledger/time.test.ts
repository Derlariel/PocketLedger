import { describe, expect, it } from "vitest";
import { bangkokDayBounds, bangkokMonthBounds } from "./time";

describe("Asia/Bangkok boundaries", () => {
  it("starts a Bangkok day at 17:00 UTC on the prior date", () => {
    const { start, end } = bangkokDayBounds(new Date("2026-01-15T20:00:00Z"));
    expect(start.toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-16T17:00:00.000Z");
  });
  it("handles year boundaries", () => {
    const { start, end } = bangkokMonthBounds(new Date("2025-12-31T18:00:00Z"));
    expect(start.toISOString()).toBe("2025-12-31T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-31T17:00:00.000Z");
  });
});
