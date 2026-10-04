import Link from "next/link";
import { Archive, Banknote, CreditCard, Landmark, Link2Off, Wallet } from "lucide-react";
import { archiveAccount, reconcileAccount } from "@/features/accounts/actions";
import { AccountForm } from "@/features/accounts/account-form";
import { ExportButton } from "@/features/exports/export-button";
import { BankLogo } from "@/features/accounts/bank-logo";
import { getBank, maskLastFour } from "@/features/accounts/banks";
import { formatSatangs } from "@/features/ledger/money";
import { requireUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Accounts" };

const typeLabels: Record<string, string> = { bank: "Bank account", cash: "Cash", ewallet: "E-wallet", credit_card: "Credit card" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, userId } = await requireUser();
  const [accounts, balances] = await Promise.all([
    supabase.from("accounts").select("*").eq("owner_id", userId).order("is_active", { ascending: false }).order("created_at"),
    supabase.from("account_balances").select("account_id,balance_satangs,available_satangs").eq("owner_id", userId),
  ]);
  const queryError = accounts.error ?? balances.error;
  const balanceByAccount = new Map(balances.data?.map((balance) => [balance.account_id, balance]));
  const data = accounts.data?.map((account) => ({ ...account, account_balances: balanceByAccount.get(account.id) })) ?? [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">All accounts are maintained manually from the transactions you record or import.</p><h1 className="mt-1 text-2xl font-bold">Accounts</h1></div><ExportButton /></div>
    {(params.error || params.message) && <div role={params.error ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${params.error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary"}`}>{params.error ?? params.message}</div>}
    {queryError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Accounts could not be loaded. Apply the latest Supabase migrations, then refresh this page.</div>}

    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <section aria-labelledby="account-list-title">
        <h2 id="account-list-title" className="sr-only">Saved accounts</h2>
        <div className="grid content-start gap-4 sm:grid-cols-2">
          {data.length ? data.map((account) => {
            const Icon = account.type === "cash" ? Banknote : account.type === "credit_card" ? CreditCard : account.type === "ewallet" ? Wallet : Landmark;
            const summary = Array.isArray(account.account_balances) ? account.account_balances[0] : account.account_balances;
            const bank = getBank(account.bank_id);
            return <Card key={account.id} className={!account.is_active ? "opacity-65" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  {account.type === "bank" ? <BankLogo bankId={account.bank_id} className="size-11" /> : <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: account.color }}><Icon className="size-5" aria-hidden="true" /></span>}
                  {!account.is_active && <span className="rounded-full bg-secondary px-2 py-1 text-xs">Inactive</span>}
                </div>
                <Link href={`/accounts/${account.id}`} className="mt-4 block font-semibold hover:text-primary hover:underline">{account.name}</Link>
                <p className="mt-1 text-xs text-muted-foreground">Manual account · {bank ? `${bank.shortName} · ${bank.code}` : typeLabels[account.type]}</p>
                {account.account_number_last4 && <p className="mt-1 text-xs text-muted-foreground">{maskLastFour(account.account_number_last4)}</p>}
                <p className="mt-3 text-2xl font-bold">{formatSatangs(String(summary?.balance_satangs ?? account.opening_balance_satangs))}</p>
                <p className="mt-2 text-xs text-muted-foreground">Available {formatSatangs(String(summary?.available_satangs ?? account.opening_balance_satangs))} · {account.currency}</p>
                {account.is_active && <form action={archiveAccount} className="mt-4"><input type="hidden" name="id" value={account.id} /><Button variant="ghost" size="sm" type="submit"><Archive className="size-4" aria-hidden="true" />Deactivate</Button></form>}
              </CardContent>
            </Card>;
          }) : !queryError && <div className="col-span-full rounded-2xl border border-dashed p-10 text-center"><Landmark className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><p className="mt-3 font-medium">No accounts yet</p><p className="mt-1 text-sm text-muted-foreground">Create a manual account to start recording transactions.</p></div>}
        </div>
      </section>

      <aside className="space-y-4">
        <Card><CardHeader><CardTitle>Manual account</CardTitle><CardDescription>Saved directly to your private PocketLedger account. Only the last four account-number digits are accepted.</CardDescription></CardHeader><CardContent><AccountForm today={today} /></CardContent></Card>
        <Card className="border-dashed"><CardHeader><CardTitle className="flex items-center gap-2"><Link2Off className="size-5" aria-hidden="true" />Connect Bank Automatically</CardTitle><CardDescription>Coming Soon</CardDescription></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Automatic bank connection is coming soon. For now, you can add your account manually and record or import transactions yourself.</p><Button className="w-full" type="button" disabled>Coming Soon</Button></CardContent></Card>
      </aside>
    </div>

    <Card><CardHeader><CardTitle>Reconcile a manual account</CardTitle><CardDescription>Records the observed balance and optionally creates an auditable adjustment transaction. This does not connect to a bank.</CardDescription></CardHeader><CardContent>{data.some((item) => item.is_active) ? <form action={reconcileAccount} className="grid gap-3 md:grid-cols-4"><label><Label>Account</Label><select name="accountId" className="mt-1.5 min-h-11 w-full rounded-xl border bg-background px-3">{data.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><Label>Statement balance (THB)</Label><Input name="statementBalance" inputMode="decimal" required /></label><label><Label>Reason / note</Label><Input name="note" required minLength={3} /></label><div className="flex items-end gap-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input name="createAdjustment" type="checkbox" />Create adjustment</label><Button type="submit">Save</Button></div></form> : <p className="text-sm text-muted-foreground">Create an active account before reconciling a balance.</p>}</CardContent></Card>
  </div>;
}
