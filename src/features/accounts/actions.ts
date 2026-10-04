"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { z } from "zod";
import { BANKS } from "@/features/accounts/banks";
import { parseSignedBahtToSatangs } from "@/features/ledger/money";
import { requireUser } from "@/lib/supabase/server";

const accountSchema = z.object({
  submissionId: z.uuid("Please reload the form and try again."),
  name: z.string().trim().min(1, "Enter an account name.").max(80, "Account names must be 80 characters or fewer."),
  type: z.enum(["bank", "cash", "ewallet", "credit_card"], { message: "Select a valid account type." }),
  bankId: z.string().trim().optional().transform((value) => value || null),
  accountHolderName: z.string().trim().max(120, "Account holder names must be 120 characters or fewer.").optional().transform((value) => value || null),
  accountNumberLast4: z.string().trim().regex(/^\d{4}$/, "Enter exactly the last four digits.").or(z.literal("")).optional().transform((value) => value || null),
  note: z.string().trim().max(500, "Notes must be 500 characters or fewer.").optional().transform((value) => value || null),
  currency: z.literal("THB", { message: "Only THB accounts are currently supported." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Select a valid account colour."),
  openingBalance: z.string(),
  openingBalanceDate: z.iso.date("Select a valid balance date."),
}).superRefine((account, context) => {
  if (account.type === "bank" && !BANKS.some((bank) => bank.id === account.bankId)) {
    context.addIssue({ code: "custom", path: ["bankId"], message: "Select a supported bank." });
  }
});

export type CreateAccountState = {
  success?: boolean;
  message?: string;
  submissionId?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function createAccount(_previous: CreateAccountState, formData: FormData): Promise<CreateAccountState> {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, message: "Check the highlighted account details.", fieldErrors: parsed.error.flatten().fieldErrors };
  let satangs: bigint;
  try { satangs = parseSignedBahtToSatangs(parsed.data.openingBalance); }
  catch { return { success: false, message: "Check the highlighted account details.", fieldErrors: { openingBalance: ["Enter a valid amount with no more than two decimal places."] } }; }

  try {
    const { supabase, userId } = await requireUser();
    const icon = parsed.data.type === "bank" ? "landmark" : parsed.data.type === "cash" ? "banknote" : parsed.data.type === "credit_card" ? "credit-card" : "wallet";
    const { error } = await supabase.from("accounts").upsert({
      owner_id: userId,
      name: parsed.data.name,
      type: parsed.data.type,
      bank_id: parsed.data.type === "bank" ? parsed.data.bankId : null,
      account_holder_name: parsed.data.type === "bank" ? parsed.data.accountHolderName : null,
      account_number_last4: parsed.data.type === "bank" ? parsed.data.accountNumberLast4 : null,
      note: parsed.data.note,
      currency: parsed.data.currency,
      color: parsed.data.color,
      icon,
      opening_balance_satangs: satangs.toString(),
      opening_balance_date: parsed.data.openingBalanceDate,
      creation_key: parsed.data.submissionId,
    }, { onConflict: "owner_id,creation_key", ignoreDuplicates: true });
    if (error) {
      console.error("createAccount failed", { code: error.code, message: error.message });
      const message = error.code === "42501"
        ? "Your session cannot create this account. Sign in again and verify the account RLS migration."
        : error.code === "23503"
          ? "Your user profile is not ready. Sign out, sign in again, and verify the database migrations."
          : error.code === "42703" || error.code === "PGRST204"
            ? "The account database migration has not been applied yet. Apply the latest Supabase migrations and retry."
            : "The account could not be saved. Please try again; if it continues, check the server log.";
      return { success: false, message };
    }
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    return { success: true, message: "Account saved successfully.", submissionId: parsed.data.submissionId };
  } catch {
    return { success: false, message: "Your session has expired. Sign in again before saving the account." };
  }
}

export async function archiveAccount(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", id).eq("owner_id", userId);
  if (error) redirect("/accounts?error=" + encodeURIComponent("The account could not be archived."));
  revalidatePath("/accounts"); revalidatePath("/dashboard");
}

const updateAccountSchema = z.object({
  id: z.uuid(),
  type: z.enum(["bank", "cash", "ewallet", "credit_card"]),
  name: z.string().trim().min(1, "Enter an account name.").max(80, "Account names must be 80 characters or fewer."),
  bankId: z.string().trim().optional().transform((value) => value || null),
  accountHolderName: z.string().trim().max(120, "Account holder names must be 120 characters or fewer.").optional().transform((value) => value || null),
  accountNumberLast4: z.string().trim().regex(/^\d{4}$/, "Enter exactly the last four digits.").or(z.literal("")).optional().transform((value) => value || null),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Select a valid account colour."),
  note: z.string().trim().max(500, "Notes must be 500 characters or fewer.").optional().transform((value) => value || null),
}).superRefine((account, context) => {
  if (account.type === "bank" && !BANKS.some((bank) => bank.id === account.bankId)) {
    context.addIssue({ code: "custom", path: ["bankId"], message: "Select a supported bank." });
  }
});

export type UpdateAccountState = CreateAccountState;

export async function updateAccount(_previous: UpdateAccountState, formData: FormData): Promise<UpdateAccountState> {
  const parsed = updateAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, message: "Check the highlighted account details.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("accounts").update({
      name: parsed.data.name,
      bank_id: parsed.data.type === "bank" ? parsed.data.bankId : null,
      account_holder_name: parsed.data.type === "bank" ? parsed.data.accountHolderName : null,
      account_number_last4: parsed.data.type === "bank" ? parsed.data.accountNumberLast4 : null,
      color: parsed.data.color,
      note: parsed.data.note,
    }).eq("id", parsed.data.id).eq("owner_id", userId);
    if (error) {
      console.error("updateAccount failed", { code: error.code, message: error.message });
      return { success: false, message: "The account could not be updated. Please try again." };
    }
    revalidatePath("/accounts");
    revalidatePath(`/accounts/${parsed.data.id}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Account details updated." };
  } catch {
    return { success: false, message: "Your session has expired. Sign in again before saving changes." };
  }
}

export async function deleteAccount(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const { supabase, userId } = await requireUser();
  const history = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("owner_id", userId).or(`account_id.eq.${id},counter_account_id.eq.${id}`);
  if (history.error) redirect(`/accounts/${id}?error=` + encodeURIComponent("Financial history could not be checked, so the account was not deleted."));
  if ((history.count ?? 0) > 0) redirect(`/accounts/${id}?error=` + encodeURIComponent("This account has financial history and cannot be deleted. Archive it instead."));
  const { error } = await supabase.from("accounts").delete().eq("id", id).eq("owner_id", userId);
  if (error) redirect(`/accounts/${id}?error=` + encodeURIComponent("This account is referenced by financial history and cannot be deleted. Archive it instead."));
  revalidatePath("/accounts"); revalidatePath("/dashboard");
  redirect("/accounts?message=" + encodeURIComponent("Account deleted."));
}

export async function reconcileAccount(formData: FormData) {
  const parsed = z.object({ accountId: z.uuid(), statementBalance: z.string(), note: z.string().trim().min(3).max(1000), createAdjustment: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/accounts?error=" + encodeURIComponent("ข้อมูลตรวจยอดไม่ถูกต้อง"));
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("record_reconciliation", { p_account_id: parsed.data.accountId, p_statement_balance_satangs: parseSignedBahtToSatangs(parsed.data.statementBalance).toString(), p_reconciled_at: new Date().toISOString(), p_note: parsed.data.note, p_create_adjustment: parsed.data.createAdjustment === "on", p_idempotency_key: randomUUID(), p_correlation_id: randomUUID() });
  if (error) redirect("/accounts?error=" + encodeURIComponent(error.message));
  revalidatePath("/accounts"); revalidatePath("/dashboard"); redirect("/accounts?message=" + encodeURIComponent("บันทึกการตรวจยอดแล้ว"));
}
