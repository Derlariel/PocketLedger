import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "../actions";

export default function ResetPasswordPage(){return <main className="flex min-h-svh items-center justify-center p-5"><Card className="w-full max-w-md"><CardHeader><CardTitle>รีเซ็ตรหัสผ่าน</CardTitle><CardDescription>เราจะส่งลิงก์ไปยังอีเมล โดยไม่เปิดเผยว่ามีบัญชีนี้หรือไม่</CardDescription></CardHeader><CardContent><form action={requestPasswordReset} className="space-y-4"><label className="block"><Label>อีเมล</Label><Input className="mt-1.5" name="email" type="email" required autoComplete="email" /></label><Button className="w-full">ส่งลิงก์รีเซ็ต</Button></form></CardContent></Card></main>}
