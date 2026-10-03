"use client";

import Link from "next/link";
import { tableFeatures, useTable, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatSatangs } from "@/features/ledger/money";

export type TransactionRow = { id: string; occurred_at: string; type: string; description: string; amount_satangs: string; status: string; source: string; accounts: { name: string } | { name: string }[] | null; transaction_splits: { categories: { name: string } | { name: string }[] | null }[]; transaction_documents: { document_id: string }[] };

const labels: Record<string, string> = { income: "รายรับ", expense: "รายจ่าย", transfer: "โอนเงิน", refund: "คืนเงิน", adjustment: "ปรับยอด", reversal: "กลับรายการ", draft: "ฉบับร่าง", posted: "ยืนยันแล้ว", voided: "ยกเลิก", manual: "บันทึกเอง", ocr: "OCR", import: "นำเข้า" };

const features = tableFeatures({});
const columns: ColumnDef<typeof features, TransactionRow>[] = [
  { accessorKey: "occurred_at", header: "วันเวลา", cell: ({ row }) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date(row.original.occurred_at)) },
  { accessorKey: "type", header: "ประเภท", cell: ({ row }) => labels[row.original.type] ?? row.original.type },
  { accessorKey: "description", header: "รายละเอียด", cell: ({ row }) => <Link href={`/transactions/${row.original.id}`} className="font-medium hover:text-primary hover:underline">{row.original.description}</Link> },
  { id: "category", header: "หมวดหมู่", cell: ({ row }) => row.original.transaction_splits.map((split) => Array.isArray(split.categories) ? split.categories[0]?.name : split.categories?.name).filter(Boolean).join(", ") || "—" },
  { id: "account", header: "บัญชี", cell: ({ row }) => Array.isArray(row.original.accounts) ? row.original.accounts[0]?.name : row.original.accounts?.name ?? "—" },
  { id: "in", header: "เงินเข้า", cell: ({ row }) => ["income", "refund"].includes(row.original.type) ? <span className="font-semibold text-primary">{formatSatangs(row.original.amount_satangs)}</span> : "—" },
  { id: "out", header: "เงินออก", cell: ({ row }) => ["expense", "adjustment"].includes(row.original.type) ? <span className="font-semibold">{formatSatangs(row.original.amount_satangs)}</span> : "—" },
  { accessorKey: "status", header: "สถานะ", cell: ({ row }) => <Badge>{labels[row.original.status] ?? row.original.status}</Badge> },
  { id: "evidence", header: "หลักฐาน", cell: ({ row }) => row.original.transaction_documents.length ? `${row.original.transaction_documents.length} ไฟล์` : "—" },
  { accessorKey: "source", header: "แหล่งที่มา", cell: ({ row }) => labels[row.original.source] ?? row.original.source },
];

export function TransactionTable({ data }: { data: TransactionRow[] }) {
  const table = useTable({ features, data, columns });
  return <div className="overflow-x-auto rounded-2xl border bg-card"><table className="w-full min-w-[1100px] text-sm"><thead className="border-b bg-secondary/60 text-left text-xs text-muted-foreground">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="h-12 px-4 font-medium">{header.isPlaceholder ? null : <table.FlexRender header={header} />}</th>)}</tr>)}</thead><tbody className="divide-y">{table.getRowModel().rows.map((row) => <tr key={row.id} className="hover:bg-secondary/30">{row.getAllCells().map((cell) => <td key={cell.id} className="px-4 py-3.5"><table.FlexRender cell={cell} /></td>)}</tr>)}</tbody></table>{data.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">ไม่พบรายการตามตัวกรอง</div>}</div>;
}
