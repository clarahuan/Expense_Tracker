-- Run once in your own Supabase SQL Editor. No service_role key is needed by the website.
begin;
create table if not exists public.qj_documents (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('entry','settings','import')),
  payload jsonb not null,
  deleted boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(owner_id,id),
  constraint valid_entry check (kind <> 'entry' or (
    payload ?& array['cents','type','date','category'] and
    jsonb_typeof(payload->'cents') = 'number' and
    (payload->>'cents')::numeric = trunc((payload->>'cents')::numeric) and
    (payload->>'cents')::numeric between 1 and 10000000000 and
    payload->>'type' in ('income','expense') and
    length(payload->>'date') = 16 and length(payload->>'category') > 0
  ))
);
create table if not exists public.qj_mutations (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(owner_id,mutation_id)
);
alter table public.qj_documents enable row level security;
alter table public.qj_mutations enable row level security;
revoke all on public.qj_documents,public.qj_mutations from anon;
grant select,insert,update on public.qj_documents to authenticated;
grant select,insert on public.qj_mutations to authenticated;
drop policy if exists own_documents on public.qj_documents;
create policy own_documents on public.qj_documents for all to authenticated
using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
drop policy if exists own_mutations on public.qj_mutations;
create policy own_mutations on public.qj_mutations for all to authenticated
using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);

create or replace function public.qj_apply_document(
  p_id uuid, p_kind text, p_payload jsonb, p_deleted boolean,
  p_base_revision bigint, p_mutation uuid
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_doc public.qj_documents; answer jsonb; prior jsonb;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  -- Serialize the same mutation across documents, then the document itself.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_mutation::text, 0));
  select result into prior from public.qj_mutations where owner_id=auth.uid() and mutation_id=p_mutation;
  if found then return prior; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_id::text, 1));
  select * into current_doc from public.qj_documents where owner_id=auth.uid() and id=p_id for update;
  if (found and current_doc.revision <> p_base_revision) or (not found and p_base_revision <> 0) then
    return jsonb_build_object('status','conflict','current',case when current_doc.id is null then null else to_jsonb(current_doc) end);
  end if;
  if current_doc.id is null then
    insert into public.qj_documents(owner_id,id,kind,payload,deleted)
    values(auth.uid(),p_id,p_kind,p_payload,p_deleted) returning * into current_doc;
  else
    update public.qj_documents set kind=p_kind,payload=p_payload,deleted=p_deleted,
      revision=revision+1,updated_at=now()
    where owner_id=auth.uid() and id=p_id returning * into current_doc;
  end if;
  answer=jsonb_build_object('status','saved','document',to_jsonb(current_doc));
  insert into public.qj_mutations(owner_id,mutation_id,result) values(auth.uid(),p_mutation,answer);
  return answer;
end $$;
revoke all on function public.qj_apply_document(uuid,text,jsonb,boolean,bigint,uuid) from public,anon;
grant execute on function public.qj_apply_document(uuid,text,jsonb,boolean,bigint,uuid) to authenticated;
commit;
