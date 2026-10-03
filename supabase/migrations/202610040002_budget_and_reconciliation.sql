begin;

create view public.budget_status with (security_invoker=true) as
select b.owner_id,b.id budget_id,b.category_id,b.period_start,b.period_end,b.amount_satangs::text amount_satangs,
  coalesce(sum(case when t.type='expense' then s.amount_satangs when t.type='refund' then -s.amount_satangs else 0 end),0)::text spent_satangs,
  (b.amount_satangs-coalesce(sum(case when t.type='expense' then s.amount_satangs when t.type='refund' then -s.amount_satangs else 0 end),0))::text remaining_satangs
from public.budgets b
left join public.transaction_splits s on s.owner_id=b.owner_id and (b.category_id is null or s.category_id=b.category_id)
left join public.transactions t on t.id=s.transaction_id and t.owner_id=b.owner_id and t.status='posted' and (t.occurred_at at time zone 'Asia/Bangkok')::date between b.period_start and b.period_end
group by b.owner_id,b.id;
grant select on public.budget_status to authenticated;

create function public.consume_reservation(p_reservation_id uuid,p_amount_satangs bigint,p_occurred_at timestamptz,p_description text,p_category_id uuid,p_idempotency_key uuid,p_correlation_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); reserve public.reservations; result uuid;
begin
  select * into reserve from public.reservations where id=p_reservation_id and owner_id=owner for update;
  if not found or reserve.status<>'active' then raise exception 'reservation is not active'; end if;
  result:=public.create_transaction(reserve.account_id,'expense',p_amount_satangs,p_occurred_at,p_description,null,p_category_id,null,'posted','manual',p_idempotency_key,p_correlation_id);
  update public.reservations set status='consumed',reserved_transaction_id=result where id=reserve.id;
  insert into public.audit_logs(owner_id,actor_id,event_type,entity_type,entity_id,before_data,after_data,correlation_id)
  values(owner,owner,'consumed','reservations',reserve.id,jsonb_build_object('status','active','amount_satangs',reserve.amount_satangs::text),jsonb_build_object('status','consumed','transaction_id',result),p_correlation_id);
  return result;
end $$;
grant execute on function public.consume_reservation to authenticated;

create function public.record_reconciliation(p_account_id uuid,p_statement_balance_satangs bigint,p_reconciled_at timestamptz,p_note text,p_create_adjustment boolean,p_idempotency_key uuid,p_correlation_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); system_balance bigint; result uuid; difference bigint; adjustment_id uuid;
begin
  perform 1 from public.accounts where id=p_account_id and owner_id=owner for update; if not found then raise exception 'account not found'; end if;
  select opening_balance_satangs+coalesce((select sum(amount_satangs) from public.ledger_entries where account_id=p_account_id and owner_id=owner),0) into system_balance from public.accounts where id=p_account_id;
  difference:=p_statement_balance_satangs-system_balance;
  insert into public.reconciliations(owner_id,account_id,statement_balance_satangs,system_balance_satangs,reconciled_at,note) values(owner,p_account_id,p_statement_balance_satangs,system_balance,p_reconciled_at,p_note) returning id into result;
  if p_create_adjustment and difference<>0 then
    insert into public.transactions(owner_id,type,status,account_id,amount_satangs,flow_direction,occurred_at,description,note,source,idempotency_key,posted_at)
    values(owner,'adjustment','posted',p_account_id,abs(difference),case when difference>0 then 1 else -1 end,p_reconciled_at,'ปรับยอดจากการตรวจสอบธนาคาร',p_note,'manual',p_idempotency_key,now()) returning id into adjustment_id;
    insert into public.ledger_entries(owner_id,transaction_id,account_id,amount_satangs,occurred_at) values(owner,adjustment_id,p_account_id,difference,p_reconciled_at);
  end if;
  return result;
end $$;
grant execute on function public.record_reconciliation to authenticated;

commit;
