/**
 * Development bootstrap type. Replace by running `bun run db:types` after
 * `supabase start` or generate from the linked project in CI.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Entity = { id: string; owner_id: string; created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: Table<{ id: string; display_name: string | null; locale: string; timezone: string; created_at: string; updated_at: string }>;
      accounts: Table<Entity & { name: string; type: "bank" | "cash" | "ewallet" | "credit_card"; bank_id: string | null; bank_name: string | null; account_holder_name: string | null; account_number_last4: string | null; note: string | null; currency: "THB"; creation_key: string | null; color: string; icon: string; opening_balance_satangs: string; opening_balance_date: string; is_active: boolean }>;
      categories: Table<Entity & { name: string; kind: "income" | "expense"; color: string; icon: string }>;
      transactions: Table<Entity & { type: "income" | "expense" | "transfer" | "refund" | "adjustment" | "reversal"; status: "draft" | "posted" | "voided"; account_id: string | null; counter_account_id: string | null; amount_satangs: string; flow_direction: -1 | 1; occurred_at: string; description: string; note: string | null; payment_method: string | null; source: "manual" | "ocr" | "import"; original_transaction_id: string | null; replaces_transaction_id: string | null; reversal_transaction_id: string | null; idempotency_key: string; posted_at: string | null; voided_at: string | null }>;
      ledger_entries: Table<{ id: string; owner_id: string; transaction_id: string; account_id: string; amount_satangs: string; occurred_at: string; sequence: number; created_at: string }>;
      transaction_splits: Table<{ id: string; owner_id: string; transaction_id: string; category_id: string; amount_satangs: string; created_at: string }>;
      documents: Table<Entity & { storage_key: string; original_name: string; mime_type: string; byte_size: number; sha256: string; status: "uploaded" | "queued" | "processing" | "needs_review" | "failed" | "attached"; extracted_data: Json | null; corrected_data: Json | null }>;
      transaction_documents: Table<{ owner_id: string; transaction_id: string; document_id: string; created_at: string }>;
      extraction_jobs: Table<{ id: string; owner_id: string; document_id: string; status: "queued" | "processing" | "needs_review" | "failed"; attempts: number; max_attempts: number; provider: string | null; model: string | null; error_code: string | null; locked_at: string | null; created_at: string; updated_at: string }>;
      budgets: Table<Entity & { category_id: string | null; period_start: string; period_end: string; amount_satangs: string; threshold_80_notified_at: string | null; threshold_100_notified_at: string | null }>;
      reservations: Table<Entity & { account_id: string; purpose: string; amount_satangs: string; status: "active" | "released" | "consumed"; reserved_transaction_id: string | null }>;
      reconciliations: Table<Entity & { account_id: string; statement_balance_satangs: string; system_balance_satangs: string; difference_satangs: string; reconciled_at: string; note: string | null }>;
      audit_logs: Table<{ id: string; owner_id: string; actor_id: string; event_type: string; entity_type: string; entity_id: string; before_data: Json | null; after_data: Json | null; reason: string | null; correlation_id: string; created_at: string }>;
    };
    Views: {
      account_ledger_export: { Row: { owner_id: string; account_id: string; transaction_id: string; occurred_at: string; transaction_created_at: string; delta_satangs: string; running_balance_satangs: string }; Relationships: [] };
      account_balances: { Row: { owner_id: string; account_id: string; balance_satangs: number; reserved_satangs: number; available_satangs: number }; Relationships: [] };
      monthly_cashflow: { Row: { owner_id: string; month_start: string; income_satangs: string; expense_satangs: string }; Relationships: [] };
      budget_status: { Row: { owner_id: string; budget_id: string; category_id: string | null; period_start: string; period_end: string; amount_satangs: string; spent_satangs: string; remaining_satangs: string }; Relationships: [] };
    };
    Functions: {
      get_export_transaction_ids: { Args: { p_account_id?: string | null; p_from?: string | null; p_to?: string | null; p_types?: string[] | null; p_statuses?: string[] | null; p_category_ids?: string[] | null; p_tag_ids?: string[] | null; p_include_voided?: boolean; p_query?: string | null }; Returns: { id: string }[] };
      record_export_audit: { Args: { p_format: string; p_filters: Json; p_account_ids: string[]; p_transaction_count: number }; Returns: string };
      post_transaction: { Args: { p_transaction_id: string; p_idempotency_key: string; p_correlation_id: string }; Returns: string };
      void_posted_transaction: { Args: { p_transaction_id: string; p_reason: string; p_idempotency_key: string; p_correlation_id: string }; Returns: string };
      create_transfer: { Args: { p_source_account_id: string; p_destination_account_id: string; p_amount_satangs: string; p_fee_satangs: string; p_occurred_at: string; p_description: string; p_idempotency_key: string; p_correlation_id: string }; Returns: string };
      confirm_document_transaction: { Args: { p_document_ids: string[]; p_account_id: string; p_type: string; p_amount_satangs: string; p_occurred_at: string; p_description: string; p_category_id: string | null; p_corrected_data: Json; p_idempotency_key: string; p_correlation_id: string }; Returns: string };
      create_transaction: { Args: { p_account_id: string; p_type: string; p_amount_satangs: string; p_occurred_at: string; p_description: string; p_note: string | null; p_category_id: string | null; p_payment_method: string | null; p_status: string; p_source: string; p_idempotency_key: string; p_correlation_id: string }; Returns: string };
      claim_extraction_job: { Args: { p_worker_id: string }; Returns: { id: string; owner_id: string; document_id: string; status: string; attempts: number; max_attempts: number; provider: string | null; model: string | null; error_code: string | null; locked_at: string | null; worker_id: string | null; created_at: string; updated_at: string } | null };
      complete_extraction_job: { Args: { p_job_id: string; p_extracted_data: Json; p_provider: string; p_model: string }; Returns: undefined };
      fail_extraction_job: { Args: { p_job_id: string; p_error_code: string }; Returns: undefined };
      consume_reservation: { Args: { p_reservation_id: string; p_amount_satangs: string; p_occurred_at: string; p_description: string; p_category_id: string | null; p_idempotency_key: string; p_correlation_id: string }; Returns: string };
      record_reconciliation: { Args: { p_account_id: string; p_statement_balance_satangs: string; p_reconciled_at: string; p_note: string | null; p_create_adjustment: boolean; p_idempotency_key: string; p_correlation_id: string }; Returns: string };
      enqueue_extraction_job: { Args: { p_document_id: string; p_max_attempts: number }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
