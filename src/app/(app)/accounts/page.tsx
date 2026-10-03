import { Archive, Banknote, Landmark, Plus, Wallet } from "lucide-react";
import { createAccount, archiveAccount, reconcileAccount } from "@/features/accounts/actions";
import { formatSatangs } from "@/features/ledger/money";
import { requireUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "บัญชี" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, userId } = await requireUser();
  const [accounts, balances] = await Promise.all([
    supabase.from("accounts").select("*").eq("owner_id", userId).order("is_active", { ascending: false }).order("created_at"),
    supabase.from("account_balances").select("account_id,balance_satangs,available_satangs").eq("owner_id", userId),
  ]);
  const error = accounts.error ?? balances.error;
  if (error) throw error;
  const balanceByAccount = new Map(balances.data?.map((balance) => [balance.account_id, balance]));
  const data = accounts.data?.map((account) => ({ ...account, account_balances: balanceByAccount.get(account.id) }));
  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">ยอดทั้งหมดคำนวณจาก ledger entries ที่ยืนยันแล้ว</p><h1 className="mt-1 text-2xl font-bold">บัญชี</h1></div>
    {(params.error || params.message) && <div role="status" className="rounded-xl border p-3 text-sm">{params.error ?? params.message}</div>}
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="grid content-start gap-4 sm:grid-cols-2">{data?.length ? data.map((account) => { const Icon = account.type === "bank" ? Landmark : account.type === "cash" ? Banknote : Wallet; const summary = Array.isArray(account.account_balances) ? account.account_balances[0] : account.account_balances; return <Card key={account.id} className={!account.is_active ? "opacity-65" : ""}><CardContent className="p-5"><div className="flex items-start justify-between"><span className="flex size-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: account.color }}><Icon className="size-5" aria-hidden="true" /></span>{!account.is_active && <span className="rounded-full bg-secondary px-2 py-1 text-xs">ปิดใช้งาน</span>}</div><p className="mt-4 font-semibold">{account.name}</p><p className="mt-1 text-2xl font-bold">{formatSatangs(String(summary?.balance_satangs ?? account.opening_balance_satangs))}</p><p className="mt-2 text-xs text-muted-foreground">ใช้ได้ {formatSatangs(String(summary?.available_satangs ?? account.opening_balance_satangs))}</p>{account.is_active && <form action={archiveAccount} className="mt-4"><input type="hidden" name="id" value={account.id} /><Button variant="ghost" size="sm" type="submit"><Archive className="size-4" aria-hidden="true" />ปิดใช้งาน</Button></form>}</CardContent></Card>; }) : <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">ยังไม่มีบัญชี เพิ่มบัญชีแรกจากแบบฟอร์ม</div>}</div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-5" aria-hidden="true" />เพิ่มบัญชี</CardTitle><CardDescription>ยอดตั้งต้นจะมีผลตั้งแต่วันที่ระบุ และแก้เงียบ ๆ ไม่ได้หลังมีประวัติ</CardDescription></CardHeader><CardContent><form action={createAccount} className="space-y-4"><Field label="ชื่อบัญชี" id="name"><Input id="name" name="name" required maxLength={80} placeholder="เช่น เงินเดือน" /></Field><div className="grid grid-cols-2 gap-3"><Field label="ประเภท" id="type"><select id="type" name="type" className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="bank">ธนาคาร</option><option value="cash">เงินสด</option><option value="ewallet">e-Wallet</option></select></Field><Field label="สี" id="color"><Input id="color" name="color" type="color" defaultValue="#2f7d5a" /></Field></div><input type="hidden" name="icon" value="landmark" /><Field label="ยอดตั้งต้น (บาท)" id="openingBalance"><Input id="openingBalance" name="openingBalance" inputMode="decimal" defaultValue="0.00" required /></Field><Field label="วันที่เริ่มต้น" id="openingBalanceDate"><Input id="openingBalanceDate" name="openingBalanceDate" type="date" defaultValue={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date())} required /></Field><Button className="w-full" type="submit">เพิ่มบัญชี</Button></form></CardContent></Card>
    </div><Card><CardHeader><CardTitle>ตรวจยอดกับธนาคาร</CardTitle><CardDescription>ระบบบันทึกยอดที่ตรวจและส่วนต่าง หากเลือกปรับยอดจะสร้าง transaction adjustment พร้อมเหตุผล ไม่แก้ balance โดยตรง</CardDescription></CardHeader><CardContent><form action={reconcileAccount} className="grid gap-3 md:grid-cols-4"><label><Label>บัญชี</Label><select name="accountId" className="mt-1.5 min-h-11 w-full rounded-xl border bg-background px-3">{data?.filter(item=>item.is_active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><Label>ยอดจากธนาคาร (บาท)</Label><Input name="statementBalance" inputMode="decimal" required /></label><label><Label>เหตุผล / หมายเหตุ</Label><Input name="note" required minLength={3} /></label><div className="flex items-end gap-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input name="createAdjustment" type="checkbox" />สร้าง adjustment</label><Button type="submit">บันทึก</Button></div></form></CardContent></Card></div>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>; }
