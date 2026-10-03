import { requireUser } from "@/lib/supabase/server";

function safeCell(value: unknown) {
  const text = String(value ?? "");
  const protectedText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const { supabase, userId } = await requireUser();
  const url = new URL(request.url);
  let query = supabase.from("transactions").select("occurred_at,type,description,amount_satangs,status,source").eq("owner_id", userId).order("occurred_at", { ascending: false }).limit(10_000);
  const status = url.searchParams.get("status"); const type = url.searchParams.get("type");
  if (status) query = query.eq("status", status); if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) return Response.json({ error: "Export failed" }, { status: 500 });
  const rows = [["occurred_at", "type", "description", "amount_satangs", "status", "source"], ...(data ?? []).map((row) => [row.occurred_at, row.type, row.description, row.amount_satangs, row.status, row.source])];
  const csv = "\uFEFF" + rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="pocketledger-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "private, no-store" } });
}
