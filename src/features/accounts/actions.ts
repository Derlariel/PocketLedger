"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { z } from "zod";
import { parseSignedBahtToSatangs } from "@/features/ledger/money";
import { requireUser } from "@/lib/supabase/server";

const accountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["bank", "cash", "ewallet"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.enum(["landmark", "banknote", "wallet"]),
  openingBalance: z.string(),
  openingBalanceDate: z.iso.date(),
});

export async function createAccount(formData: FormData) {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/accounts?error=" + encodeURIComponent("ข้อมูลบัญชีไม่ถูกต้อง"));
  let satangs: bigint;
  try { satangs = parseSignedBahtToSatangs(parsed.data.openingBalance); } catch { redirect("/accounts?error=" + encodeURIComponent("ยอดตั้งต้นไม่ถูกต้อง")); }
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("accounts").insert({
    owner_id: userId,
    name: parsed.data.name,
    type: parsed.data.type,
    color: parsed.data.color,
    icon: parsed.data.icon,
    opening_balance_satangs: satangs.toString(),
    opening_balance_date: parsed.data.openingBalanceDate,
  });
  if (error) redirect("/accounts?error=" + encodeURIComponent("บันทึกบัญชีไม่สำเร็จ"));
  revalidatePath("/accounts"); revalidatePath("/dashboard");
  redirect("/accounts?message=" + encodeURIComponent("เพิ่มบัญชีแล้ว"));
}

export async function archiveAccount(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", id).eq("owner_id", userId);
  if (error) throw error;
  revalidatePath("/accounts");
}

export async function reconcileAccount(formData: FormData) {
  const parsed = z.object({ accountId: z.uuid(), statementBalance: z.string(), note: z.string().trim().min(3).max(1000), createAdjustment: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/accounts?error=" + encodeURIComponent("ข้อมูลตรวจยอดไม่ถูกต้อง"));
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("record_reconciliation", { p_account_id: parsed.data.accountId, p_statement_balance_satangs: parseSignedBahtToSatangs(parsed.data.statementBalance).toString(), p_reconciled_at: new Date().toISOString(), p_note: parsed.data.note, p_create_adjustment: parsed.data.createAdjustment === "on", p_idempotency_key: randomUUID(), p_correlation_id: randomUUID() });
  if (error) redirect("/accounts?error=" + encodeURIComponent(error.message));
  revalidatePath("/accounts"); revalidatePath("/dashboard"); redirect("/accounts?message=" + encodeURIComponent("บันทึกการตรวจยอดแล้ว"));
}
