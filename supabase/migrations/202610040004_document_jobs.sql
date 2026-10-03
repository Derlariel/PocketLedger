begin;

create policy evidence_delete_orphan on storage.objects for delete to authenticated
using (
  bucket_id='evidence'
  and (storage.foldername(name))[1]=auth.uid()::text
  and not exists(select 1 from public.documents d where d.owner_id=auth.uid() and d.storage_key=name)
);

create function public.enqueue_extraction_job(p_document_id uuid,p_max_attempts integer) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); result uuid;
begin
  if owner is null or p_max_attempts not between 1 and 5 then raise exception 'invalid job'; end if;
  perform 1 from public.documents where id=p_document_id and owner_id=owner and status='queued' for update;
  if not found then raise exception 'document not found'; end if;
  insert into public.extraction_jobs(owner_id,document_id,status,max_attempts) values(owner,p_document_id,'queued',p_max_attempts)
  on conflict(document_id) do update set updated_at=now() returning id into result;
  return result;
end $$;
grant execute on function public.enqueue_extraction_job to authenticated;

commit;
