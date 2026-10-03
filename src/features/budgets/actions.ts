"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseBahtToSatangs } from "@/features/ledger/money";
import { requireUser } from "@/lib/supabase/server";

export async function createBudget(formData: FormData) {
  const parsed = z.object({ amount: z.string(), categoryId: z.string(), month: z.string().regex(/^\d{4}-\d{2}$/) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/budgets?error=" + encodeURIComponent("ข้อมูลงบไม่ถูกต้อง"));
  const amount = parseBahtToSatangs(parsed.data.amount); const [year, month] = parsed.data.month.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`; const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const { supabase, userId } = await requireUser(); const { error } = await supabase.from("budgets").insert({ owner_id: userId, category_id: parsed.data.categoryId || null, period_start: start, period_end: end, amount_satangs: amount.toString() });
  if (error) redirect("/budgets?error=" + encodeURIComponent("มีงบช่วงนี้อยู่แล้วหรือข้อมูลไม่ถูกต้อง")); revalidatePath("/budgets"); redirect("/budgets");
}

export async function createReservation(formData: FormData) {
  const parsed = z.object({ accountId: z.uuid(), purpose: z.string().trim().min(1).max(160), amount: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/budgets?error=" + encodeURIComponent("ข้อมูลเงินกันไว้ไม่ถูกต้อง"));
  const { supabase, userId } = await requireUser(); const { error } = await supabase.from("reservations").insert({ owner_id: userId, account_id: parsed.data.accountId, purpose: parsed.data.purpose, amount_satangs: parseBahtToSatangs(parsed.data.amount).toString(), status: "active" });
  if (error) redirect("/budgets?error=" + encodeURIComponent("กันเงินไม่สำเร็จ")); revalidatePath("/budgets"); revalidatePath("/dashboard"); redirect("/budgets");
}
