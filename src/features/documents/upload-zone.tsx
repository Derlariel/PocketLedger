"use client";

import { Camera, FileUp, LoaderCircle, ScanLine, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Item = { file: File; state: "waiting" | "uploading" | "done" | "duplicate" | "failed"; id?: string; message?: string };

export function UploadZone({ ocrConfigured }: { ocrConfigured: boolean }) {
  const input = useRef<HTMLInputElement>(null); const camera = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]); const [dragging, setDragging] = useState(false);
  function add(files: FileList | null) { if (!files) return; const selected = Array.from(files).slice(0, 10); setItems((current) => [...current, ...selected.map((file) => ({ file, state: "waiting" as const }))]); void upload(selected); }
  async function upload(files: File[]) {
    for (const file of files) {
      setItems((current) => current.map((item) => item.file === file ? { ...item, state: "uploading" } : item));
      const body = new FormData(); body.append("file", file);
      try { const response = await fetch("/api/documents", { method: "POST", body }); const result = await response.json(); setItems((current) => current.map((item) => item.file === file ? { ...item, state: response.status === 409 ? "duplicate" : response.ok ? "done" : "failed", id: result.id, message: result.error } : item)); }
      catch { setItems((current) => current.map((item) => item.file === file ? { ...item, state: "failed", message: "การเชื่อมต่อขัดข้อง" } : item)); }
    }
  }
  return <div className="space-y-4"><div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); add(event.dataTransfer.files); }} className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-primary bg-accent" : "bg-secondary/25"}`}><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-primary"><FileUp aria-hidden="true" /></span><p className="mt-4 font-semibold">ลากใบเสร็จหรือสลิปมาวาง</p><p className="mt-1 text-sm text-muted-foreground">JPG, PNG, WebP หรือ PDF สูงสุด 10 MB / 20 หน้า · ไม่เกิน 10 ไฟล์ต่อครั้ง</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button type="button" onClick={() => input.current?.click()}>เลือกไฟล์</Button><Button type="button" variant="outline" onClick={() => camera.current?.click()}><Camera className="size-4" aria-hidden="true" />ถ่ายรูป</Button></div><input ref={input} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => add(event.target.files)} /><input ref={camera} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => add(event.target.files)} /></div>
    {!ocrConfigured && <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" /><div><p className="font-semibold">OCR ยังไม่ได้ตั้งค่า</p><p className="mt-1 text-muted-foreground">ไฟล์จะถูกเก็บจริงใน private storage และกรอกข้อมูลเองได้ ไม่มีผล OCR จำลอง</p></div></div>}
    {ocrConfigured && <div className="flex gap-3 rounded-xl border bg-secondary/40 p-4 text-sm"><ScanLine className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><p>เอกสารจะถูกส่งไปยังผู้ให้บริการ OCR ภายนอกที่ผู้ดูแลตั้งค่า ข้อมูลที่อ่านได้ยังต้องให้คุณตรวจและยืนยันก่อนกระทบยอด</p></div>}
    {items.length > 0 && <ul className="space-y-2">{items.map((item, index) => <li key={`${item.file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.file.name}</p><p className="text-xs text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(2)} MB · {statusLabel(item)}</p></div>{item.state === "uploading" ? <LoaderCircle className="size-5 animate-spin text-primary" aria-label="กำลังอัปโหลด" /> : item.id ? <a className="min-h-11 content-center px-2 text-sm font-semibold text-primary" href={`/documents/${item.id}/review`}>ตรวจข้อมูล</a> : null}</li>)}</ul>}
  </div>;
}
function statusLabel(item: Item) { return item.state === "waiting" ? "รออัปโหลด" : item.state === "uploading" ? "กำลังอัปโหลด" : item.state === "done" ? "เก็บไฟล์แล้ว" : item.state === "duplicate" ? "ไฟล์นี้เคยอัปโหลดแล้ว" : item.message ?? "ไม่สำเร็จ"; }
