-- The starting position is a reading goal, never a scoring shortcut.
alter table public.documents add column reading_start integer not null default 0 check(reading_start>=0 and reading_start<total);
alter table public.documents add column completed_at timestamptz;
update public.documents d set completed_at=now() where d.total=(select count(*) from public.presented p where p.user_id=d.user_id and p.hash=d.hash);
create function public.complete_reading(p_user uuid,p_hash text) returns void language sql security definer set search_path=public as $$
 update documents d set completed_at=now() where d.user_id=p_user and d.hash=p_hash and d.completed_at is null
 and d.total-d.reading_start=(select count(*) from presented p where p.user_id=d.user_id and p.hash=d.hash and p.position>=d.reading_start);
$$;
create function public.set_reading_start(p_hash text,p_total integer,p_start integer) returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=ensure_profile(); existing_total integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_total is null or p_total<1 or p_total>1000000 or p_start is null or p_start<0 or p_start>=p_total then raise exception 'Início de leitura inválido';end if;
 insert into documents(user_id,hash,total) values(u,p_hash,p_total) on conflict do nothing;
 select total into existing_total from documents where user_id=u and hash=p_hash;
 if existing_total<>p_total then raise exception 'Documento inconsistente: a extração já sincronizada não pode ser substituída';end if;
 update documents set reading_start=p_start where user_id=u and hash=p_hash;
 perform complete_reading(u,p_hash);
end$$;
alter function public.submit_session(uuid,text,integer,integer[],integer,bigint) rename to submit_session_words;
revoke execute on function public.submit_session_words(uuid,text,integer,integer[],integer,bigint) from public,anon,authenticated;
create function public.submit_session(p_id uuid,p_hash text,p_total integer,p_positions integer[],p_wpm integer,p_active_ms bigint) returns integer language plpgsql security definer set search_path=public as $$
declare inserted integer;u uuid:=ensure_profile();begin
 inserted:=submit_session_words(p_id,p_hash,p_total,p_positions,p_wpm,p_active_ms);
 perform complete_reading(u,p_hash);
 return inserted;
end$$;
create or replace function public.my_profile() returns table(username text,premium_until timestamptz,total_words bigint,completed_pdfs bigint) language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile();begin return query select p.username,p.premium_until,(select count(*) from scored where user_id=u),(select count(*) from documents d where d.user_id=u and d.completed_at is not null) from profiles p where p.id=u;end$$;
revoke execute on function public.complete_reading(uuid,text),public.set_reading_start(text,integer,integer),public.submit_session(uuid,text,integer,integer[],integer,bigint) from public,anon,authenticated;
grant execute on function public.set_reading_start(text,integer,integer),public.submit_session(uuid,text,integer,integer[],integer,bigint) to authenticated;
