import Link from "next/link";
import { FileText, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "เอกสาร" };
const statuses: Record<string, string> = { uploaded: "อัปโหลดแล้ว", queued: "รอ OCR", processing: "กำลังอ่าน", needs_review: "ต้องตรวจสอบ", failed: "OCR ล้มเหลว", attached: "ผูกธุรกรรมแล้ว" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string; unattached?: string }> }) {
  const params = await searchParams;
  const { supabase, userId } = await requireUser();
  let query = supabase.from("documents").select("id,original_name,mime_type,byte_size,status,created_at,transaction_documents(transaction_id)").eq("owner_id", userId).order("created_at", { ascending: false }).limit(100);
  if (params.q) query = query.ilike("original_name", `%${params.q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  const { data, error } = await query;
  if (error) throw error;
  const documents = (data ?? []).filter((document) => params.unattached !== "1" || document.transaction_documents.length === 0);
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">ไฟล์อยู่ใน private bucket และเปิดด้วย signed URL อายุสั้น</p><h1 className="mt-1 text-2xl font-bold">เอกสาร</h1></div><Link href="/upload"><Button><Upload className="size-4" aria-hidden="true" />อัปโหลด</Button></Link></div>
    <form className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4"><label className="relative min-w-60 flex-1"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" /><Input className="pl-9" name="q" defaultValue={params.q} placeholder="ค้นหาชื่อไฟล์" /></label><label className="flex min-h-11 items-center gap-2 px-2 text-sm"><input type="checkbox" name="unattached" value="1" defaultChecked={params.unattached === "1"} />ยังไม่ผูกธุรกรรม</label><Button type="submit">ค้นหา</Button></form>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{documents.length ? documents.map((document) => <Link key={document.id} href={`/documents/${document.id}/review`}><Card className="h-full transition-colors hover:border-primary/50"><CardContent className="flex gap-4 p-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><FileText aria-hidden="true" /></span><div className="min-w-0"><p className="truncate font-medium">{document.original_name}</p><div className="mt-2 flex flex-wrap gap-2"><Badge>{statuses[document.status] ?? document.status}</Badge><span className="text-xs text-muted-foreground">{(document.byte_size / 1024 / 1024).toFixed(2)} MB</span></div></div></CardContent></Card></Link>) : <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">ไม่พบเอกสาร</div>}</div>
  </div>;
}
