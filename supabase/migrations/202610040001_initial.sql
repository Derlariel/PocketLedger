begin;

create extension if not exists pgcrypto;

create type public.account_type as enum ('bank','cash','ewallet');
create type public.transaction_type as enum ('income','expense','transfer','refund','adjustment','reversal');
create type public.transaction_status as enum ('draft','posted','voided');
create type public.transaction_source as enum ('manual','ocr','import');
create type public.document_status as enum ('uploaded','queued','processing','needs_review','failed','attached');
create type public.job_status as enum ('queued','processing','needs_review','failed');
create type public.reservation_status as enum ('active','released','consumed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'th-TH' check (locale = 'th-TH'),
  timezone text not null default 'Asia/Bangkok' check (timezone = 'Asia/Bangkok'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80), type public.account_type not null,
  color text not null default '#2f7d5a' check (color ~ '^#[0-9a-fA-F]{6}$'), icon text not null default 'landmark',
  opening_balance_satangs bigint not null default 0, opening_balance_date date not null,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80), kind text not null check (kind in ('income','expense')),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'), icon text not null default 'tag',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id, kind, name), unique(id, owner_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  type public.transaction_type not null, status public.transaction_status not null default 'draft',
  account_id uuid, counter_account_id uuid, amount_satangs bigint not null check (amount_satangs > 0),
  flow_direction smallint not null check (flow_direction in (-1,1)), occurred_at timestamptz not null,
  description text not null check (char_length(description) between 1 and 160), note text check (char_length(note) <= 1000),
  payment_method text check (payment_method in ('cash','transfer','ewallet','other')), source public.transaction_source not null default 'manual',
  original_transaction_id uuid, replaces_transaction_id uuid, reversal_transaction_id uuid,
  idempotency_key uuid not null, posted_at timestamptz, voided_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,idempotency_key), unique(id,owner_id),
  foreign key (account_id,owner_id) references public.accounts(id,owner_id), foreign key(counter_account_id,owner_id) references public.accounts(id,owner_id),
  foreign key(original_transaction_id,owner_id) references public.transactions(id,owner_id), foreign key(replaces_transaction_id,owner_id) references public.transactions(id,owner_id),
  check (account_id is not null), check ((type='transfer' and counter_account_id is not null and counter_account_id<>account_id) or (type<>'transfer' and counter_account_id is null))
);
alter table public.transactions add constraint transactions_reversal_fk foreign key(reversal_transaction_id,owner_id) references public.transactions(id,owner_id);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid not null, account_id uuid not null, amount_satangs bigint not null check(amount_satangs<>0), occurred_at timestamptz not null,
  sequence bigint generated always as identity, created_at timestamptz not null default now(),
  foreign key(transaction_id,owner_id) references public.transactions(id,owner_id), foreign key(account_id,owner_id) references public.accounts(id,owner_id),
  unique(transaction_id,account_id)
);

create table public.transaction_splits (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid not null, category_id uuid not null, amount_satangs bigint not null check(amount_satangs>0), created_at timestamptz not null default now(),
  foreign key(transaction_id,owner_id) references public.transactions(id,owner_id) on delete cascade,
  foreign key(category_id,owner_id) references public.categories(id,owner_id), unique(transaction_id,category_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 50), color text not null default '#64748b', created_at timestamptz not null default now(), unique(owner_id,name), unique(id,owner_id)
);
create table public.transaction_tags (
  owner_id uuid not null references public.profiles(id) on delete cascade, transaction_id uuid not null, tag_id uuid not null,
  primary key(transaction_id,tag_id), foreign key(transaction_id,owner_id) references public.transactions(id,owner_id) on delete cascade,
  foreign key(tag_id,owner_id) references public.tags(id,owner_id) on delete cascade
);

