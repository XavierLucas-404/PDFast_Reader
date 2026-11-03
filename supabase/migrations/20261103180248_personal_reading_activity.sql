-- Personal activity is independent of competitive points. Legacy rows stay undated.
alter table public.presented add column first_read_at timestamptz, add column read_day date, add column read_zone text;
alter table public.presented add constraint activity_stamp_complete check ((first_read_at is null and read_day is null and read_zone is null) or (first_read_at is not null and read_day is not null and read_zone is not null));
create index presented_daily on public.presented(user_id,read_day) where read_day is not null;
create function public.record_activity_baseline(p_hash text,p_total integer,p_positions integer[]) returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=ensure_profile();begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if p_positions is null or cardinality(p_positions)>1000000 or exists(select 1 from unnest(p_positions) x where x is null or x<0 or x>=p_total) or not exists(select 1 from documents where user_id=u and hash=p_hash and total=p_total) then raise exception 'Invalid baseline';end if;
 insert into presented(user_id,hash,position) select u,p_hash,x from unnest(p_positions) x on conflict do nothing;
 perform complete_reading(u,p_hash);
end$$;
create function public.submit_reading_activity(p_id uuid,p_hash text,p_total integer,p_positions integer[],p_wpm integer,p_active_ms bigint,p_started_at timestamptz,p_day date,p_zone text) returns integer language plpgsql security definer set search_path=public as $$
declare u uuid:=ensure_profile(); n integer; added integer;begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if exists(select 1 from sessions where id=p_id and user_id<>u) then raise exception 'Session owner mismatch';end if;
 if exists(select 1 from sessions where id=p_id and user_id=u) then return 0;end if;
 n:=cardinality(p_positions);
 if p_id is null or p_hash is null or p_hash!~'^[a-f0-9]{64}$' or p_total is null or p_total<1 or p_total>1000000 or p_positions is null or n<1 or n>1000 or p_wpm is null or p_wpm<100 or p_wpm>1000 or p_active_ms is null or p_active_ms<ceil(n*60000.0/p_wpm) or p_active_ms>86400000 or exists(select 1 from unnest(p_positions) x where x is null or x<0 or x>=p_total) then raise exception 'Invalid reading activity';end if;
 if not ((p_started_at is null and p_day is null and p_zone is null) or (p_started_at is not null and p_day is not null and p_zone is not null)) then raise exception 'Incomplete activity date';end if;
 if p_started_at is not null then
  if not exists(select 1 from pg_timezone_names where name=p_zone) or p_started_at>now()+interval '5 minutes' then raise exception 'Invalid activity timezone or date';end if;
  if (p_started_at at time zone p_zone)::date<>p_day then raise exception 'Activity day mismatch';end if;
 end if;
 if not exists(select 1 from documents where user_id=u and hash=p_hash and total=p_total) then raise exception 'Document mismatch';end if;
 insert into sessions(id,user_id) values(p_id,u);
 insert into presented(user_id,hash,position,first_read_at,read_day,read_zone) select distinct u,p_hash,x,p_started_at,p_day,p_zone from unnest(p_positions) x on conflict do nothing;
 get diagnostics added=row_count;
 -- Rereads never date legacy words. Earlier offline dated observations may correct a dated word.
 update presented set first_read_at=p_started_at,read_day=p_day,read_zone=p_zone where user_id=u and hash=p_hash and position=any(p_positions) and first_read_at is not null and p_started_at<first_read_at;
 perform complete_reading(u,p_hash);
 return added;
end$$;
create function public.reading_progress() returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=ensure_profile(); result jsonb;begin
 select jsonb_build_object('daily',coalesce((select jsonb_object_agg(dkey,n) from(select read_day::text as dkey,count(*) n from presented where user_id=u and read_day is not null group by read_day)t),'{}'::jsonb),'undated',(select count(*) from presented where user_id=u and read_day is null),'known',coalesce((select jsonb_object_agg(hash,ranges) from(select hash,jsonb_agg(jsonb_build_array(lo,hi) order by lo) ranges from(select hash,min(position) lo,max(position) hi from(select hash,position,position-row_number() over(partition by hash order by position) g from presented where user_id=u)t group by hash,g)t group by hash)t),'{}'::jsonb)) into result;
 return result;
end$$;
revoke execute on function public.record_activity_baseline(text,integer,integer[]),public.submit_reading_activity(uuid,text,integer,integer[],integer,bigint,timestamptz,date,text),public.reading_progress() from public,anon;
grant execute on function public.record_activity_baseline(text,integer,integer[]),public.submit_reading_activity(uuid,text,integer,integer[],integer,bigint,timestamptz,date,text),public.reading_progress() to authenticated;
