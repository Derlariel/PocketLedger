import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TransactionTable, type TransactionRow } from "@/features/transactions/transaction-table";
import { ExportButton } from "@/features/exports/export-button";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ธุรกรรม" };
const PAGE_SIZE = 25;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; type?: string; from?: string; to?: string; page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { supabase, userId } = await requireUser();
  let query = supabase.from("transactions").select("id,occurred_at,type,description,amount_satangs,status,source,accounts:accounts!transactions_account_id_owner_id_fkey(name,type,bank_id),transaction_splits(categories(name)),transaction_documents(document_id)", { count: "exact" }).eq("owner_id", userId).order("occurred_at", { ascending: false }).order("created_at", { ascending: false });
  if (params.q) query = query.ilike("description", `%${params.q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.type) query = query.eq("type", params.type);
  if (params.from) query = query.gte("occurred_at", new Date(`${params.from}T00:00:00+07:00`).toISOString());
  if (params.to) query = query.lt("occurred_at", new Date(new Date(`${params.to}T00:00:00+07:00`).getTime() + 86_400_000).toISOString());
  const { data, error, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">ค้นหาและกรองจากฐานข้อมูล · หน้าละ {PAGE_SIZE} รายการ</p><h1 className="mt-1 text-2xl font-bold">ธุรกรรม</h1></div><div className="flex gap-2"><ExportButton initial={{ query: params.q, type: params.type, status: params.status, from: params.from, to: params.to }} /><Link href="/transactions/new"><Button><Plus className="size-4" aria-hidden="true" />รายการใหม่</Button></Link></div></div>
    <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-[2fr_repeat(4,1fr)_auto]"><label className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" /><Input className="pl-9" name="q" defaultValue={params.q} placeholder="ค้นหารายละเอียด" aria-label="ค้นหา" /></label><select name="type" defaultValue={params.type} className="min-h-11 rounded-xl border bg-background px-3"><option value="">ทุกประเภท</option><option value="income">รายรับ</option><option value="expense">รายจ่าย</option><option value="transfer">โอนเงิน</option><option value="refund">คืนเงิน</option><option value="adjustment">ปรับยอด</option></select><select name="status" defaultValue={params.status} className="min-h-11 rounded-xl border bg-background px-3"><option value="">ทุกสถานะ</option><option value="draft">ฉบับร่าง</option><option value="posted">ยืนยันแล้ว</option><option value="voided">ยกเลิก</option></select><Input type="date" name="from" defaultValue={params.from} aria-label="จากวันที่" /><Input type="date" name="to" defaultValue={params.to} aria-label="ถึงวันที่" /><Button type="submit">กรอง</Button></form>
    <TransactionTable data={(data ?? []) as unknown as TransactionRow[]} />
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{count ?? 0} รายการ</span><div className="flex items-center gap-3"><Link aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-40" : "hover:text-foreground"} href={{ query: { ...params, page: page - 1 } }}>ก่อนหน้า</Link><span>{page} / {totalPages}</span><Link aria-disabled={page >= totalPages} className={page >= totalPages ? "pointer-events-none opacity-40" : "hover:text-foreground"} href={{ query: { ...params, page: page + 1 } }}>ถัดไป</Link></div></div>
  </div>;
}
