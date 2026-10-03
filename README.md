# PocketLedger

เว็บบันทึกรายรับรายจ่ายส่วนบุคคลแบบหลายผู้ใช้ ใช้ ledger ที่แก้ยอดโดยตรงไม่ได้, private evidence storage และ audit trail สำหรับเหตุการณ์สำคัญ

> ยอดทั้งหมดมาจากข้อมูลที่ผู้ใช้บันทึกเอง PocketLedger รุ่นนี้ **ไม่ได้เชื่อมต่อธนาคาร** และ OCR **ไม่ใช่การตรวจความแท้ของสลิป**

## Assumptions

- หนึ่งบัญชี Supabase Auth เป็นเจ้าของข้อมูลหนึ่งชุด ไม่มี shared household ใน MVP
- เงินใช้ THB เท่านั้น เก็บเป็น `BIGINT` หน่วยสตางค์; boundary ของ JavaScript รับ/ส่งเป็น decimal string และคำนวณด้วย `BigInt`
- timestamp เก็บ `timestamptz` (UTC) และแสดง/ตัดวันกับเดือนด้วย `Asia/Bangkok`
- รายการ `draft` ไม่สร้าง ledger entry; `posted` เท่านั้นที่กระทบยอด; `voided` เก็บอยู่และมี reversal เชื่อมกลับ
- OCR endpoint เป็น adapter contract ที่องค์กรเลือกเอง ค่าผู้ให้บริการและชื่อโมเดลมาจาก environment ทั้งหมด
- OCR worker ถูกเรียกโดย scheduler ที่เชื่อถือได้ (เช่น Supabase Cron/Edge Function หรือ deployment cron) ไม่ใช้ background promise ใน request อัปโหลด

## Architecture

Modular monolith บน Next.js App Router:

```text
Browser
  ├─ Server Components / Server Actions / Route Handlers
  ├─ Supabase Auth (cookie + PKCE via @supabase/ssr)
  └─ Supabase Data API (user JWT, RLS always on)
                   │
PostgreSQL ─ RPC transaction boundary ─ ledger_entries (source of truth)
  ├─ accounts / transactions / splits / budgets / reservations
  ├─ audit_logs (read-only to normal users)
  └─ RLS + composite ownership foreign keys
                   │
Private Storage evidence/<owner>/<document>/original.ext
                   │
Persistent extraction_jobs ─ scheduled worker ─ configured OCR provider
```

โมดูลอยู่ใน `src/features`: accounts, transactions, ledger, documents, OCR, budgets และ dashboard. กฎที่ต้อง atomic อยู่ใน SQL functions ไม่ได้กระจายอยู่ใน client:

- `create_transaction` สร้าง draft หรือ post พร้อม split
- `post_transaction` ตรวจ split และสร้าง ledger entry
- `create_transfer` ล็อกสองบัญชีและลงสอง ledger entries พร้อมค่าธรรมเนียมแยก
- `void_posted_transaction` สร้าง reversal ได้ครั้งเดียว
- `confirm_document_transaction` ผูกหลายหลักฐานกับรายการเดียวแบบ idempotent
- `consume_reservation` ปลดเงินกันไว้และลงรายจ่ายใน transaction เดียว
- `record_reconciliation` เก็บยอดที่ตรวจและสร้าง adjustment เมื่อผู้ใช้เลือก

## Schema

Migration สร้าง `profiles`, `accounts`, `categories`, `transactions`, `ledger_entries`, `transaction_splits`, `tags`, `transaction_tags`, `documents`, `transaction_documents`, `extraction_jobs`, `budgets`, `reservations`, `reconciliations`, `audit_logs` รวมถึง indexes, constraints, views, RLS และ private Storage policies

สูตร:

```text
balance = opening balance + sum(posted ledger entries)
available = balance - active reservations
budget remaining = budget - posted net expense (expense - refund)
```

การโอนไม่เข้ารายงานรายรับ/รายจ่ายรวม ค่าใช้จ่าย OCR ที่อ่านไม่ได้เป็น `null`; extracted payload และ corrected payload เก็บแยกกัน

## Setup with Bun

Prerequisites: Bun 1.4+, Supabase CLI/Docker สำหรับ local หรือ Supabase project จริง

```bash
cp .env.example .env.local
bun install
supabase start
supabase db reset
bun run db:types
bun run dev
```

