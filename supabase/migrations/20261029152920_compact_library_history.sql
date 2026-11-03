-- Keep large reading histories compact; positions and scoring remain unchanged.
create or replace function pdfast_private.library_get() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); d jsonb; r bigint; validated jsonb;
begin
 if u is null or not exists(select 1 from auth.users where id=u) then raise exception 'Autenticação necessária'; end if;
 select data,revision into d,r from pdfast_private.libraries where user_id=u;
 d:=coalesce(d,'{"documents":[],"shelves":[]}'::jsonb);
 select coalesce(jsonb_object_agg(e->>'hash',p.positions),'{}'::jsonb) into validated
 from jsonb_array_elements(d->'documents') e
 join public.documents doc on doc.user_id=u and doc.hash=e->>'hash' and doc.total=(e->>'total')::integer
 cross join lateral (
  select coalesce(jsonb_agg(jsonb_build_array(first_position,last_position) order by first_position),'[]'::jsonb) positions
  from (select min(position) first_position,max(position) last_position
    from (select position,position-row_number() over(order by position) as run from public.presented where user_id=u and hash=doc.hash) ordered
    group by run) intervals
 ) p;
 return jsonb_build_object('revision',coalesce(r,0),'data',d,'presented',validated);
end$$;
