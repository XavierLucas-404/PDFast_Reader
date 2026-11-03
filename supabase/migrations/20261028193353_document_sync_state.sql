-- A metadata-only preflight. No user may inspect another user's document state.
create schema if not exists pdfast_private;
revoke all on schema pdfast_private from public, anon;
grant usage on schema pdfast_private to authenticated;
create function pdfast_private.document_sync_state(p_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Autenticação necessária'; end if;
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Documento inválido'; end if;
  return exists(select 1 from public.documents where user_id = u and hash = p_hash);
end;
$$;
revoke all on function pdfast_private.document_sync_state(text) from public, anon, authenticated;
grant execute on function pdfast_private.document_sync_state(text) to authenticated;
create function public.document_sync_state(p_hash text)
returns boolean language sql security invoker set search_path = '' as $$
  select pdfast_private.document_sync_state(p_hash);
$$;
revoke all on function public.document_sync_state(text) from public, anon, authenticated;
grant execute on function public.document_sync_state(text) to authenticated;
