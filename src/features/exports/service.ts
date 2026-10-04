import "server-only";
import { EXPORTS_PER_HOUR, MAX_SYNC_EXPORT_ROWS, resolveDateRange, sanitizeFilenamePart, type ExportFilter } from "@/features/exports/filters";
import { ledgerKey, type ExportAccount, type ExportData, type ExportTransaction } from "@/features/exports/model";
import { requireUser } from "@/lib/supabase/server";

export class ExportError extends Error {
  constructor(message: string, public status = 400, public code = "export_failed") { super(message); }
}

export async function previewExport(filter: ExportFilter) {
  const context = await exportContext(filter);
  return { count: context.ids.length, tooLarge: context.ids.length > MAX_SYNC_EXPORT_ROWS, accounts: context.accounts.map((account) => account.name), period: periodText(context.range.fromDate, context.range.toDate) };
}

export async function loadExportData(filter: ExportFilter): Promise<ExportData> {
  const { supabase, userId } = await requireUser();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const rate = await supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("event_type", "exported").gte("created_at", hourAgo);
  if (rate.error) throw new ExportError("Export rate limit could not be checked. Please retry.", 500);
  if ((rate.count ?? 0) >= EXPORTS_PER_HOUR) throw new ExportError(`You can generate up to ${EXPORTS_PER_HOUR} exports per hour. Try again later.`, 429, "rate_limited");

  const context = await exportContext(filter, { supabase, userId });
  if (!context.ids.length) throw new ExportError("No transactions match these export filters.", 422, "no_transactions");
  if (context.ids.length > MAX_SYNC_EXPORT_ROWS) throw new ExportError(`This export exceeds the ${MAX_SYNC_EXPORT_ROWS.toLocaleString()} transaction synchronous limit. Narrow the filters and retry.`, 413, "too_large");

  const rawTransactions = await fetchInBatches(context.ids, async (ids) => {
    const result = await supabase.from("transactions").select("id,account_id,counter_account_id,occurred_at,created_at,updated_at,type,description,note,status,source,amount_satangs,flow_direction,transaction_splits(amount_satangs,categories(id,name)),transaction_tags(tags(id,name)),transaction_documents(document_id)").eq("owner_id", userId).in("id", ids);
    if (result.error) throw new ExportError("Transactions could not be loaded for export.", 500);
    return result.data ?? [];
  });
  const transactions: ExportTransaction[] = rawTransactions.map((row) => ({
    id: String(row.id), accountId: String(row.account_id), counterAccountId: row.counter_account_id ? String(row.counter_account_id) : null,
    occurredAt: String(row.occurred_at), createdAt: String(row.created_at), updatedAt: String(row.updated_at), type: String(row.type), description: String(row.description),
    note: row.note ? String(row.note) : null, status: String(row.status), source: String(row.source), amount: BigInt(row.amount_satangs), flowDirection: Number(row.flow_direction) as -1 | 1,
    categories: relationArray(row.transaction_splits).flatMap((split) => { const category = relationOne(split.categories); return category ? [{ id: String(category.id), name: String(category.name), amount: BigInt(String(split.amount_satangs)) }] : []; }),
    tags: relationArray(row.transaction_tags).flatMap((entry) => { const tag = relationOne(entry.tags); return tag ? [{ id: String(tag.id), name: String(tag.name) }] : []; }),
    hasEvidence: relationArray(row.transaction_documents).length > 0,
  }));
  transactions.sort((a, b) => compareTransactions(a, b) * (filter.sort === "asc" ? 1 : -1));

  const ledgerRows = await fetchInBatches(context.ids, async (ids) => {
    const result = await supabase.from("account_ledger_export").select("transaction_id,account_id,delta_satangs,running_balance_satangs").eq("owner_id", userId).in("transaction_id", ids);
    if (result.error) throw new ExportError("Ledger balances could not be loaded for export.", 500);
    return result.data ?? [];
  });
  const ledgerByTransactionAccount = new Map(ledgerRows.map((row) => [ledgerKey(String(row.transaction_id), String(row.account_id)), { delta: BigInt(row.delta_satangs), running: BigInt(row.running_balance_satangs) }]));

  const balanceResult = await supabase.from("account_balances").select("account_id,available_satangs").eq("owner_id", userId).in("account_id", context.accounts.map((account) => account.id));
  if (balanceResult.error) throw new ExportError("Account balances could not be loaded for export.", 500);
  const available = new Map((balanceResult.data ?? []).map((row) => [String(row.account_id), BigInt(row.available_satangs)]));

  const accounts: ExportAccount[] = await Promise.all(context.accounts.map(async (account) => ({
    ...account,
    openingAtPeriod: await balanceAt(supabase, userId, account, context.range.fromIso, true),
    closingAtPeriod: await balanceAt(supabase, userId, account, context.range.toExclusiveIso, false),
    availableBalance: available.get(account.id) ?? account.openingBalance,
  })));
  return { filter, generatedAt: new Date(), fromDate: context.range.fromDate, toDate: context.range.toDate, accounts, transactions, ledgerByTransactionAccount };
}