create table public.documents (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_key text not null unique, original_name text not null check(char_length(original_name) between 1 and 255),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  byte_size bigint not null check(byte_size between 1 and 10485760), sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  status public.document_status not null default 'uploaded', extracted_data jsonb, corrected_data jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,sha256), unique(id,owner_id)
);
create table public.transaction_documents (
  owner_id uuid not null references public.profiles(id) on delete cascade, transaction_id uuid not null, document_id uuid not null,
  created_at timestamptz not null default now(), primary key(transaction_id,document_id), unique(document_id),
  foreign key(transaction_id,owner_id) references public.transactions(id,owner_id) on delete cascade,
  foreign key(document_id,owner_id) references public.documents(id,owner_id) on delete cascade
);
create table public.extraction_jobs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, document_id uuid not null,
  status public.job_status not null default 'queued', attempts integer not null default 0 check(attempts>=0), max_attempts integer not null default 3 check(max_attempts between 1 and 5),
  provider text, model text, error_code text, locked_at timestamptz, worker_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(document_id,owner_id) references public.documents(id,owner_id) on delete cascade, unique(document_id)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, category_id uuid,
  period_start date not null, period_end date not null, amount_satangs bigint not null check(amount_satangs>0),
  threshold_80_notified_at timestamptz, threshold_100_notified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(category_id,owner_id) references public.categories(id,owner_id), check(period_end>=period_start), unique(owner_id,category_id,period_start,period_end), unique(id,owner_id)
);
create unique index budgets_total_period_unique on public.budgets(owner_id,period_start,period_end) where category_id is null;

create table public.reservations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, account_id uuid not null,
  purpose text not null check(char_length(purpose) between 1 and 160), amount_satangs bigint not null check(amount_satangs>0),
  status public.reservation_status not null default 'active', reserved_transaction_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(account_id,owner_id) references public.accounts(id,owner_id), foreign key(reserved_transaction_id,owner_id) references public.transactions(id,owner_id),
  unique(reserved_transaction_id), unique(id,owner_id)
);
create table public.reconciliations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, account_id uuid not null,
  statement_balance_satangs bigint not null, system_balance_satangs bigint not null, difference_satangs bigint generated always as (statement_balance_satangs-system_balance_satangs) stored,
  reconciled_at timestamptz not null, note text check(char_length(note)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(account_id,owner_id) references public.accounts(id,owner_id), unique(id,owner_id)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, actor_id uuid not null,
  event_type text not null, entity_type text not null, entity_id uuid not null, before_data jsonb, after_data jsonb,
  reason text check(char_length(reason)<=500), correlation_id uuid not null, created_at timestamptz not null default now()
);

create index ledger_account_timeline on public.ledger_entries(owner_id,account_id,occurred_at,sequence);
create index transactions_owner_timeline on public.transactions(owner_id,occurred_at desc,created_at desc);
create index transactions_owner_status on public.transactions(owner_id,status,type);
create index documents_owner_status on public.documents(owner_id,status,created_at desc);
create index extraction_jobs_queue on public.extraction_jobs(status,created_at) where status='queued';
create index audit_owner_entity on public.audit_logs(owner_id,entity_type,entity_id,created_at desc);
create index budgets_owner_period on public.budgets(owner_id,period_start,period_end);

create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['profiles','accounts','categories','transactions','documents','extraction_jobs','budgets','reservations','reconciliations'] loop execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t); end loop; end $$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80));
  insert into public.categories(owner_id,name,kind,color,icon) values
    (new.id,'อาหาร','expense','#e76f51','utensils'),(new.id,'เดินทาง','expense','#457b9d','bus'),(new.id,'ที่อยู่อาศัย','expense','#8d6e63','house'),
    (new.id,'ช้อปปิ้ง','expense','#9b5de5','shopping-bag'),(new.id,'สุขภาพ','expense','#ef476f','heart-pulse'),(new.id,'เงินเดือน','income','#2a9d8f','briefcase');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.audit_snapshot(payload jsonb) returns jsonb language sql immutable as $$
  select payload - array['extracted_data','corrected_data','storage_key','sha256']::text[]
$$;
create function public.write_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare owner uuid:=coalesce(new.owner_id,old.owner_id); entity uuid:=coalesce(new.id,old.id); request_id uuid;
begin
  request_id:=coalesce(nullif(current_setting('app.correlation_id',true),'')::uuid,gen_random_uuid());
  insert into public.audit_logs(owner_id,actor_id,event_type,entity_type,entity_id,before_data,after_data,reason,correlation_id)
  values(owner,coalesce(auth.uid(),owner),lower(tg_op),tg_table_name,entity,
    case when tg_op<>'INSERT' then public.audit_snapshot(to_jsonb(old)) end,
    case when tg_op<>'DELETE' then public.audit_snapshot(to_jsonb(new)) end,
    null,request_id);
  return coalesce(new,old);
end $$;
do $$ declare t text; begin foreach t in array array['accounts','categories','budgets','reservations','reconciliations'] loop execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.write_audit()',t,t); end loop; end $$;