นำ URL และ publishable key จาก `supabase status` ใส่ `.env.local`. Secret/service-role key ใช้เฉพาะ worker และ cleanup ฝั่ง server ห้ามใช้ชื่อ `NEXT_PUBLIC_*`

ถ้าใช้ hosted Supabase:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

ตั้ง Auth redirect URL เป็น `${APP_URL}/auth/callback`. Bucket `evidence` ถูกสร้าง private โดย migration

## OCR adapter and worker

หากไม่ตั้ง `OCR_PROVIDER`, `OCR_ENDPOINT`, `OCR_API_KEY`, `OCR_MODEL` ระบบยังเก็บไฟล์จริงและเปิด review form สำหรับกรอกเอง โดยแสดงว่า OCR ไม่พร้อมและไม่สร้างผล mock

เมื่อเปิด OCR endpoint ต้องรับ JSON contract `pocketledger-extraction-v1` และคืนค่า:

```json
{
  "occurredAt": null,
  "amountSatangs": "12500",
  "subtotalSatangs": null,
  "taxSatangs": null,
  "discountSatangs": null,
  "merchant": "ร้านค้า",
  "sender": null,
  "recipient": null,
  "bank": null,
  "reference": null,
  "suggestedCategory": null,
  "confidence": null
}
```

เรียก worker ครั้งละหนึ่ง job เพื่อให้ retry/lock อยู่ถาวร:

```bash
curl -X POST "$APP_URL/api/jobs/ocr" -H "Authorization: Bearer $CRON_SECRET"
```

provider response ถูกตรวจด้วย Zod; prompt กำหนดให้ข้อความในเอกสารเป็น untrusted data และ provider ไม่มีสิทธิ์เขียนฐานข้อมูลหรือยืนยันธุรกรรม

## Verification

```bash
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

E2E ใช้ disposable Supabase project และต้องตั้ง `E2E_EMAIL`, `E2E_PASSWORD`. Test จะ skip อย่างตรงไปตรงมาหากไม่มี credentials

จุดสำคัญที่ต้องทดสอบใน integration environment เพิ่มเติมก่อน production:

- concurrent idempotency requests และ row locks ของ transfer/reversal
- RLS ระหว่าง user A/B ทั้ง Data API และ signed Storage URL
- retry/failure ของ OCR provider จริง
- orphan cleanup cron สำหรับไฟล์ที่ upload สำเร็จแต่ insert ล้มเหลวเกิน retention window
- rate limiting ที่ deployment edge/WAF สำหรับ upload และ OCR worker

## Implemented vs roadmap

Implemented in this MVP source:

- Auth signup/sign-in/sign-out/password reset, RLS isolation
- accounts, exact balances, manual draft/posted transactions, transfer, fee, reversal, reconciliation/adjustment
- dashboard, transaction table with database pagination/filtering, safe CSV export
- private multi-file upload, file signature/hash/PDF-page validation, duplicate hash warning, manual review
- persistent OCR jobs with bounded retry and provider adapter
- budgets, reservations, monthly report and audit viewer
- responsive Thai UI, light/dark mode, keyboard focus and mobile capture

Roadmap (not claimed as implemented): recurring bills, savings goals, CSV import/mapping, PDF report, PWA, slip authenticity verification and bank API integration. Duplicate review checks exact file hash, provider reference and nearby amount/time/counterparty; it only warns and never deletes automatically.

## Security notes

- Every user-owned relation has RLS. Composite `(id, owner_id)` foreign keys prevent cross-owner references
- Ledger/audit/extraction jobs cannot be inserted, updated or deleted directly by authenticated users
- Evidence uses a private bucket; database stores only storage keys and the UI creates five-minute signed URLs
- MIME allowlist, magic-byte check, 10 MB size limit and a 20-page PDF limit run before storage
- CSV export prefixes cells that could execute spreadsheet formulas
- Application/audit logs exclude secrets, tokens, storage keys and complete OCR payloads
- Add deployment-level request body/rate limits and an orphan cleanup schedule before public launch

## Version choices

Pinned to stable releases verified from official documentation/registries on 2026-10-04: Next.js 16.3.5, React 19.2.8, Tailwind CSS 4.3.3, Supabase JS 2.117.2, Supabase SSR 0.12.7, TanStack Table 9.2.4, React Hook Form 7.88.0, Recharts 3.10.1 and Playwright 1.63.0. Bun's text `bun.lock` should be committed after the first successful `bun install`.
