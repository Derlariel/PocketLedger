begin;

create view public.account_ledger_export with (security_invoker=true) as
select
  le.owner_id,
  le.account_id,
  le.transaction_id,
  t.occurred_at,
  t.created_at transaction_created_at,
  le.amount_satangs::text delta_satangs,
  (a.opening_balance_satangs + sum(le.amount_satangs) over (
    partition by le.account_id
    order by t.occurred_at, t.created_at, t.id
    rows between unbounded preceding and current row
  ))::text running_balance_satangs
from public.ledger_entries le
join public.transactions t on t.id=le.transaction_id and t.owner_id=le.owner_id
join public.accounts a on a.id=le.account_id and a.owner_id=le.owner_id;

grant select on public.account_ledger_export to authenticated;

create function public.get_export_transaction_ids(
  p_account_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_types text[] default null,
  p_statuses text[] default null,
  p_category_ids uuid[] default null,
  p_tag_ids uuid[] default null,
  p_include_voided boolean default false,
  p_query text default null
) returns table(id uuid)
language sql stable security invoker set search_path=''
as $$
  select t.id
  from public.transactions t
  where t.owner_id=auth.uid()
    and (p_account_id is null or t.account_id=p_account_id or t.counter_account_id=p_account_id)
    and (p_from is null or t.occurred_at>=p_from)
    and (p_to is null or t.occurred_at<p_to)
    and (coalesce(cardinality(p_types),0)=0 or t.type::text=any(p_types))
    and (coalesce(cardinality(p_statuses),0)=0 or t.status::text=any(p_statuses))
    and (p_include_voided or t.status::text<>'voided')
    and (nullif(trim(p_query),'') is null or position(lower(trim(p_query)) in lower(t.description))>0)
    and (coalesce(cardinality(p_category_ids),0)=0 or exists(
      select 1 from public.transaction_splits s where s.transaction_id=t.id and s.owner_id=t.owner_id and s.category_id=any(p_category_ids)
    ))
    and (coalesce(cardinality(p_tag_ids),0)=0 or exists(
      select 1 from public.transaction_tags tt where tt.transaction_id=t.id and tt.owner_id=t.owner_id and tt.tag_id=any(p_tag_ids)
    ))
  order by t.occurred_at, t.created_at, t.id
  limit 5001
$$;

revoke all on function public.get_export_transaction_ids(uuid,timestamptz,timestamptz,text[],text[],uuid[],uuid[],boolean,text) from public,anon;
grant execute on function public.get_export_transaction_ids(uuid,timestamptz,timestamptz,text[],text[],uuid[],uuid[],boolean,text) to authenticated;

create function public.record_export_audit(
  p_format text,
  p_filters jsonb,
  p_account_ids uuid[],
  p_transaction_count integer
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare owner uuid:=auth.uid(); export_id uuid:=gen_random_uuid();
begin
  if owner is null then raise exception 'not authorized' using errcode='42501'; end if;
  if p_format not in ('csv','pdf') or p_transaction_count<0 or p_transaction_count>5000 then raise exception 'invalid export audit'; end if;
  if pg_column_size(coalesce(p_filters,'{}'::jsonb))>8192 then raise exception 'filters too large'; end if;
  if exists(select 1 from unnest(coalesce(p_account_ids,array[]::uuid[])) as selected(account_id) where not exists(
    select 1 from public.accounts a where a.id=selected.account_id and a.owner_id=owner
  )) then raise exception 'account not found' using errcode='42501'; end if;

  insert into public.audit_logs(owner_id,actor_id,event_type,entity_type,entity_id,after_data,correlation_id)
  values(owner,owner,'exported','exports',export_id,
    jsonb_build_object('format',p_format,'filters',coalesce(p_filters,'{}'::jsonb),'account_ids',coalesce(p_account_ids,array[]::uuid[]),'transaction_count',p_transaction_count,'generated_at',now()),
    gen_random_uuid());
  return export_id;
end $$;

revoke all on function public.record_export_audit(text,jsonb,uuid[],integer) from public,anon;
grant execute on function public.record_export_audit(text,jsonb,uuid[],integer) to authenticated;

commit;
