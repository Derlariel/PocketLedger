import { Database, ExternalLink, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl items-center px-5 py-12">
      <Card className="w-full overflow-hidden">
        <div className="h-2 bg-primary" />
        <CardHeader className="p-7 pb-2">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Database aria-hidden="true" /></div>
          <CardTitle className="text-2xl">เชื่อมต่อ Supabase เพื่อเริ่มใช้งาน</CardTitle>
          <CardDescription>หน้านี้ไม่แสดงข้อมูลจำลอง PocketLedger จะเริ่มทำงานเมื่อเชื่อมฐานข้อมูลจริงแล้ว</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-7">
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-6">
            <li>สร้าง Supabase project แล้วรัน migration ใน <code className="rounded bg-secondary px-1.5 py-0.5">supabase/migrations</code></li>
            <li>สร้าง private bucket ชื่อ <code className="rounded bg-secondary px-1.5 py-0.5">evidence</code> (migration จัด policy ให้)</li>
            <li>คัดลอก <code className="rounded bg-secondary px-1.5 py-0.5">.env.example</code> เป็น <code className="rounded bg-secondary px-1.5 py-0.5">.env.local</code> และใส่ URL กับ publishable key</li>
            <li>รีสตาร์ต <code className="rounded bg-secondary px-1.5 py-0.5">bun run dev</code></li>
          </ol>
          <div className="flex items-start gap-3 rounded-xl border bg-secondary/50 p-4 text-sm"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><p>อย่าใส่ secret key ในตัวแปร <code>NEXT_PUBLIC_*</code> และอย่า commit ไฟล์ <code>.env.local</code></p></div>
          <a className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline" href="https://supabase.com/docs/guides/getting-started/quickstarts/nextjs" target="_blank" rel="noreferrer">เอกสาร Supabase สำหรับ Next.js <ExternalLink className="size-4" aria-hidden="true" /></a>
        </CardContent>
      </Card>
    </main>
  );
}
