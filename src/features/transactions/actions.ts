"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";

export async function voidTransaction(formData: FormData) {
  const parsed = z.object({ id: z.uuid(), reason: z.string().trim().min(3).max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("กรุณาระบุเหตุผล");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("void_posted_transaction", { p_transaction_id: parsed.data.id, p_reason: parsed.data.reason, p_idempotency_key: randomUUID(), p_correlation_id: randomUUID() });
  if (error) throw error;
  revalidatePath("/transactions"); revalidatePath("/dashboard");
  redirect(`/transactions/${parsed.data.id}`);
}
