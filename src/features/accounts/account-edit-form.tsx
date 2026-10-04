"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAccount, type UpdateAccountState } from "@/features/accounts/actions";
import { BankSelector } from "@/features/accounts/bank-selector";
import type { BankId } from "@/features/accounts/banks";

type EditableAccount = {
  id: string;
  type: "bank" | "cash" | "ewallet" | "credit_card";
  name: string;
  bankId: BankId | null;
  holderName: string;
  lastFour: string;
  color: string;
  note: string;
};

export function AccountEditForm({ account }: { account: EditableAccount }) {
  const [state, action] = useActionState(updateAccount, {} as UpdateAccountState);
  const [bankId, setBankId] = useState<BankId | null>(account.bankId);
  const error = (name: string) => state.fieldErrors?.[name]?.[0];

  return <form action={action} className="space-y-4">
    <input type="hidden" name="id" value={account.id} />
    <input type="hidden" name="type" value={account.type} />
    {state.message && <p role={state.success ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${state.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{state.message}</p>}
    <Field label="Account name" id="edit-name" error={error("name")}><Input id="edit-name" name="name" defaultValue={account.name} required maxLength={80} /></Field>
    {account.type === "bank" && <>
      <Field label="Bank" id="bank-search"><BankSelector value={bankId} onChange={setBankId} error={error("bankId")} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Account holder name" id="edit-holder" error={error("accountHolderName")}><Input id="edit-holder" name="accountHolderName" defaultValue={account.holderName} maxLength={120} /></Field>
        <Field label="Last four digits" id="edit-last-four" error={error("accountNumberLast4")} hint="Only the last four digits are stored."><Input id="edit-last-four" name="accountNumberLast4" defaultValue={account.lastFour} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" /></Field>
      </div>
    </>}
    <Field label="Account colour" id="edit-color" error={error("color")}><Input id="edit-color" name="color" type="color" defaultValue={account.color} /></Field>
    <Field label="Note (optional)" id="edit-note" error={error("note")}><textarea id="edit-note" name="note" defaultValue={account.note} maxLength={500} rows={3} className="w-full rounded-xl border bg-background px-3 py-2 text-sm" /></Field>
    <EditSubmit />
  </form>;
}

function EditSubmit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{pending ? "Saving…" : "Save changes"}</Button>;
}

function Field({ label, id, error, hint, children }: { label: string; id: string; error?: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
