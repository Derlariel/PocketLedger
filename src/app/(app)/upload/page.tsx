import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadZone } from "@/features/documents/upload-zone";

export const metadata = { title: "อัปโหลดและตรวจ" };
export default function UploadPage() {
  const configured = Boolean(process.env.OCR_PROVIDER && process.env.OCR_ENDPOINT && process.env.OCR_API_KEY && process.env.OCR_MODEL);
  return <div className="mx-auto max-w-3xl space-y-6"><div><p className="text-sm text-muted-foreground">อัปโหลด → เก็บต้นฉบับ → OCR → ตรวจแก้ → ยืนยัน</p><h1 className="mt-1 text-2xl font-bold">อัปโหลดและตรวจหลักฐาน</h1></div><Card><CardHeader><CardTitle>เพิ่มใบเสร็จหรือสลิป</CardTitle><CardDescription>การอ่านสลิปไม่ใช่การตรวจสอบความแท้ และระบบจะไม่เดาทิศทางเงินให้</CardDescription></CardHeader><CardContent><UploadZone ocrConfigured={configured} /></CardContent></Card></div>;
}
