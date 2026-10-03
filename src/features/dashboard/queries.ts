import "server-only";
import { bangkokMonthBounds } from "@/features/ledger/time";
import { requireUser } from "@/lib/supabase/server";

export async function getDashboardData() {
  const { supabase, userId } = await requireUser();
  const { start, end } = bangkokMonthBounds();
  const [accounts, cashflow, recent, reviews, budgets] = await Promise.all([
    supabase.from("account_balances").select("account_id,balance_satangs,reserved_satangs,available_satangs,accounts!inner(name,color,icon,is_active)").eq("owner_id", userId).eq("accounts.is_active", true),
    supabase.from("monthly_cashflow").select("income_satangs,expense_satangs").eq("owner_id", userId).eq("month_start", start.toISOString().slice(0, 10)).maybeSingle(),
    supabase.from("transactions").select("id,type,status,description,amount_satangs,occurred_at,accounts(name)").eq("owner_id", userId).order("occurred_at", { ascending: false }).limit(6),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "needs_review"),
    supabase.from("budgets").select("amount_satangs,category_id").eq("owner_id", userId).lte("period_start", end.toISOString()).gte("period_end", start.toISOString()),
  ]);
  const error = accounts.error ?? cashflow.error ?? recent.error ?? reviews.error ?? budgets.error;
  if (error) throw error;
  return { accounts: accounts.data ?? [], cashflow: cashflow.data, recent: recent.data ?? [], pendingReviews: reviews.count ?? 0, budgets: budgets.data ?? [] };
}