export async function recordExportAudit(data: ExportData) {
  const { supabase } = await requireUser();
  const filters = { accountId: data.filter.accountId, preset: data.filter.preset, from: data.fromDate, to: data.toDate, types: data.filter.types, statuses: data.filter.statuses, categoryIds: data.filter.categoryIds, tagIds: data.filter.tagIds, includeVoided: data.filter.includeVoided, sort: data.filter.sort, currency: data.filter.currency };
  const result = await supabase.rpc("record_export_audit", { p_format: data.filter.format, p_filters: filters, p_account_ids: data.accounts.map((account) => account.id), p_transaction_count: data.transactions.length });
  if (result.error) throw new ExportError("The export audit event could not be recorded, so no file was released.", 500);
}

export function exportFilename(data: ExportData) {
  const name = data.accounts.length === 1 ? data.accounts[0].name : "all-accounts";
  const period = data.fromDate || data.toDate ? `${data.fromDate ?? "beginning"}-to-${data.toDate ?? "present"}` : "all-time";
  return `pocketledger-${sanitizeFilenamePart(name)}-${period}.${data.filter.format}`;
}

async function exportContext(filter: ExportFilter, existing?: Awaited<ReturnType<typeof requireUser>>) {
  const { supabase, userId } = existing ?? await requireUser();
  const range = resolveDateRange(filter);
  let accountsQuery = supabase.from("accounts").select("id,name,bank_id,bank_name,account_number_last4,currency,opening_balance_satangs,opening_balance_date").eq("owner_id", userId).order("name");
  if (filter.accountId !== "all") accountsQuery = accountsQuery.eq("id", filter.accountId);
  const accountsResult = await accountsQuery;
  if (accountsResult.error) throw new ExportError("Accounts could not be loaded for export.", 500);
  if (filter.accountId !== "all" && !accountsResult.data?.length) throw new ExportError("The selected account was not found or does not belong to you.", 404, "account_not_found");
  const accounts = (accountsResult.data ?? []).map((account) => ({ id: String(account.id), name: String(account.name), bankId: account.bank_id ? String(account.bank_id) : null, bankName: account.bank_name ? String(account.bank_name) : null, lastFour: account.account_number_last4 ? String(account.account_number_last4) : null, currency: String(account.currency), openingBalance: BigInt(account.opening_balance_satangs), openingBalanceDate: String(account.opening_balance_date) }));
  await Promise.all([validateOwnedIds(supabase, userId, "categories", filter.categoryIds), validateOwnedIds(supabase, userId, "tags", filter.tagIds)]);
  const args = { p_account_id: filter.accountId === "all" ? null : filter.accountId, p_from: range.fromIso, p_to: range.toExclusiveIso, p_types: filter.types.length ? filter.types : null, p_statuses: filter.statuses.length ? filter.statuses : null, p_category_ids: filter.categoryIds.length ? filter.categoryIds : null, p_tag_ids: filter.tagIds.length ? filter.tagIds : null, p_include_voided: filter.includeVoided, p_query: filter.query || null };
  const ids: string[] = [];
  for (let start = 0; start <= MAX_SYNC_EXPORT_ROWS; start += 1000) {
    const page = await supabase.rpc("get_export_transaction_ids", args).range(start, Math.min(start + 999, MAX_SYNC_EXPORT_ROWS));
    if (page.error) throw new ExportError("Matching transactions could not be selected. Apply the latest export migration and retry.", 500);
    ids.push(...(page.data ?? []).map((row: { id: unknown }) => String(row.id)));
    if ((page.data?.length ?? 0) < 1000) break;
  }
  return { supabase, userId, range, accounts, ids };
}

async function validateOwnedIds(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, table: "categories" | "tags", ids: string[]) {
  if (!ids.length) return;
  const result = await supabase.from(table).select("id").eq("owner_id", userId).in("id", ids);
  if (result.error || result.data?.length !== new Set(ids).size) throw new ExportError(`One or more selected ${table} do not belong to you.`, 403, "invalid_filter_ownership");
}

async function balanceAt(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, account: { id: string; openingBalance: bigint; openingBalanceDate: string }, boundary: string | null, opening: boolean) {
  if (!boundary && opening) return account.openingBalance;
  if (boundary && boundary <= new Date(`${account.openingBalanceDate}T00:00:00+07:00`).toISOString()) return 0n;
  let query = supabase.from("account_ledger_export").select("running_balance_satangs").eq("owner_id", userId).eq("account_id", account.id).order("occurred_at", { ascending: false }).order("transaction_created_at", { ascending: false }).order("transaction_id", { ascending: false }).limit(1);
  if (boundary) query = query.lt("occurred_at", boundary);
  const result = await query.maybeSingle();
  if (result.error) throw new ExportError("A period balance could not be calculated.", 500);
  return result.data ? BigInt(result.data.running_balance_satangs) : account.openingBalance;
}

async function fetchInBatches<T>(ids: string[], fetcher: (ids: string[]) => Promise<T[]>) {
  const output: T[] = [];
  for (let index = 0; index < ids.length; index += 200) output.push(...await fetcher(ids.slice(index, index + 200)));
  return output;
}

function relationArray(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value as Record<string, unknown>[] : []; }
function relationOne(value: unknown): Record<string, unknown> | null { return Array.isArray(value) ? value[0] as Record<string, unknown> ?? null : value && typeof value === "object" ? value as Record<string, unknown> : null; }
function compareTransactions(a: ExportTransaction, b: ExportTransaction) { return a.occurredAt.localeCompare(b.occurredAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id); }
function periodText(from: string | null, to: string | null) { return from || to ? `${from ?? "Beginning"} to ${to ?? "Present"}` : "All time"; }
