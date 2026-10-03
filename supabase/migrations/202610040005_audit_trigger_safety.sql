begin;

create or replace function public.write_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare owner uuid; entity uuid; request_id uuid; before_value jsonb; after_value jsonb;
begin
  if tg_op='INSERT' then
    owner:=new.owner_id; entity:=new.id; after_value:=public.audit_snapshot(to_jsonb(new));
  elsif tg_op='DELETE' then
    owner:=old.owner_id; entity:=old.id; before_value:=public.audit_snapshot(to_jsonb(old));
  else
    owner:=new.owner_id; entity:=new.id; before_value:=public.audit_snapshot(to_jsonb(old)); after_value:=public.audit_snapshot(to_jsonb(new));
  end if;
  request_id:=coalesce(nullif(current_setting('app.correlation_id',true),'')::uuid,gen_random_uuid());
  insert into public.audit_logs(owner_id,actor_id,event_type,entity_type,entity_id,before_data,after_data,reason,correlation_id)
  values(owner,coalesce(auth.uid(),owner),lower(tg_op),tg_table_name,entity,before_value,after_value,null,request_id);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

commit;
