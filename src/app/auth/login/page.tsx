import { Landmark, LockKeyhole } from "lucide-react";
import { signIn, signUp } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; mode?: string }> }) {
  const params = await searchParams;
  const register = params.mode === "register";
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.05fr_.95fr]">
      <section className="hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-xl font-bold"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Landmark aria-hidden="true" /></span>PocketLedger</div>
        <div className="max-w-lg"><p className="text-4xl font-semibold leading-tight">รู้ว่าเงินอยู่ที่ไหน<br />และเปลี่ยนแปลงอย่างไร</p><p className="mt-5 max-w-md text-background/65">ทุกยอดมาจากรายการที่คุณบันทึก ไม่ได้เชื่อมธนาคาร และทุกรายการสำคัญตรวจสอบย้อนหลังได้</p></div>
        <p className="text-sm text-background/50">ข้อมูลแต่ละผู้ใช้แยกด้วย PostgreSQL RLS</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="p-6 pb-3">
            <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground lg:hidden"><LockKeyhole aria-hidden="true" /></div>
            <CardTitle className="text-2xl">{register ? "สร้างบัญชี PocketLedger" : "ยินดีต้อนรับกลับมา"}</CardTitle>
            <CardDescription>{register ? "ข้อมูลของคุณจะแยกจากผู้ใช้อื่นโดยสมบูรณ์" : "เข้าสู่ระบบเพื่อดูบัญชีส่วนตัวของคุณ"}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-3">
            {(params.error || params.message) && <div role="status" className={`mb-4 rounded-xl border p-3 text-sm ${params.error ? "border-destructive/30 bg-destructive/10" : "border-primary/30 bg-accent"}`}>{params.error ?? params.message}</div>}
            <form action={register ? signUp : signIn} className="space-y-4">
              {register && <div className="space-y-1.5"><Label htmlFor="displayName">ชื่อที่แสดง</Label><Input id="displayName" name="displayName" autoComplete="name" required /></div>}
              <div className="space-y-1.5"><Label htmlFor="email">อีเมล</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
              <div className="space-y-1.5"><Label htmlFor="password">รหัสผ่าน</Label><Input id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={8} required /></div>
              <Button className="w-full" type="submit">{register ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}</Button>
            </form>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
              <a className="font-medium text-primary hover:underline" href={register ? "/auth/login" : "/auth/login?mode=register"}>{register ? "มีบัญชีแล้ว" : "สร้างบัญชีใหม่"}</a>
              {!register && <a className="inline-flex min-h-11 items-center px-2 text-muted-foreground hover:text-foreground" href="/auth/reset-password">ลืมรหัสผ่าน</a>}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
