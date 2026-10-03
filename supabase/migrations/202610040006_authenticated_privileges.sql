begin;

grant usage on schema public to authenticated;

grant select on public.profiles, public.accounts, public.categories, public.transactions,
  public.ledger_entries, public.transaction_splits, public.tags, public.transaction_tags,
  public.documents, public.transaction_documents, public.extraction_jobs, public.budgets,
  public.reservations, public.reconciliations, public.audit_logs,
  public.account_balances, public.monthly_cashflow, public.budget_status
to authenticated;

grant insert, update on public.accounts to authenticated;
grant insert, update, delete on public.categories, public.tags, public.transaction_tags to authenticated;
grant insert, update, delete on public.transactions, public.transaction_splits to authenticated;
grant insert, update, delete on public.budgets to authenticated;
grant insert on public.reservations to authenticated;
grant insert, update on public.documents to authenticated;

commit;
