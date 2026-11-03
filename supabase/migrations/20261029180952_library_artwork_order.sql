-- Only private metadata. No images or local file paths.
create or replace function pdfast_private.library_put(p_revision bigint,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r bigint; d jsonb; e jsonb; s jsonb; a jsonb; n integer; last_end integer; k text;
begin
 if u is null or not exists(select 1 from auth.users where id=u) then raise exception 'Autenticação necessária'; end if;
 if p_revision is null or p_revision<0 or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>8388608
 or (p_data-'documents'-'shelves')<>'{}'::jsonb or jsonb_typeof(p_data->'documents') is distinct from 'array' or jsonb_typeof(p_data->'shelves') is distinct from 'array'
 or jsonb_array_length(p_data->'documents')>1000 or jsonb_array_length(p_data->'shelves')>500 then raise exception 'Biblioteca inválida'; end if;
 if (select count(*) from jsonb_array_elements(p_data->'documents'))<>(select count(distinct value->>'hash') from jsonb_array_elements(p_data->'documents')) then raise exception 'PDF duplicado';end if;
 if (select count(*) from jsonb_array_elements(p_data->'shelves'))<>(select count(distinct value->>'id') from jsonb_array_elements(p_data->'shelves')) then raise exception 'Estante duplicada';end if;
 for s in select value from jsonb_array_elements(p_data->'shelves') loop
  if jsonb_typeof(s)<>'object' or (s-'id'-'name')<>'{}'::jsonb or jsonb_typeof(s->'id') is distinct from 'string' or length(s->>'id') not between 1 and 100 or jsonb_typeof(s->'name') is distinct from 'string' or length(trim(s->>'name')) not between 1 and 60 then raise exception 'Estante inválida';end if;
 end loop;
 for e in select value from jsonb_array_elements(p_data->'documents') loop
  if jsonb_typeof(e)<>'object' or (e-'hash'-'title'-'customTitle'-'total'-'extractionVersion'-'pageCount'-'position'-'readingStart'-'seen'-'completed'-'shelfId'-'libraryOrder'-'coverPage')<>'{}'::jsonb
  or coalesce(e->>'hash','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(e->'title') is distinct from 'string' or length(e->>'title') not between 1 and 512 then raise exception 'PDF inválido';end if;
  foreach k in array array['total','extractionVersion','pageCount','position','readingStart'] loop
   if coalesce(e->>k,'') !~ '^[0-9]{1,7}$' then raise exception 'Índice inválido';end if;
  end loop;
  n:=(e->>'total')::integer;
  if n not between 1 and 1000000 or (e->>'extractionVersion')::integer not between 1 and 3 or (e->>'pageCount')::integer not between 1 and 100000
   or (e->>'position')::integer>=n or (e->>'readingStart')::integer>=n or jsonb_typeof(e->'seen') is distinct from 'array'
   or jsonb_typeof(e->'customTitle') is distinct from 'boolean' or jsonb_typeof(e->'completed') is distinct from 'boolean'
   or jsonb_typeof(e->'shelfId') is distinct from 'string' then raise exception 'Progresso inválido';end if;
  if e->>'shelfId'<>'' and not exists(select 1 from jsonb_array_elements(p_data->'shelves') sh where sh->>'id'=e->>'shelfId') then raise exception 'Estante inexistente';end if;
  if e ? 'libraryOrder' and (jsonb_typeof(e->'libraryOrder') is distinct from 'number' or coalesce(e->>'libraryOrder','') !~ '^[0-9]{1,12}$') then raise exception 'Ordem inválida';end if;
  if e ? 'coverPage' and (jsonb_typeof(e->'coverPage') is distinct from 'number' or coalesce(e->>'coverPage','') !~ '^[0-9]{1,6}$' or (e->>'coverPage')::integer>(e->>'pageCount')::integer) then raise exception 'Capa inválida';end if;
  last_end:=-1;
  for a in select value from jsonb_array_elements(e->'seen') loop
   if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>2 or coalesce(a->>0,'') !~ '^[0-9]{1,7}$' or coalesce(a->>1,'') !~ '^[0-9]{1,7}$'
    or (a->>0)::integer<=last_end or (a->>0)::integer>(a->>1)::integer or (a->>1)::integer>=n then raise exception 'Histórico inválido';end if;
   last_end:=(a->>1)::integer;
  end loop;
  if exists(select 1 from public.documents where user_id=u and hash=e->>'hash' and total<>n) then raise exception 'Extração incompatível com a pontuação existente';end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended('library:'||u::text,0));
 insert into pdfast_private.libraries(user_id) values(u) on conflict do nothing;
 select revision,data into r,d from pdfast_private.libraries where user_id=u for update;
 if r<>p_revision then return pdfast_private.library_get()||'{"accepted":false}'::jsonb;end if;
 -- Once the catalog or competitive history has a canonical sequence, never silently replace it.
 if exists(select 1 from jsonb_array_elements(p_data->'documents') x join jsonb_array_elements(d->'documents') y on x->>'hash'=y->>'hash'
 where (x->>'total'<>y->>'total' or x->>'extractionVersion'<>y->>'extractionVersion') and exists(select 1 from public.documents where user_id=u and hash=x->>'hash')) then raise exception 'Extração registrada não pode ser substituída';end if;
 -- Older clients omit these fields: retain the most recent metadata.
 select jsonb_set(p_data,'{documents}',coalesce(jsonb_agg(
   x || case when x ? 'libraryOrder' then '{}'::jsonb else jsonb_build_object('libraryOrder',coalesce(y->'libraryOrder',to_jsonb((ord-1)::bigint))) end
     || case when x ? 'coverPage' then '{}'::jsonb else jsonb_build_object('coverPage',coalesce(y->'coverPage','0'::jsonb)) end
   order by ord),'[]'::jsonb)) into p_data
 from jsonb_array_elements(p_data->'documents') with ordinality incoming(x,ord)
 left join lateral (select value y from jsonb_array_elements(d->'documents') where value->>'hash'=x->>'hash') old on true;
 update pdfast_private.libraries set data=p_data,revision=r+1 where user_id=u;
 return pdfast_private.library_get()||'{"accepted":true}'::jsonb;
end$$;
