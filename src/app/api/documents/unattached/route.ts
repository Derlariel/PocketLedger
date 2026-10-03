import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { supabase, userId } = await requireUser();
  const exclude = new URL(request.url).searchParams.get("exclude");
  let query = supabase.from("documents").select("id,original_name,created_at,transaction_documents!left(transaction_id)").eq("owner_id", userId).in("status", ["needs_review", "failed"]).order("created_at", { ascending: false }).limit(20);
  if (exclude) query = query.neq("id", exclude);
  const { data, error } = await query;
  if (error) return Response.json({ documents: [] });
  return Response.json({ documents: (data ?? []).filter((item) => item.transaction_documents.length === 0) }, { headers: { "cache-control": "private, no-store" } });
}
