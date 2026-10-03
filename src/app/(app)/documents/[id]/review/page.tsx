import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewForm } from "@/features/documents/review-form";
import { requireUser } from "@/lib/supabase/server";

export default async function ReviewDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, userId } = await requireUser();
  const [document, accounts, categories] = await Promise.all([
    supabase.from("documents").select("*").eq("id", id).eq("owner_id", userId).maybeSingle(),
    supabase.from("accounts").select("id,name").eq("owner_id", userId).eq("is_active", true).order("name"),
    supabase.from("categories").select("id,name").eq("owner_id", userId).order("name"),
  ]);
  if (document.error || accounts.error || categories.error) throw document.error ?? accounts.error ?? categories.error;
  if (!document.data) notFound();
  const signed = await supabase.storage.from("evidence").createSignedUrl(document.data.storage_key, 300);
  if (signed.error) throw signed.error;
  const extracted = document.data.extracted_data && typeof document.data.extracted_data === "object" && !Array.isArray(document.data.extracted_data) ? document.data.extracted_data as Record<string, unknown> : null;
  return <div className="space-y-5"><div><div className="flex items-center gap-2"><p className="text-sm text-muted-foreground">ตรวจหลักฐาน</p><Badge>{document.data.status}</Badge></div><h1 className="mt-1 truncate text-2xl font-bold">{document.data.original_name}</h1></div><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Card className="overflow-hidden"><CardHeader><CardTitle>ไฟล์ต้นฉบับ</CardTitle><CardDescription>ลิงก์นี้หมดอายุใน 5 นาทีและไม่ถูกบันทึกถาวร</CardDescription></CardHeader><CardContent>{document.data.mime_type === "application/pdf" ? <object data={signed.data.signedUrl} type="application/pdf" className="h-[70svh] w-full rounded-xl border"><a href={signed.data.signedUrl}>เปิด PDF</a></object> : <img src={signed.data.signedUrl} alt={`หลักฐาน ${document.data.original_name}`} className="max-h-[70svh] w-full rounded-xl border object-contain" />}</CardContent></Card><Card><CardHeader><CardTitle>ข้อมูลสำหรับบันทึก</CardTitle><CardDescription>{extracted ? "ข้อมูล OCR แยกจากค่าที่คุณแก้ไข" : "OCR ไม่มีผลลัพธ์ กรุณากรอกข้อมูลเอง"}</CardDescription></CardHeader><CardContent>{accounts.data?.length ? <ReviewForm documentId={id} accounts={accounts.data} categories={categories.data ?? []} extracted={extracted} /> : <p className="text-sm text-muted-foreground">กรุณาเพิ่มบัญชีก่อนยืนยันเอกสาร</p>}</CardContent></Card></div></div>;
}
