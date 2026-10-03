"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({ email: z.email(), password: z.string().min(8) });

function authError(message: string) {
  redirect(`/auth/login?error=${encodeURIComponent(message)}`);
}

export async function signIn(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) authError("กรุณาตรวจสอบอีเมลและรหัสผ่านอย่างน้อย 8 ตัวอักษร");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) authError("เข้าสู่ระบบไม่สำเร็จ");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const parsed = credentials.extend({ displayName: z.string().trim().min(1).max(80) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) authError("ข้อมูลสมัครสมาชิกไม่ครบถ้วน");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { display_name: parsed.data.displayName } } });
  if (error) authError("สมัครสมาชิกไม่สำเร็จ อีเมลนี้อาจถูกใช้งานแล้ว");
  redirect("/auth/login?message=" + encodeURIComponent("สมัครสำเร็จ กรุณาตรวจอีเมลเพื่อยืนยันบัญชี"));
}

export async function requestPasswordReset(formData: FormData) {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) authError("อีเมลไม่ถูกต้อง");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/auth/callback?next=/auth/update-password` });
  redirect("/auth/login?message=" + encodeURIComponent("หากอีเมลนี้มีในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว"));
}

export async function updatePassword(formData: FormData) {
  const password = z.string().min(8).safeParse(formData.get("password"));
  if (!password.success) redirect("/auth/update-password?error=" + encodeURIComponent("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect("/auth/update-password?error=" + encodeURIComponent("ลิงก์อาจหมดอายุ กรุณาขอลิงก์ใหม่"));
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
