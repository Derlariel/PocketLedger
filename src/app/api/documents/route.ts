import { NextResponse } from "next/server";
import { inspectUpload } from "@/features/documents/validation";
import { requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const uploadLimit = Math.min(200, Math.max(1, Number(process.env.UPLOADS_PER_HOUR) || 50));
    const recentUploads = await supabase.from("documents").select("id", { count: "exact", head: true }).eq("owner_id", userId).gte("created_at", since);
    if ((recentUploads.count ?? 0) >= uploadLimit) return NextResponse.json({ error: "อัปโหลดเกินโควตารายชั่วโมง กรุณาลองใหม่ภายหลัง" }, { status: 429 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
    const inspected = await inspectUpload(file);
    const existing = await supabase.from("documents").select("id,status").eq("owner_id", userId).eq("sha256", inspected.sha256).maybeSingle();
    if (existing.data) return NextResponse.json({ id: existing.data.id, duplicate: true, status: existing.data.status }, { status: 409 });
    const storageKey = `${userId}/${inspected.storageId}/original.${inspected.extension}`;
    const uploaded = await supabase.storage.from("evidence").upload(storageKey, inspected.buffer, { contentType: file.type, upsert: false, cacheControl: "3600" });
    if (uploaded.error) return NextResponse.json({ error: "อัปโหลดไฟล์ไม่สำเร็จ" }, { status: 500 });
    const ocrConfigured = Boolean(process.env.OCR_PROVIDER && process.env.OCR_ENDPOINT && process.env.OCR_API_KEY && process.env.OCR_MODEL);
    if (ocrConfigured) {
      const ocrLimit = Math.min(100, Math.max(1, Number(process.env.OCR_JOBS_PER_HOUR) || 30));
      const recentJobs = await supabase.from("extraction_jobs").select("id", { count: "exact", head: true }).eq("owner_id", userId).gte("created_at", since);
      if ((recentJobs.count ?? 0) >= ocrLimit) {
        await supabase.storage.from("evidence").remove([storageKey]);
        return NextResponse.json({ error: "OCR เกินโควตารายชั่วโมง กรุณาลองใหม่ภายหลัง" }, { status: 429 });
      }
    }
    const inserted = await supabase.from("documents").insert({ owner_id: userId, storage_key: storageKey, original_name: file.name.slice(0, 255), mime_type: file.type, byte_size: file.size, sha256: inspected.sha256, status: ocrConfigured ? "queued" : "needs_review" }).select("id").single();
    if (inserted.error) {
      await supabase.storage.from("evidence").remove([storageKey]);
      return NextResponse.json({ error: "บันทึกเอกสารไม่สำเร็จ" }, { status: 500 });
    }
    if (ocrConfigured) {
      const job = await supabase.rpc("enqueue_extraction_job", { p_document_id: inserted.data.id, p_max_attempts: Math.min(5, Math.max(1, Number(process.env.OCR_MAX_RETRIES) || 3)) });
      if (job.error) await supabase.from("documents").update({ status: "needs_review" }).eq("id", inserted.data.id).eq("owner_id", userId);
    }
    return NextResponse.json({ id: inserted.data.id, duplicate: false, status: ocrConfigured ? "queued" : "needs_review", ocrConfigured }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Unauthorized" : message }, { status: message === "UNAUTHORIZED" ? 401 : 400 });
  }
}
