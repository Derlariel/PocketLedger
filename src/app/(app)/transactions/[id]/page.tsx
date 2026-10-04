import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSatangs } from "@/features/ledger/money";
import { BankLogo } from "@/features/accounts/bank-logo";
import { voidTransaction } from "@/features/transactions/actions";
import { requireUser } from "@/lib/supabase/server";

export default async function TransactionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const [transaction, audit] = await Promise.all([
    supabase.from("transactions").select("*,accounts:accounts!transactions_account_id_owner_id_fkey(name,type,bank_id),transaction_splits(amount_satangs,categories(name)),transaction_documents(documents(id,original_name,storage_key,mime_type))").eq("id", id).eq("owner_id", userId).maybeSingle(),
    supabase.from("audit_logs").select("id,event_type,reason,created_at,actor_id,correlation_id").eq("owner_id", userId).eq("entity_id", id).order("created_at", { ascending: false }),
  ]);
  if (transaction.error || audit.error) throw transaction.error ?? audit.error;
  if (!transaction.data) notFound();
  const item = transaction.data;
  const account = Array.isArray(item.accounts) ? item.accounts[0] : item.accounts;
  return <div className="mx-auto max-w-4xl space-y-5"><div><p className="text-sm text-muted-foreground">รายละเอียดและประวัติที่ตรวจสอบได้</p><h1 className="mt-1 text-2xl font-bold">{item.description}</h1></div><div className="grid gap-5 md:grid-cols-2"><Card><CardHeader><CardTitle>รายการเงิน</CardTitle><CardDescription>ID {item.id}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-3xl font-bold">{formatSatangs(String(item.amount_satangs))}</p><dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-muted-foreground">บัญชี</dt><dd>{account ? <span className="flex items-center gap-2">{account.type === "bank" && <BankLogo bankId={account.bank_id} className="size-8 rounded-lg" />}{account.name}</span> : "—"}</dd><dt className="text-muted-foreground">สถานะ</dt><dd><Badge>{item.status}</Badge></dd><dt className="text-muted-foreground">ประเภท</dt><dd>{item.type}</dd><dt className="text-muted-foreground">เกิดขึ้นเมื่อ</dt><dd>{new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long", timeStyle: "short" }).format(new Date(item.occurred_at))}</dd><dt className="text-muted-foreground">แหล่งที่มา</dt><dd>{item.source}</dd></dl></CardContent></Card><Card><CardHeader><CardTitle>การดำเนินการ</CardTitle><CardDescription>รายการ Posted ไม่ถูกลบหรือเขียนยอดทับ</CardDescription></CardHeader><CardContent>{item.status === "posted" ? <form action={voidTransaction} className="space-y-3"><input type="hidden" name="id" value={item.id} /><label className="block text-sm font-medium">เหตุผลในการยกเลิก<textarea name="reason" required minLength={3} className="mt-1.5 w-full rounded-xl border bg-background p-3" rows={3} /></label><Button variant="destructive" type="submit">สร้าง reversal และยกเลิก</Button></form> : <p className="text-sm text-muted-foreground">รายการนี้ยังไม่สามารถยกเลิกแบบ reversal ได้</p>}</CardContent></Card></div><Card><CardHeader><CardTitle>Audit log</CardTitle><CardDescription>เหตุการณ์ฝั่ง server/database เรียงล่าสุดก่อน</CardDescription></CardHeader><CardContent>{audit.data?.length ? <ol className="space-y-4 border-l pl-5">{audit.data.map((entry) => <li key={entry.id}><p className="font-medium">{entry.event_type}</p><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "medium" }).format(new Date(entry.created_at))} · request {entry.correlation_id}</p>{entry.reason && <p className="mt-1 text-sm">เหตุผล: {entry.reason}</p>}</li>)}</ol> : <p className="text-sm text-muted-foreground">ยังไม่มีเหตุการณ์</p>}</CardContent></Card></div>;
}
