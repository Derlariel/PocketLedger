import { requireUser } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const { data: document, error } = await supabase.from("documents").select("extracted_data").eq("id", id).eq("owner_id", userId).maybeSingle();
  if (error || !document) return Response.json({ documents: [], transactions: [] });
  const extracted = document.extracted_data && typeof document.extracted_data === "object" && !Array.isArray(document.extracted_data) ? document.extracted_data as Record<string, unknown> : {};
  const reference = typeof extracted.reference === "string" ? extracted.reference : null;
  const amount = typeof extracted.amountSatangs === "string" ? extracted.amountSatangs : null;
  const occurredAt = typeof extracted.occurredAt === "string" ? new Date(extracted.occurredAt) : null;
  const merchant = typeof extracted.merchant === "string" ? extracted.merchant : null;
  const documents = reference ? await supabase.from("documents").select("id,original_name,status").eq("owner_id", userId).neq("id", id).contains("extracted_data", { reference }).limit(5) : { data: [] };
  let transactionQuery = supabase.from("transactions").select("id,description,amount_satangs,occurred_at,status").eq("owner_id", userId).limit(5);
  if (amount) transactionQuery = transactionQuery.eq("amount_satangs", amount);
  if (occurredAt && !Number.isNaN(occurredAt.getTime())) transactionQuery = transactionQuery.gte("occurred_at", new Date(occurredAt.getTime() - 86_400_000).toISOString()).lte("occurred_at", new Date(occurredAt.getTime() + 86_400_000).toISOString());
  if (merchant) transactionQuery = transactionQuery.ilike("description", `%${merchant.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  const transactions = amount || occurredAt || merchant ? await transactionQuery : { data: [] };
  return Response.json({ documents: documents.data ?? [], transactions: transactions.data ?? [] }, { headers: { "cache-control": "private, no-store" } });
}
