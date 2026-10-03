"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center"><h1 className="text-xl font-bold">โหลดข้อมูลไม่สำเร็จ</h1><p className="mt-2 text-sm text-muted-foreground">กรุณาตรวจสอบการเชื่อมต่อ Supabase แล้วลองอีกครั้ง</p><Button className="mt-5" onClick={reset}>ลองใหม่</Button></div>; }
