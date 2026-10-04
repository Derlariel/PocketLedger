import { z } from "zod";

export const MAX_SYNC_EXPORT_ROWS = 5000;
export const EXPORTS_PER_HOUR = 10;

export const exportFilterSchema = z.object({
  format: z.enum(["csv", "pdf"]),
  accountId: z.union([z.uuid(), z.literal("all")]).default("all"),
  preset: z.enum(["this_month", "last_month", "last_3_months", "this_year", "custom", "all_time"]).default("this_month"),
  from: z.iso.date().optional().or(z.literal("")),
  to: z.iso.date().optional().or(z.literal("")),
  types: z.array(z.enum(["income", "expense", "transfer", "refund", "adjustment", "reversal"])).max(6).default([]),
  statuses: z.array(z.enum(["draft", "posted", "voided"])).max(3).default([]),
  categoryIds: z.array(z.uuid()).max(100).default([]),
  tagIds: z.array(z.uuid()).max(100).default([]),
  includeVoided: z.boolean().default(false),
  includeNotes: z.boolean().default(false),
  sort: z.enum(["asc", "desc"]).default("asc"),
  currency: z.literal("THB").default("THB"),
  query: z.string().trim().max(100).default(""),
}).superRefine((filter, context) => {
  if (filter.preset === "custom" && (!filter.from || !filter.to)) context.addIssue({ code: "custom", path: ["from"], message: "Custom exports require both dates." });
  if (filter.from && filter.to && filter.from > filter.to) context.addIssue({ code: "custom", path: ["to"], message: "The end date must be on or after the start date." });
  if (!filter.includeVoided && filter.statuses.includes("voided")) context.addIssue({ code: "custom", path: ["includeVoided"], message: "Enable voided transactions to export the voided status." });
});

export type ExportFilter = z.infer<typeof exportFilterSchema>;

function bangkokDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function dateString(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function monthEnd(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function resolveDateRange(filter: ExportFilter, now = new Date()) {
  if (filter.preset === "all_time") return { fromDate: null, toDate: null, fromIso: null, toExclusiveIso: null };
  if (filter.preset === "custom") return toRange(filter.from || null, filter.to || null);
  const { year, month } = bangkokDateParts(now);
  if (filter.preset === "this_month") return toRange(dateString(year, month, 1), dateString(year, month, monthEnd(year, month)));
  if (filter.preset === "last_month") {
    const previous = new Date(Date.UTC(year, month - 2, 1));
    const y = previous.getUTCFullYear(); const m = previous.getUTCMonth() + 1;
    return toRange(dateString(y, m, 1), dateString(y, m, monthEnd(y, m)));
  }
  if (filter.preset === "last_3_months") {
    const first = new Date(Date.UTC(year, month - 3, 1));
    return toRange(dateString(first.getUTCFullYear(), first.getUTCMonth() + 1, 1), dateString(year, month, monthEnd(year, month)));
  }
  return toRange(dateString(year, 1, 1), dateString(year, 12, 31));
}

function toRange(fromDate: string | null, toDate: string | null) {
  const fromIso = fromDate ? new Date(`${fromDate}T00:00:00+07:00`).toISOString() : null;
  const toExclusiveIso = toDate ? new Date(new Date(`${toDate}T00:00:00+07:00`).getTime() + 86_400_000).toISOString() : null;
  return { fromDate, toDate, fromIso, toExclusiveIso };
}

export function sanitizeFilenamePart(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9ก-๙]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "all-accounts";
}