create view public.account_balances with (security_invoker=true) as
select a.owner_id,a.id account_id,
  (a.opening_balance_satangs+coalesce(sum(le.amount_satangs),0))::text balance_satangs,
  coalesce((select sum(r.amount_satangs) from public.reservations r where r.owner_id=a.owner_id and r.account_id=a.id and r.status='active'),0)::text reserved_satangs,
  (a.opening_balance_satangs+coalesce(sum(le.amount_satangs),0)-coalesce((select sum(r.amount_satangs) from public.reservations r where r.owner_id=a.owner_id and r.account_id=a.id and r.status='active'),0))::text available_satangs
from public.accounts a left join public.ledger_entries le on le.owner_id=a.owner_id and le.account_id=a.id group by a.owner_id,a.id;

create view public.monthly_cashflow with (security_invoker=true) as
select owner_id,date_trunc('month',occurred_at at time zone 'Asia/Bangkok')::date month_start,
  coalesce(sum(amount_satangs) filter(where type='income'),0)::text income_satangs,
  greatest(0,coalesce(sum(amount_satangs) filter(where type='expense'),0)-coalesce(sum(amount_satangs) filter(where type='refund'),0))::text expense_satangs
from public.transactions where status='posted' group by owner_id,date_trunc('month',occurred_at at time zone 'Asia/Bangkok');

create function public.assert_owner(p_owner uuid) returns void language plpgsql stable security invoker as $$ begin if auth.uid() is null or auth.uid()<>p_owner then raise exception 'not authorized' using errcode='42501'; end if; end $$;

