"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAccount, type CreateAccountState } from "@/features/accounts/actions";
import { BankSelector } from "@/features/accounts/bank-selector";
import type { BankId } from "@/features/accounts/banks";

const initialState: CreateAccountState = {};

export function AccountForm({ today }: { today: string }) {
  const [state, action] = useActionState(createAccount, initialState);
  const [type, setType] = useState("bank");
  const [bankId, setBankId] = useState<BankId | null>(null);
  const [bankError, setBankError] = useState("");

  const error = (name: string) => state.fieldErrors?.[name]?.[0];

  return <form key={state.submissionId ?? "new"} action={action} className="space-y-4" onSubmit={(event) => {
    if (type === "bank" && !bankId) {
      event.preventDefault();
      setBankError("Select a supported bank.");
      return;
    }
    const input = event.currentTarget.elements.namedItem("submissionId") as HTMLInputElement;
    if (!input.value) input.value = crypto.randomUUID();
  }}>
    <input type="hidden" name="submissionId" defaultValue="" />
    {state.message && <p role={state.success ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${state.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{state.message}</p>}

    <Field label="Account type" id="type" error={error("type")}>
      <select id="type" name="type" value={type} onChange={(event) => { setType(event.target.value); if (event.target.value !== "bank") setBankId(null); }} className="min-h-11 w-full rounded-xl border bg-background px-3">
        <option value="bank">Bank account</option>
        <option value="cash">Cash</option>
        <option value="ewallet">E-wallet</option>
        <option value="credit_card">Credit card</option>
      </select>
    </Field>

    {type === "bank" && <Field label="Bank" id="bank-search"><BankSelector value={bankId} onChange={(value) => { setBankId(value); setBankError(""); }} error={bankError || error("bankId")} /></Field>}

    <Field label="Account name" id="name" error={error("name")}><Input id="name" name="name" required maxLength={80} placeholder="e.g. Salary account" aria-invalid={Boolean(error("name"))} /></Field>

    {type === "bank" && <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Account holder name" id="accountHolderName" error={error("accountHolderName")}><Input id="accountHolderName" name="accountHolderName" maxLength={120} autoComplete="name" placeholder="Optional" /></Field>
      <Field label="Last four digits" id="accountNumberLast4" error={error("accountNumberLast4")} hint="Only the last four digits are stored."><Input id="accountNumberLast4" name="accountNumberLast4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" placeholder="1234" /></Field>
    </div>}

    <Field label="Note (optional)" id="note" error={error("note")}><textarea id="note" name="note" maxLength={500} rows={3} className="w-full rounded-xl border bg-background px-3 py-2 text-sm" placeholder="A reminder about how you use this account" /></Field>

    <div className="grid grid-cols-2 gap-3">
      <Field label="Currency" id="currency" error={error("currency")}><select id="currency" name="currency" className="min-h-11 w-full rounded-xl border bg-background px-3"><option value="THB">THB — Thai baht</option></select></Field>
      <Field label="Account colour" id="color" error={error("color")}><Input id="color" name="color" type="color" defaultValue="#2f7d5a" /></Field>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Initial balance (THB)" id="openingBalance" error={error("openingBalance")}><Input id="openingBalance" name="openingBalance" inputMode="decimal" pattern="-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?" defaultValue="0.00" required /></Field>
      <Field label="Balance date" id="openingBalanceDate" error={error("openingBalanceDate")}><Input id="openingBalanceDate" name="openingBalanceDate" type="date" defaultValue={today} required /></Field>
    </div>

    <SubmitButton />
  </form>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button className="w-full" type="submit" disabled={pending} aria-disabled={pending}>
    {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
    {pending ? "Saving account…" : "Save manual account"}
  </Button>;
}

function Field({ label, id, error, hint, children }: { label: string; id: string; error?: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
