alter type public.account_type add value if not exists 'credit_card';

begin;

alter table public.accounts
  add column bank_id text check (bank_id is null or bank_id in ('bbl','kbank','ktb','scb')),
  add column bank_name text generated always as (case bank_id
    when 'bbl' then 'Bangkok Bank Public Company Limited'
    when 'kbank' then 'Kasikornbank Public Company Limited'
    when 'ktb' then 'Krung Thai Bank Public Company Limited'
    when 'scb' then 'Siam Commercial Bank Public Company Limited'
    else null end) stored,
  add column account_holder_name text check (account_holder_name is null or char_length(account_holder_name) between 1 and 120),
  add column account_number_last4 text check (account_number_last4 is null or account_number_last4 ~ '^[0-9]{4}$'),
  add column note text check (note is null or char_length(note) <= 500),
  add column currency text not null default 'THB' check (currency = 'THB'),
  add column creation_key uuid;

alter table public.accounts
  add constraint accounts_bank_required check (
    (type::text = 'bank' and bank_id is not null) or
    (type::text <> 'bank' and bank_id is null)
  ) not valid,
  add constraint accounts_owner_creation_key unique (owner_id, creation_key);

comment on column public.accounts.account_number_last4 is
  'Last four digits only. Never store a complete bank account or card number here.';

grant delete on public.accounts to authenticated;

commit;
