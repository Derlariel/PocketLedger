import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CircleAlert, Landmark, PiggyBank, ScanLine, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CashflowChart } from "@/features/dashboard/cashflow-chart";
import { getDashboardData } from "@/features/dashboard/queries";
import { formatSatangs } from "@/features/ledger/money";

export const metadata = { title: "ภาพรวม" };

export default async function DashboardPage() {
  const data = await getDashboardData();
  const total = data.accounts.reduce((sum, item) => sum + BigInt(item.balance_satangs ?? 0), 0n);
  const available = data.accounts.reduce((sum, item) => sum + BigInt(item.available_satangs ?? 0), 0n);
  const reserved = data.accounts.reduce((sum, item) => sum + BigInt(item.reserved_satangs ?? 0), 0n);
  const income = String(data.cashflow?.income_satangs ?? "0");
  const expense = String(data.cashflow?.expense_satangs ?? "0");
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">ข้อมูล ณ ตอนนี้ · อัปเดตจากรายการที่ยืนยันแล้ว</p><h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">ภาพรวมการเงิน</h1></div><div className="flex gap-2"><Link href="/upload" className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-semibold"><ScanLine className="size-4" aria-hidden="true" />สแกนหลักฐาน</Link><Link href="/transactions/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">บันทึกรายการ</Link></div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="ยอดคงเหลือรวม" value={formatSatangs(total)} note="ยอดตั้งต้น + เงินเข้า − เงินออก" icon={Landmark} />
        <Metric title="ยอดเงินที่ใช้ได้" value={formatSatangs(available)} note="หักเงินกันไว้และรายจ่ายสำรอง" icon={WalletCards} warning={available < 0n} />
        <Metric title="เงินกันไว้" value={formatSatangs(reserved)} note="ก้อนที่ยังไม่ถูกใช้" icon={PiggyBank} />
        <Metric title="เอกสารรอตรวจ" value={`${data.pendingReviews} รายการ`} note="OCR ไม่ยืนยันรายการอัตโนมัติ" icon={ScanLine} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_.9fr]">
        <Card><CardHeader><CardTitle>รายรับเทียบรายจ่ายเดือนนี้</CardTitle><CardDescription>ช่วงเวลาคำนวณตาม Asia/Bangkok และไม่รวมการโอนภายใน</CardDescription></CardHeader><CardContent><CashflowChart income={income} expense={expense} /><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-xl bg-accent p-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownLeft className="size-4" aria-hidden="true" />รายรับ</p><p className="mt-1 font-semibold">{formatSatangs(income)}</p></div><div className="rounded-xl bg-secondary p-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowUpRight className="size-4" aria-hidden="true" />รายจ่าย</p><p className="mt-1 font-semibold">{formatSatangs(expense)}</p></div></div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>บัญชีของฉัน</CardTitle><CardDescription>{data.accounts.length} บัญชีที่ใช้งาน</CardDescription></div><Link href="/accounts" aria-label="ดูบัญชีทั้งหมด"><ArrowRight className="size-5" /></Link></CardHeader><CardContent className="space-y-3">{data.accounts.length === 0 ? <Empty text="ยังไม่มีบัญชี เพิ่มบัญชีแรกเพื่อเริ่มบันทึก" href="/accounts" /> : data.accounts.map((account) => { const relation = Array.isArray(account.accounts) ? account.accounts[0] : account.accounts; return <div key={account.account_id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="flex min-w-0 items-center gap-3"><span className="size-3 shrink-0 rounded-full" style={{ background: relation?.color ?? "var(--primary)" }} /><p className="truncate text-sm font-medium">{relation?.name ?? "บัญชี"}</p></div><p className="whitespace-nowrap font-semibold">{formatSatangs(String(account.balance_satangs ?? 0))}</p></div>; })}</CardContent></Card>
      </div>
      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>รายการล่าสุด</CardTitle><CardDescription>แสดง Draft เพื่อให้ทราบว่ายังไม่กระทบยอด</CardDescription></div><Link href="/transactions" className="text-sm font-semibold text-primary">ดูทั้งหมด</Link></CardHeader><CardContent>{data.recent.length === 0 ? <Empty text="ยังไม่มีธุรกรรม" href="/transactions/new" /> : <div className="divide-y">{data.recent.map((item) => <Link href={`/transactions/${item.id}`} key={item.id} className="flex min-h-16 items-center justify-between gap-4 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-medium">{item.description}</p><Badge>{item.status === "posted" ? "ยืนยันแล้ว" : item.status === "draft" ? "ฉบับร่าง" : "ยกเลิก"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurred_at))}</p></div><p className={`whitespace-nowrap font-semibold ${item.type === "income" || item.type === "refund" ? "text-primary" : ""}`}>{item.type === "income" || item.type === "refund" ? "+" : "−"}{formatSatangs(String(item.amount_satangs))}</p></Link>)}</div>}</CardContent></Card>
    </div>
  );
}

function Metric({ title, value, note, icon: Icon, warning }: { title: string; value: string; note: string; icon: typeof Landmark; warning?: boolean }) {
  return <Card><CardContent className="p-5"><div className="flex items-start justify-between"><p className="text-sm text-muted-foreground">{title}</p><span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-4" aria-hidden="true" /></span></div><p className={`mt-2 text-2xl font-bold tracking-tight ${warning ? "text-destructive" : ""}`}>{value}</p><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">{warning && <CircleAlert className="size-3.5 text-destructive" aria-hidden="true" />}{note}</p></CardContent></Card>;
}
function Empty({ text, href }: { text: string; href: string }) { return <div className="rounded-xl border border-dashed p-7 text-center"><p className="text-sm text-muted-foreground">{text}</p><Link href={href}><Button className="mt-4" size="sm">เริ่มต้น</Button></Link></div>; }
