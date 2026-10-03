"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { transactionInput } from "./schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Values = z.infer<typeof transactionInput>;
type Option = { id: string; name: string };

export function TransactionForm({ accounts, categories }: { accounts: Option[]; categories: Option[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const form = useForm<Values>({ resolver: zodResolver(transactionInput), defaultValues: { accountId: accounts[0]?.id, type: "expense", amount: "", occurredAt: toLocalInput(new Date()), description: "", note: "", paymentMethod: "transfer", status: "posted", idempotencyKey: crypto.randomUUID() } });
  async function submit(values: Values) {
    setServerError(undefined);
    const response = await fetch("/api/transactions", { method: "POST", headers: { "content-type": "application/json", "x-request-id": crypto.randomUUID() }, body: JSON.stringify(values) });
    const result = await response.json();
    if (!response.ok) { setServerError(result.error ?? "บันทึกไม่สำเร็จ"); return; }
    router.push(`/transactions/${result.id}`); router.refresh();
  }
  return <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
    {serverError && <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{serverError}</div>}
    <div className="grid gap-4 sm:grid-cols-2"><Field label="ประเภท" error={form.formState.errors.type?.message}><select {...form.register("type")} className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="expense">รายจ่าย</option><option value="income">รายรับ</option><option value="refund">คืนเงิน</option><option value="adjustment">ปรับยอด</option></select></Field><Field label="บัญชี" error={form.formState.errors.accountId?.message}><select {...form.register("accountId")} className="min-h-11 w-full rounded-xl border bg-background px-3">{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>
    <Field label="จำนวนเงิน (บาท)" error={form.formState.errors.amount?.message}><Input {...form.register("amount")} inputMode="decimal" placeholder="0.00" /></Field>
    <Field label="วันที่และเวลา" error={form.formState.errors.occurredAt?.message}><Input {...form.register("occurredAt")} type="datetime-local" /></Field>
    <Field label="รายละเอียด / ร้านค้า" error={form.formState.errors.description?.message}><Input {...form.register("description")} /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="หมวดหมู่"><select {...form.register("categoryId", { setValueAs: (value) => value || null })} className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="">ไม่ระบุ</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="ช่องทาง"><select {...form.register("paymentMethod")} className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="transfer">โอนเงิน</option><option value="cash">เงินสด</option><option value="ewallet">e-Wallet</option><option value="other">อื่น ๆ</option></select></Field></div>
    <Field label="หมายเหตุ"><textarea {...form.register("note")} rows={3} className="w-full rounded-xl border bg-background p-3" /></Field>
    <div className="rounded-xl border bg-secondary/40 p-4"><p className="text-sm font-medium">ผลกระทบก่อนยืนยัน</p><p className="mt-1 text-sm text-muted-foreground">รายการ Posted จะเพิ่มหรือลดยอดบัญชีที่เลือกทันที ส่วน Draft ยังไม่กระทบยอด</p></div>
    <div className="grid grid-cols-2 gap-3"><Button type="submit" variant="outline" disabled={form.formState.isSubmitting} onClick={() => form.setValue("status", "draft")}>บันทึกฉบับร่าง</Button><Button type="submit" disabled={form.formState.isSubmitting} onClick={() => form.setValue("status", "posted")}>{form.formState.isSubmitting ? "กำลังบันทึก…" : "ยืนยันรายการ"}</Button></div>
  </form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="block text-sm font-medium">{label}</span>{children}{error && <span className="block text-xs text-destructive">{error}</span>}</label>; }
function toLocalInput(date: Date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16); }
