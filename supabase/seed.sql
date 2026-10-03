-- Local-development seed. Sign up once first; the auth trigger creates categories.
-- This creates one sample cash account for each local user and never creates fake transactions.
insert into public.accounts(owner_id,name,type,color,icon,opening_balance_satangs,opening_balance_date)
select id,'เงินสดทดลอง','cash','#2f7d5a','banknote',0,current_date
from public.profiles p
where not exists(select 1 from public.accounts a where a.owner_id=p.id);
