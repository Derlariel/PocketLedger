import { requireUser } from "@/lib/supabase/server";
import { ExportDialog, type InitialExportFilters } from "@/features/exports/export-dialog";

export async function ExportButton({ initial }: { initial?: InitialExportFilters }) {
  const { supabase, userId } = await requireUser();
  const [accounts, categories, tags] = await Promise.all([
    supabase.from("accounts").select("id,name,currency").eq("owner_id", userId).order("name"),
    supabase.from("categories").select("id,name").eq("owner_id", userId).order("name"),
    supabase.from("tags").select("id,name").eq("owner_id", userId).order("name"),
  ]);
  const error = accounts.error ?? categories.error ?? tags.error;
  if (error) return null;
  return <ExportDialog accounts={accounts.data ?? []} categories={categories.data ?? []} tags={tags.data ?? []} initial={initial} />;
}
