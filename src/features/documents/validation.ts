import { createHash, randomUUID } from "crypto";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 20;
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function signatureMatches(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (mime === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (mime === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  return false;
}

export async function inspectUpload(file: File) {
  if (!allowed.has(file.type)) throw new Error("รองรับเฉพาะ JPG, PNG, WebP และ PDF");
  if (file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!signatureMatches(bytes, file.type)) throw new Error("ชนิดไฟล์จริงไม่ตรงกับ MIME type");
  if (file.type === "application/pdf") {
    // ponytail: handles ordinary PDFs; replace with a sandboxed parser when compressed object streams must be accepted.
    const text = new TextDecoder("latin1").decode(bytes);
    const pages = text.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    if (pages < 1 || pages > MAX_PDF_PAGES) throw new Error(`PDF ต้องมี 1–${MAX_PDF_PAGES} หน้า`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[file.type]!;
  return { buffer, sha256, extension, storageId: randomUUID() };
}
