"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseBahtToSatangs } from "@/features/ledger/money";
import { requireUser } from "@/lib/supabase/server";

export async function createTransfer(formData: FormData) {
  const parsed=z.object({sourceAccountId:z.uuid(),destinationAccountId:z.uuid(),amount:z.string(),fee:z.string(),occurredAt:z.string().min(1),description:z.string().trim().min(1).max(160)}).safeParse(Object.fromEntries(formData));
  if(!parsed.success||parsed.data.sourceAccountId===parsed.data.destinationAccountId)redirect("/transactions/transfer?error="+encodeURIComponent("ข้อมูลการโอนไม่ถูกต้อง"));
  const {supabase}=await requireUser();const idempotency=randomUUID();const{data,error}=await supabase.rpc("create_transfer",{p_source_account_id:parsed.data.sourceAccountId,p_destination_account_id:parsed.data.destinationAccountId,p_amount_satangs:parseBahtToSatangs(parsed.data.amount).toString(),p_fee_satangs:parseBahtToSatangs(parsed.data.fee||"0").toString(),p_occurred_at:new Date(parsed.data.occurredAt).toISOString(),p_description:parsed.data.description,p_idempotency_key:idempotency,p_correlation_id:randomUUID()});
  if(error)redirect("/transactions/transfer?error="+encodeURIComponent(error.message));redirect(`/transactions/${data}`);
}
