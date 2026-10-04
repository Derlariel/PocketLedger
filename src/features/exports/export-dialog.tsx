"use client";

import { Download, Eye, FileDown, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { id: string; name: string };
export type InitialExportFilters = { accountId?: string; query?: string; type?: string; status?: string; from?: string; to?: string };
type Preview = { count: number; tooLarge: boolean; accounts: string[]; period: string };

export function ExportDialog({ accounts, categories, tags, initial = {} }: { accounts: (Option & { currency: string })[]; categories: Option[]; tags: Option[]; initial?: InitialExportFilters }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [preset, setPreset] = useState(initial.from || initial.to ? "custom" : "this_month");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "export" | null>(null);
  const [error, setError] = useState("");

  function values(previewOnly: boolean) {
    if (!form.current) throw new Error("Export form is unavailable.");
    const data = new FormData(form.current);
    return {
      preview: previewOnly,
      format: data.get("format"), accountId: data.get("accountId"), preset: data.get("preset"), from: data.get("from"), to: data.get("to"),
      types: data.getAll("types"), statuses: data.getAll("statuses"), categoryIds: data.getAll("categoryIds"), tagIds: data.getAll("tagIds"),
      includeVoided: data.get("includeVoided") === "on", includeNotes: data.get("includeNotes") === "on", sort: data.get("sort"), currency: data.get("currency"), query: initial.query ?? "",
    };
  }

  async function request(previewOnly: boolean) {
    setBusy(previewOnly ? "preview" : "export"); setError("");
    try {
      const response = await fetch("/api/exports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values(previewOnly)) });
      if (!response.ok) { const body = await response.json().catch(() => ({ error: "Export generation failed." })); throw new Error(body.error ?? "Export generation failed."); }
      if (previewOnly) { setPreview(await response.json()); return; }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "pocketledger-export";
      const href = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = href; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(href);
      dialog.current?.close();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Export generation failed. Please retry."); }
    finally { setBusy(null); }
  }

  return <>
    <Button variant="outline" type="button" onClick={() => dialog.current?.showModal()}><FileDown className="size-4" aria-hidden="true" />Export</Button>
    <dialog ref={dialog} className="m-auto max-h-[90vh] w-[min(760px,calc(100%-2rem))] overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50">
      <form ref={form} method="dialog" className="space-y-5 p-5 sm:p-6" onChange={() => { setPreview(null); setError(""); }} onSubmit={(event) => event.preventDefault()}>
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Export financial data</h2><p className="mt-1 text-sm text-muted-foreground">Review the filters before generating a private PDF or CSV file.</p></div><Button variant="ghost" size="icon" type="button" aria-label="Close export dialog" disabled={Boolean(busy)} onClick={() => dialog.current?.close()}><X className="size-5" aria-hidden="true" /></Button></div>

        {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="sr-only">Basic export options</legend>
          <Field label="File format" id="export-format"><select id="export-format" name="format" className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="pdf">PDF report</option><option value="csv">CSV data</option></select></Field>
          <Field label="Account" id="export-account"><select id="export-account" name="accountId" defaultValue={initial.accountId ?? "all"} className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="all">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
          <Field label="Date preset" id="export-preset"><select id="export-preset" name="preset" value={preset} onChange={(event) => setPreset(event.target.value)} className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="this_month">This month</option><option value="last_month">Last month</option><option value="last_3_months">Last 3 months</option><option value="this_year">This year</option><option value="custom">Custom range</option><option value="all_time">All time</option></select></Field>
          <Field label="Sort order" id="export-sort"><select id="export-sort" name="sort" className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="asc">Oldest first</option><option value="desc">Newest first</option></select></Field>
        </fieldset>
        {preset === "custom" && <div className="grid gap-3 sm:grid-cols-2"><Field label="From" id="export-from"><Input id="export-from" name="from" type="date" defaultValue={initial.from} required /></Field><Field label="To" id="export-to"><Input id="export-to" name="to" type="date" defaultValue={initial.to} required /></Field></div>}

        <CheckGroup legend="Transaction types" name="types" options={[["income", "Income"], ["expense", "Expense"], ["transfer", "Transfer"], ["refund", "Refund"], ["adjustment", "Balance adjustment"], ["reversal", "Reversal"]]} defaults={initial.type ? [initial.type] : []} />
        <CheckGroup legend="Transaction statuses" name="statuses" options={[["draft", "Draft"], ["posted", "Posted"], ["voided", "Voided"]]} defaults={initial.status ? [initial.status] : []} />
        {categories.length > 0 && <CheckGroup legend="Categories" name="categoryIds" options={categories.map((item) => [item.id, item.name])} scroll />}
        {tags.length > 0 && <CheckGroup legend="Tags" name="tagIds" options={tags.map((item) => [item.id, item.name])} scroll />}

        <div className="grid gap-3 sm:grid-cols-2"><Field label="Currency" id="export-currency"><select id="export-currency" name="currency" className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="THB">THB - Thai baht</option></select></Field><div className="space-y-2 pt-1"><Check name="includeVoided" label="Include voided transactions" defaultChecked={initial.status === "voided"} /><Check name="includeNotes" label="Include transaction notes" /></div></div>

        <div className="rounded-xl border bg-secondary/40 p-4" aria-live="polite">
          {preview ? <div className="space-y-1 text-sm"><p className="font-semibold">Ready to export {preview.count.toLocaleString()} transaction{preview.count === 1 ? "" : "s"}</p><p className="text-muted-foreground">{preview.accounts.join(", ") || "No accounts"} | {preview.period}</p>{preview.tooLarge && <p className="text-destructive">This exceeds the synchronous limit. Narrow the filters and preview again.</p>}</div> : <p className="text-sm text-muted-foreground">Preview the configuration to confirm how many records match.</p>}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" type="button" disabled={Boolean(busy)} onClick={() => request(true)}>{busy === "preview" ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}{busy === "preview" ? "Checking…" : "Preview selection"}</Button><Button type="button" disabled={Boolean(busy) || !preview || preview.count === 0 || preview.tooLarge} onClick={() => request(false)}>{busy === "export" ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}{busy === "export" ? "Generating file…" : "Generate and download"}</Button></div>
      </form>
    </dialog>
  </>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function Check({ name, value = "on", label, defaultChecked }: { name: string; value?: string; label: string; defaultChecked?: boolean }) { return <label className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-secondary"><input name={name} value={value} type="checkbox" defaultChecked={defaultChecked} />{label}</label>; }
function CheckGroup({ legend, name, options, defaults = [], scroll = false }: { legend: string; name: string; options: (readonly [string, string])[]; defaults?: string[]; scroll?: boolean }) { return <fieldset><legend className="mb-2 text-sm font-semibold">{legend} <span className="font-normal text-muted-foreground">(none selected means all)</span></legend><div className={`grid gap-1 rounded-xl border p-2 sm:grid-cols-2 ${scroll ? "max-h-44 overflow-y-auto" : ""}`}>{options.map(([value, label]) => <Check key={value} name={name} value={value} label={label} defaultChecked={defaults.includes(value)} />)}</div></fieldset>; }
