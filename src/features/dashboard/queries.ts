import "server-only";
import { bangkokMonthBounds } from "@/features/ledger/time";
import { requireUser } from "@/lib/supabase/server";

export async function getDashboardData() {
  const { supabase, userId } = await requireUser();
  const { start, end } = bangkokMonthBounds();
  const [balances, accountDetails, cashflow, recent, reviews, budgets] = await Promise.all([
    supabase.from("account_balances").select("account_id,balance_satangs,reserved_satangs,available_satangs").eq("owner_id", userId),
    supabase.from("accounts").select("id,name,color,icon").eq("owner_id", userId).eq("is_active", true),
    supabase.from("monthly_cashflow").select("income_satangs,expense_satangs").eq("owner_id", userId).eq("month_start", start.toISOString().slice(0, 10)).maybeSingle(),
    supabase.from("transactions").select("id,type,status,description,amount_satangs,occurred_at,accounts:accounts!transactions_account_id_owner_id_fkey(name)").eq("owner_id", userId).order("occurred_at", { ascending: false }).limit(6),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "needs_review"),
    supabase.from("budgets").select("amount_satangs,category_id").eq("owner_id", userId).lte("period_start", end.toISOString()).gte("period_end", start.toISOString()),
  ]);
  const error = balances.error ?? accountDetails.error ?? cashflow.error ?? recent.error ?? reviews.error ?? budgets.error;
  if (error) throw error;
  const balanceByAccount = new Map(balances.data?.map((balance) => [balance.account_id, balance]));
  const accounts = accountDetails.data?.map((account) => ({
    ...balanceByAccount.get(account.id),
    account_id: account.id,
    accounts: account,
  })) ?? [];
  return { accounts, cashflow: cashflow.data, recent: recent.data ?? [], pendingReviews: reviews.count ?? 0, budgets: budgets.data ?? [] };
}
