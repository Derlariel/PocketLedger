import Link from "next/link";
import { ArrowLeft, Archive, Banknote, CreditCard, Landmark, Trash2, Wallet } from "lucide-react";
import { notFound } from "next/navigation";
import { archiveAccount, deleteAccount } from "@/features/accounts/actions";
import { AccountEditForm } from "@/features/accounts/account-edit-form";
import { ExportButton } from "@/features/exports/export-button";
import { BankLogo } from "@/features/accounts/bank-logo";
import { getBank, maskLastFour, type BankId } from "@/features/accounts/banks";
import { formatSatangs } from "@/features/ledger/money";
import { requireUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const typeLabels: Record<string, string> = { bank: "Bank account", cash: "Cash", ewallet: "E-wallet", credit_card: "Credit card" };

export default async function AccountDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, userId } = await requireUser();
  const [account, balance, transactions] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).eq("owner_id", userId).maybeSingle(),
    supabase.from("account_balances").select("balance_satangs,available_satangs,reserved_satangs").eq("account_id", id).eq("owner_id", userId).maybeSingle(),
    supabase.from("transactions").select("id,occurred_at,description,type,status,amount_satangs", { count: "exact" }).eq("owner_id", userId).or(`account_id.eq.${id},counter_account_id.eq.${id}`).order("occurred_at", { ascending: false }).limit(50),
  ]);
  if (account.error || balance.error || transactions.error) throw account.error ?? balance.error ?? transactions.error;
  if (!account.data) notFound();

  const item = account.data;
  const bank = getBank(item.bank_id);
  const Icon = item.type === "cash" ? Banknote : item.type === "credit_card" ? CreditCard : item.type === "ewallet" ? Wallet : Landmark;

  return <div className="mx-auto max-w-4xl space-y-5">
    <div className="flex items-center justify-between gap-3"><Link href="/accounts" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Back to accounts</Link><ExportButton initial={{ accountId: id }} /></div>
    {query.error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{query.error}</p>}
    <div className="flex items-center gap-4">
      {item.type === "bank" ? <BankLogo bankId={item.bank_id} className="size-14" /> : <span className="flex size-14 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: item.color }}><Icon className="size-6" aria-hidden="true" /></span>}
      <div><p className="text-sm text-muted-foreground">Manual account · {typeLabels[item.type]}</p><h1 className="text-2xl font-bold">{item.name}</h1></div>
    </div>

    <div className="grid gap-5 sm:grid-cols-2">
      <Card><CardHeader><CardTitle>Balance</CardTitle><CardDescription>Manually maintained · {item.currency} · not verified by a bank</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{formatSatangs(String(balance.data?.balance_satangs ?? item.opening_balance_satangs))}</p><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><dt className="text-muted-foreground">Available</dt><dd>{formatSatangs(String(balance.data?.available_satangs ?? item.opening_balance_satangs))}</dd><dt className="text-muted-foreground">Reserved</dt><dd>{formatSatangs(String(balance.data?.reserved_satangs ?? 0))}</dd><dt className="text-muted-foreground">Status</dt><dd>{item.is_active ? "Active" : "Archived"}</dd></dl></CardContent></Card>
      <Card><CardHeader><CardTitle>Account details</CardTitle><CardDescription>Sensitive account numbers are never stored in full.</CardDescription></CardHeader><CardContent><dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm"><dt className="text-muted-foreground">Type</dt><dd>{typeLabels[item.type]}</dd><dt className="text-muted-foreground">Bank</dt><dd>{bank ? <BankLogo bankId={bank.id} showName /> : "—"}</dd>{bank && <><dt className="text-muted-foreground">Bank code</dt><dd>{bank.code} · {bank.id}</dd></>}<dt className="text-muted-foreground">Holder</dt><dd>{item.account_holder_name ?? "Not provided"}</dd><dt className="text-muted-foreground">Account number</dt><dd>{maskLastFour(item.account_number_last4)}</dd><dt className="text-muted-foreground">Opening date</dt><dd>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(`${item.opening_balance_date}T00:00:00+07:00`))}</dd><dt className="text-muted-foreground">Note</dt><dd className="whitespace-pre-wrap">{item.note ?? "—"}</dd></dl></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Edit manual account</CardTitle><CardDescription>Opening balances and account types stay fixed to protect ledger history.</CardDescription></CardHeader><CardContent><AccountEditForm account={{ id: item.id, type: item.type as "bank" | "cash" | "ewallet" | "credit_card", name: item.name, bankId: item.bank_id as BankId | null, holderName: item.account_holder_name ?? "", lastFour: item.account_number_last4 ?? "", color: item.color, note: item.note ?? "" }} /></CardContent></Card>

    <Card><CardHeader><CardTitle>Transaction history</CardTitle><CardDescription>{transactions.count ?? 0} transaction{transactions.count === 1 ? "" : "s"} · showing the latest 50</CardDescription></CardHeader><CardContent>{transactions.data?.length ? <div className="divide-y">{transactions.data.map((transaction) => <Link key={transaction.id} href={`/transactions/${transaction.id}`} className="flex min-h-16 items-center justify-between gap-4 py-3 hover:text-primary"><span className="min-w-0"><span className="block truncate font-medium">{transaction.description}</span><span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(transaction.occurred_at))} · {transaction.status}</span></span><span className="whitespace-nowrap font-semibold">{formatSatangs(String(transaction.amount_satangs))}</span></Link>)}</div> : <p className="text-sm text-muted-foreground">No transactions have been recorded for this account.</p>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Account lifecycle</CardTitle><CardDescription>Archive accounts with history. Permanent deletion is available only when no transaction would be removed or orphaned.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3">{item.is_active && <form action={archiveAccount}><input type="hidden" name="id" value={item.id} /><Button variant="outline" type="submit"><Archive className="size-4" aria-hidden="true" />Archive account</Button></form>}{(transactions.count ?? 0) === 0 && <form action={deleteAccount}><input type="hidden" name="id" value={item.id} /><Button variant="destructive" type="submit"><Trash2 className="size-4" aria-hidden="true" />Delete empty account</Button></form>}</CardContent></Card>
  </div>;
}
