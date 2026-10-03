import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { parseBahtToSatangs } from "@/features/ledger/money";
import { transactionInput } from "@/features/transactions/schema";
import { requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const input = transactionInput.parse(await request.json());
    const amount = parseBahtToSatangs(input.amount);
    if (amount <= 0n) return NextResponse.json({ error: "จำนวนเงินต้องมากกว่า 0" }, { status: 400 });
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("create_transaction", {
      p_account_id: input.accountId,
      p_type: input.type,
      p_amount_satangs: amount.toString(),
      p_occurred_at: new Date(input.occurredAt).toISOString(),
      p_description: input.description,
      p_note: input.note || null,
      p_category_id: input.categoryId || null,
      p_payment_method: input.paymentMethod || null,
      p_status: input.status,
      p_source: "manual",
      p_idempotency_key: input.idempotencyKey,
      p_correlation_id: request.headers.get("x-request-id") ?? randomUUID(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === "23505" ? 409 : 400 });
    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "ข้อมูลรายการไม่ถูกต้อง" }, { status: 400 });
  }
}
