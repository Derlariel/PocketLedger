begin;

drop policy if exists transactions_owner on public.transactions;
create policy transactions_select on public.transactions for select using(owner_id=auth.uid());
create policy transactions_insert_draft on public.transactions for insert with check(owner_id=auth.uid() and status='draft');
create policy transactions_update_draft on public.transactions for update using(owner_id=auth.uid() and status='draft') with check(owner_id=auth.uid() and status='draft');
create policy transactions_delete_draft on public.transactions for delete using(owner_id=auth.uid() and status='draft');

drop policy if exists transaction_splits_owner on public.transaction_splits;
create policy splits_select on public.transaction_splits for select using(owner_id=auth.uid());
create policy splits_insert_draft on public.transaction_splits for insert with check(owner_id=auth.uid() and exists(select 1 from public.transactions t where t.id=transaction_id and t.owner_id=auth.uid() and t.status='draft'));
create policy splits_update_draft on public.transaction_splits for update using(owner_id=auth.uid() and exists(select 1 from public.transactions t where t.id=transaction_id and t.owner_id=auth.uid() and t.status='draft')) with check(owner_id=auth.uid());
create policy splits_delete_draft on public.transaction_splits for delete using(owner_id=auth.uid() and exists(select 1 from public.transactions t where t.id=transaction_id and t.owner_id=auth.uid() and t.status='draft'));

drop policy if exists transaction_documents_owner on public.transaction_documents;
create policy transaction_documents_select on public.transaction_documents for select using(owner_id=auth.uid());

drop policy if exists reservations_owner on public.reservations;
create policy reservations_select on public.reservations for select using(owner_id=auth.uid());
create policy reservations_insert on public.reservations for insert with check(owner_id=auth.uid() and status='active' and reserved_transaction_id is null);

drop policy if exists documents_owner on public.documents;
create policy documents_select on public.documents for select using(owner_id=auth.uid());
create policy documents_insert on public.documents for insert with check(owner_id=auth.uid() and extracted_data is null and corrected_data is null);
create policy documents_limited_update on public.documents for update using(owner_id=auth.uid()) with check(owner_id=auth.uid());

create function public.protect_account_opening_balance() returns trigger language plpgsql as $$
begin
  if (new.opening_balance_satangs,new.opening_balance_date) is distinct from (old.opening_balance_satangs,old.opening_balance_date)
     and exists(select 1 from public.ledger_entries where owner_id=old.owner_id and account_id=old.id) then
    raise exception 'opening balance cannot change after ledger history exists; use an adjustment' using errcode='23514';
  end if;
  return new;
end $$;
create trigger protect_account_opening before update on public.accounts for each row execute function public.protect_account_opening_balance();

create function public.protect_document_immutable_fields() returns trigger language plpgsql as $$
begin
  if (new.owner_id,new.storage_key,new.original_name,new.mime_type,new.byte_size,new.sha256,new.extracted_data)
     is distinct from (old.owner_id,old.storage_key,old.original_name,old.mime_type,old.byte_size,old.sha256,old.extracted_data) then
    raise exception 'document source fields are immutable' using errcode='23514';
  end if;
  return new;
end $$;
create trigger protect_document_source before update on public.documents for each row when (auth.uid() is not null) execute function public.protect_document_immutable_fields();

create trigger audit_transactions after insert or update or delete on public.transactions for each row execute function public.write_audit();
create trigger audit_documents after insert or update or delete on public.documents for each row execute function public.write_audit();

drop policy if exists evidence_delete on storage.objects;

create or replace view public.account_balances with (security_invoker=true) as
select a.owner_id,a.id account_id,
  ((case when a.opening_balance_date <= (now() at time zone 'Asia/Bangkok')::date then a.opening_balance_satangs else 0 end)+coalesce(sum(le.amount_satangs),0))::text balance_satangs,
  coalesce((select sum(r.amount_satangs) from public.reservations r where r.owner_id=a.owner_id and r.account_id=a.id and r.status='active'),0)::text reserved_satangs,
  ((case when a.opening_balance_date <= (now() at time zone 'Asia/Bangkok')::date then a.opening_balance_satangs else 0 end)+coalesce(sum(le.amount_satangs),0)-coalesce((select sum(r.amount_satangs) from public.reservations r where r.owner_id=a.owner_id and r.account_id=a.id and r.status='active'),0))::text available_satangs
from public.accounts a left join public.ledger_entries le on le.owner_id=a.owner_id and le.account_id=a.id group by a.owner_id,a.id;

commit;
