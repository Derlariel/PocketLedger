import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "../actions";

export default async function UpdatePasswordPage({searchParams}:{searchParams:Promise<{error?:string}>}){const{error}=await searchParams;return <main className="flex min-h-svh items-center justify-center p-5"><Card className="w-full max-w-md"><CardHeader><CardTitle>ตั้งรหัสผ่านใหม่</CardTitle><CardDescription>ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร</CardDescription></CardHeader><CardContent>{error&&<p className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<form action={updatePassword} className="space-y-4"><label className="block"><Label>รหัสผ่านใหม่</Label><Input className="mt-1.5" name="password" type="password" minLength={8} required autoComplete="new-password" /></label><Button className="w-full">บันทึกรหัสผ่าน</Button></form></CardContent></Card></main>}
