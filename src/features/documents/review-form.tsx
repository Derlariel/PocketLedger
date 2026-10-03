"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = { id: string; name: string };
type Values = { accountId: string; direction: "income" | "expense"; amount: string; occurredAt: string; description: string; categoryId: string; documentIds: string[] };

export function ReviewForm({ documentId, accounts, categories, extracted }: { documentId: string; accounts: Option[]; categories: Option[]; extracted: Record<string, unknown> | null }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [duplicates, setDuplicates] = useState(0);
  const [otherDocuments, setOtherDocuments] = useState<Option[]>([]);
  useEffect(() => { fetch(`/api/documents/${documentId}/duplicates`).then((response) => response.json()).then((result) => setDuplicates((result.documents?.length ?? 0) + (result.transactions?.length ?? 0))).catch(() => undefined); }, [documentId]);
  useEffect(() => { fetch(`/api/documents/unattached?exclude=${documentId}`).then((response) => response.json()).then((result) => setOtherDocuments((result.documents ?? []).map((item: { id: string; original_name: string }) => ({ id: item.id, name: item.original_name })))).catch(() => undefined); }, [documentId]);
  const amount = typeof extracted?.amountSatangs === "string" ? `${BigInt(extracted.amountSatangs) / 100n}.${(BigInt(extracted.amountSatangs) % 100n).toString().padStart(2, "0")}` : "";
  const form = useForm<Values>({ defaultValues: { accountId: accounts[0]?.id ?? "", direction: "expense", amount, occurredAt: typeof extracted?.occurredAt === "string" ? extracted.occurredAt.slice(0, 16) : "", description: typeof extracted?.merchant === "string" ? extracted.merchant : "", categoryId: "", documentIds: [] } });
  async function submit(values: Values) {
    setError(undefined);
    const response = await fetch(`/api/documents/${documentId}/confirm`, { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": crypto.randomUUID() }, body: JSON.stringify(values) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "ยืนยันไม่สำเร็จ"); return; }
    router.push(`/transactions/${result.id}`); router.refresh();
  }
  return <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
    {error && <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    {duplicates > 0 && <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><p className="font-semibold">พบ {duplicates} รายการที่อาจซ้ำ</p><p className="mt-1 text-muted-foreground">ตรวจเลขอ้างอิง หรือยอด/เวลา/คู่รายการที่ใกล้เคียงก่อนยืนยัน ระบบจะไม่ลบให้อัตโนมัติ</p></div>}
    <div className="rounded-xl border bg-secondary/40 p-3 text-sm"><p className="font-medium">เลือกทิศทางเงินด้วยตนเอง</p><p className="mt-1 text-muted-foreground">ระบบจะไม่เดาว่าสลิปนี้เป็นเงินเข้าหรือเงินออก</p></div>
    <div className="grid grid-cols-2 gap-3"><Field label="ทิศทาง"><select {...form.register("direction")} className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="expense">เงินออก</option><option value="income">เงินเข้า</option></select></Field><Field label="บัญชี"><select {...form.register("accountId", { required: true })} className="min-h-11 w-full rounded-xl border bg-background px-3">{accounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field></div>
    <Field label="จำนวนเงิน (บาท)"><Input {...form.register("amount", { required: true })} inputMode="decimal" /></Field>
    <Field label="วันที่และเวลา"><Input {...form.register("occurredAt", { required: true })} type="datetime-local" /></Field>
    <Field label="ร้านค้า / คู่รายการ"><Input {...form.register("description", { required: true })} /></Field>
    <Field label="หมวดหมู่"><select {...form.register("categoryId")} className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="">ไม่ระบุ</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
    {otherDocuments.length > 0 && <fieldset className="rounded-xl border p-3"><legend className="px-1 text-sm font-medium">หลักฐานอื่นของการซื้อครั้งเดียวกัน</legend><div className="mt-1 space-y-1">{otherDocuments.map((item) => <label key={item.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" value={item.id} {...form.register("documentIds")} /><span className="truncate">{item.name}</span></label>)}</div><p className="mt-2 text-xs text-muted-foreground">ไฟล์ที่เลือกจะผูกกับธุรกรรมเดียวและไม่ถูกนับซ้ำ</p></fieldset>}
    <div className="rounded-xl border border-primary/30 bg-accent p-4 text-sm"><p className="font-semibold">ตรวจสอบก่อนยืนยัน</p><p className="mt-1 text-muted-foreground">เมื่อกดยืนยัน รายการจะเป็น Posted และกระทบยอดบัญชีทันที เอกสารนี้จะผูกกับรายการเพื่อป้องกันการนับซ้ำ</p></div>
    <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "กำลังยืนยัน…" : "ยืนยันและบันทึกรายการ"}</Button>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="block text-sm font-medium">{label}</span>{children}</label>; }
