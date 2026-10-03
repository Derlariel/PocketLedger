import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "@/features/transactions/transaction-form";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "บันทึกรายการ" };

export default async function NewTransactionPage() {
  const { supabase, userId } = await requireUser();
  const [accounts, categories] = await Promise.all([
    supabase.from("accounts").select("id,name").eq("owner_id", userId).eq("is_active", true).order("name"),
    supabase.from("categories").select("id,name").eq("owner_id", userId).order("name"),
  ]);
  if (accounts.error || categories.error) throw accounts.error ?? categories.error;
  return <div className="mx-auto max-w-2xl"><div className="mb-6"><p className="text-sm text-muted-foreground">บันทึกด้วยตนเอง</p><h1 className="mt-1 text-2xl font-bold">รายการใหม่</h1></div>{accounts.data?.length ? <Card><CardHeader><CardTitle>รายละเอียดรายการ</CardTitle><CardDescription>จำนวนเงินคำนวณเป็นสตางค์แบบ integer เสมอ</CardDescription></CardHeader><CardContent><TransactionForm accounts={accounts.data} categories={categories.data ?? []} /></CardContent></Card> : <Card><CardContent className="p-8 text-center"><p className="font-medium">ต้องมีบัญชีก่อนบันทึกรายการ</p><a href="/accounts" className="mt-3 inline-block text-primary hover:underline">ไปเพิ่มบัญชี</a></CardContent></Card>}</div>;
}
