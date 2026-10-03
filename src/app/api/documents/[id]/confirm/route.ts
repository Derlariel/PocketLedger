import { randomUUID } from "crypto";
import { z } from "zod";
import { parseBahtToSatangs } from "@/features/ledger/money";
import { requireUser } from "@/lib/supabase/server";

const schema = z.object({ accountId: z.uuid(), direction: z.enum(["income", "expense"]), amount: z.string(), occurredAt: z.string().min(1), description: z.string().trim().min(1).max(160), categoryId: z.uuid().or(z.literal("")), documentIds: z.array(z.uuid()).max(9).default([]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const input = schema.parse(await request.json()); const amount = parseBahtToSatangs(input.amount);
    const { supabase } = await requireUser();
    const documentIds = [...new Set([id, ...input.documentIds])];
    const { data, error } = await supabase.rpc("confirm_document_transaction", { p_document_ids: documentIds, p_account_id: input.accountId, p_type: input.direction, p_amount_satangs: amount.toString(), p_occurred_at: new Date(input.occurredAt).toISOString(), p_description: input.description, p_category_id: input.categoryId || null, p_corrected_data: input, p_idempotency_key: request.headers.get("x-idempotency-key") ?? randomUUID(), p_correlation_id: randomUUID() });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ id: data }, { status: 201 });
  } catch { return Response.json({ error: "ข้อมูลยืนยันไม่ถูกต้อง" }, { status: 400 }); }
}