create function public.post_transaction(p_transaction_id uuid,p_idempotency_key uuid,p_correlation_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.transactions; split_total bigint;
begin
  perform set_config('app.correlation_id',p_correlation_id::text,true);
  select * into t from public.transactions where id=p_transaction_id for update;
  if not found then raise exception 'transaction not found'; end if; perform public.assert_owner(t.owner_id);
  if t.status='posted' then return t.id; end if; if t.status<>'draft' then raise exception 'only drafts can be posted'; end if;
  select sum(amount_satangs) into split_total from public.transaction_splits where transaction_id=t.id;
  if split_total is not null and split_total<>t.amount_satangs then raise exception 'split total must equal transaction total' using errcode='23514'; end if;
  perform 1 from public.accounts where id=t.account_id and owner_id=t.owner_id for update;
  insert into public.ledger_entries(owner_id,transaction_id,account_id,amount_satangs,occurred_at) values(t.owner_id,t.id,t.account_id,t.amount_satangs*t.flow_direction,t.occurred_at);
  update public.transactions set status='posted',posted_at=now() where id=t.id;
  insert into public.audit_logs(owner_id,actor_id,event_type,entity_type,entity_id,after_data,correlation_id) values(t.owner_id,auth.uid(),'posted','transactions',t.id,jsonb_build_object('amount_satangs',t.amount_satangs::text,'account_id',t.account_id),p_correlation_id);
  return t.id;
end $$;

create function public.create_transaction(p_account_id uuid,p_type public.transaction_type,p_amount_satangs bigint,p_occurred_at timestamptz,p_description text,p_note text,p_category_id uuid,p_payment_method text,p_status public.transaction_status,p_source public.transaction_source,p_idempotency_key uuid,p_correlation_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); result uuid; direction smallint;
begin
  if owner is null then raise exception 'not authorized' using errcode='42501'; end if;
  if p_type in ('transfer','reversal') then raise exception 'use dedicated operation'; end if;
  perform 1 from public.accounts where id=p_account_id and owner_id=owner and is_active; if not found then raise exception 'account not found'; end if;
  direction:=case when p_type in ('income','refund') then 1 else -1 end;
  insert into public.transactions(owner_id,type,status,account_id,amount_satangs,flow_direction,occurred_at,description,note,payment_method,source,idempotency_key)
  values(owner,p_type,'draft',p_account_id,p_amount_satangs,direction,p_occurred_at,p_description,p_note,p_payment_method,p_source,p_idempotency_key) returning id into result;
  if p_category_id is not null then
    perform 1 from public.categories where id=p_category_id and owner_id=owner; if not found then raise exception 'category not found'; end if;
    insert into public.transaction_splits(owner_id,transaction_id,category_id,amount_satangs) values(owner,result,p_category_id,p_amount_satangs);
  end if;
  if p_status='posted' then perform public.post_transaction(result,p_idempotency_key,p_correlation_id); end if;
  return result;
exception when unique_violation then select id into result from public.transactions where owner_id=owner and idempotency_key=p_idempotency_key; return result;
end $$;

create function public.create_transfer(p_source_account_id uuid,p_destination_account_id uuid,p_amount_satangs bigint,p_fee_satangs bigint,p_occurred_at timestamptz,p_description text,p_idempotency_key uuid,p_correlation_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); result uuid; fee_id uuid;
begin
  if owner is null or p_source_account_id=p_destination_account_id or p_amount_satangs<=0 or p_fee_satangs<0 then raise exception 'invalid transfer'; end if;
  perform 1 from public.accounts where id in(p_source_account_id,p_destination_account_id) and owner_id=owner and is_active order by id for update;
  if (select count(*) from public.accounts where id in(p_source_account_id,p_destination_account_id) and owner_id=owner and is_active)<>2 then raise exception 'account not found'; end if;
  insert into public.transactions(owner_id,type,status,account_id,counter_account_id,amount_satangs,flow_direction,occurred_at,description,source,idempotency_key,posted_at)
  values(owner,'transfer','posted',p_source_account_id,p_destination_account_id,p_amount_satangs,-1,p_occurred_at,p_description,'manual',p_idempotency_key,now()) returning id into result;
  insert into public.ledger_entries(owner_id,transaction_id,account_id,amount_satangs,occurred_at) values(owner,result,p_source_account_id,-p_amount_satangs,p_occurred_at),(owner,result,p_destination_account_id,p_amount_satangs,p_occurred_at);
  if p_fee_satangs>0 then
    fee_id:=public.create_transaction(p_source_account_id,'expense',p_fee_satangs,p_occurred_at,'ค่าธรรมเนียม: '||p_description,null,null,'transfer','posted','manual',gen_random_uuid(),p_correlation_id);
  end if;
  insert into public.audit_logs(owner_id,actor_id,event_type,entity_type,entity_id,after_data,correlation_id) values(owner,owner,'transferred','transactions',result,jsonb_build_object('amount_satangs',p_amount_satangs::text,'fee_transaction_id',fee_id),p_correlation_id);
  return result;
exception when unique_violation then select id into result from public.transactions where owner_id=owner and idempotency_key=p_idempotency_key; return result;
end $$;

create function public.void_posted_transaction(p_transaction_id uuid,p_reason text,p_idempotency_key uuid,p_correlation_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); original public.transactions; reversal uuid;
begin
  select * into original from public.transactions where id=p_transaction_id and owner_id=owner for update;
  if not found or original.status<>'posted' or original.reversal_transaction_id is not null then raise exception 'transaction cannot be voided'; end if;
  insert into public.transactions(owner_id,type,status,account_id,amount_satangs,flow_direction,occurred_at,description,note,source,original_transaction_id,idempotency_key,posted_at)
  values(owner,'reversal','posted',original.account_id,original.amount_satangs,-original.flow_direction,now(),'กลับรายการ: '||original.description,p_reason,'manual',original.id,p_idempotency_key,now()) returning id into reversal;
  insert into public.ledger_entries(owner_id,transaction_id,account_id,amount_satangs,occurred_at) select owner,reversal,account_id,-amount_satangs,now() from public.ledger_entries where transaction_id=original.id;
  update public.transactions set status='voided',voided_at=now(),reversal_transaction_id=reversal where id=original.id;
  insert into public.audit_logs(owner_id,actor_id,event_type,entity_type,entity_id,before_data,after_data,reason,correlation_id) values(owner,owner,'voided','transactions',original.id,jsonb_build_object('status','posted'),jsonb_build_object('status','voided','reversal_transaction_id',reversal),p_reason,p_correlation_id);
  return reversal;
end $$;

create function public.confirm_document_transaction(p_document_ids uuid[],p_account_id uuid,p_type text,p_amount_satangs bigint,p_occurred_at timestamptz,p_description text,p_category_id uuid,p_corrected_data jsonb,p_idempotency_key uuid,p_correlation_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); result uuid; document_id uuid;
begin
  if p_type not in ('income','expense') or cardinality(p_document_ids)<1 then raise exception 'invalid confirmation'; end if;
  perform 1 from public.documents d where d.id=any(p_document_ids) and d.owner_id=owner for update;
  if (select count(*) from public.documents d where d.id=any(p_document_ids) and d.owner_id=owner)<>cardinality(p_document_ids) then raise exception 'document not found'; end if;
  if exists(select 1 from public.transaction_documents where document_id=any(p_document_ids)) then raise exception 'document already attached'; end if;
  result:=public.create_transaction(p_account_id,p_type::public.transaction_type,p_amount_satangs,p_occurred_at,p_description,null,p_category_id,null,'posted','ocr',p_idempotency_key,p_correlation_id);
  foreach document_id in array p_document_ids loop insert into public.transaction_documents(owner_id,transaction_id,document_id) values(owner,result,document_id); end loop;
  update public.documents set status='attached',corrected_data=p_corrected_data where id=any(p_document_ids);
  insert into public.audit_logs(owner_id,actor_id,event_type,entity_type,entity_id,after_data,correlation_id) select owner,owner,'attached','documents',unnest(p_document_ids),jsonb_build_object('transaction_id',result),p_correlation_id;
  return result;
end $$;

create function public.claim_extraction_job(p_worker_id uuid) returns public.extraction_jobs language plpgsql security definer set search_path='' as $$
declare job public.extraction_jobs;
begin
  select * into job from public.extraction_jobs where status='queued' and attempts<max_attempts order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.extraction_jobs set status='processing',attempts=attempts+1,locked_at=now(),worker_id=p_worker_id where id=job.id returning * into job;
  update public.documents set status='processing' where id=job.document_id;
  return job;
end $$;
create function public.complete_extraction_job(p_job_id uuid,p_extracted_data jsonb,p_provider text,p_model text) returns void language plpgsql security definer set search_path='' as $$
declare document uuid; begin update public.extraction_jobs set status='needs_review',provider=p_provider,model=p_model,error_code=null,locked_at=null where id=p_job_id returning document_id into document; update public.documents set status='needs_review',extracted_data=p_extracted_data where id=document; end $$;
create function public.fail_extraction_job(p_job_id uuid,p_error_code text) returns void language plpgsql security definer set search_path='' as $$
declare job public.extraction_jobs; begin select * into job from public.extraction_jobs where id=p_job_id for update; if not found then return; end if; if job.attempts<job.max_attempts then update public.extraction_jobs set status='queued',error_code=left(p_error_code,120),locked_at=null where id=p_job_id; update public.documents set status='queued' where id=job.document_id; else update public.extraction_jobs set status='failed',error_code=left(p_error_code,120),locked_at=null where id=p_job_id; update public.documents set status='failed' where id=job.document_id; end if; end $$;

alter table public.profiles enable row level security;
do $$ declare t text; begin foreach t in array array['accounts','categories','transactions','ledger_entries','transaction_splits','tags','transaction_tags','documents','transaction_documents','extraction_jobs','budgets','reservations','reconciliations','audit_logs'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy profiles_owner on public.profiles for all using(id=auth.uid()) with check(id=auth.uid());
do $$ declare t text; begin foreach t in array array['accounts','categories','transactions','transaction_splits','tags','transaction_tags','documents','transaction_documents','budgets','reservations','reconciliations'] loop execute format('create policy %I_owner on public.%I for all using(owner_id=auth.uid()) with check(owner_id=auth.uid())',t,t); end loop; end $$;
create policy ledger_read on public.ledger_entries for select using(owner_id=auth.uid());
create policy jobs_read on public.extraction_jobs for select using(owner_id=auth.uid());
create policy audit_read on public.audit_logs for select using(owner_id=auth.uid());

revoke insert,update,delete on public.ledger_entries,public.audit_logs,public.extraction_jobs from anon,authenticated;
grant select on public.account_balances,public.monthly_cashflow to authenticated;
grant execute on function public.create_transaction to authenticated;
grant execute on function public.post_transaction to authenticated;
grant execute on function public.create_transfer to authenticated;
grant execute on function public.void_posted_transaction to authenticated;
grant execute on function public.confirm_document_transaction to authenticated;
revoke all on function public.claim_extraction_job from public,anon,authenticated;
revoke all on function public.complete_extraction_job from public,anon,authenticated;
revoke all on function public.fail_extraction_job from public,anon,authenticated;
grant execute on function public.claim_extraction_job to service_role;
grant execute on function public.complete_extraction_job to service_role;
grant execute on function public.fail_extraction_job to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evidence','evidence',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy evidence_select on storage.objects for select to authenticated using(bucket_id='evidence' and (storage.foldername(name))[1]=auth.uid()::text);
create policy evidence_insert on storage.objects for insert to authenticated with check(bucket_id='evidence' and (storage.foldername(name))[1]=auth.uid()::text);
create policy evidence_delete on storage.objects for delete to authenticated using(bucket_id='evidence' and (storage.foldername(name))[1]=auth.uid()::text);

commit;
