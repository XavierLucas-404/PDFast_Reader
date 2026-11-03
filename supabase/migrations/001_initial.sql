-- Metadata only. PDFs, titles and extracted text must never be uploaded.
create table public.profiles(id uuid primary key references auth.users on delete cascade, username text unique check(username ~ '^[a-z0-9_]{3,24}$'), premium_until timestamptz);
create table public.friendships(id uuid primary key default gen_random_uuid(), sender uuid not null references public.profiles on delete cascade, recipient uuid not null references public.profiles on delete cascade, status text not null default 'pending' check(status in ('pending','accepted')), check(sender<>recipient));
create unique index friendship_pair on public.friendships(least(sender,recipient),greatest(sender,recipient));
create table public.documents(user_id uuid references public.profiles on delete cascade, hash text check(hash ~ '^[a-f0-9]{64}$'), total integer not null check(total>0 and total<=1000000), primary key(user_id,hash));
create table public.sessions(id uuid primary key, user_id uuid not null references public.profiles on delete cascade, received_at timestamptz not null default now());
create table public.presented(user_id uuid, hash text, position integer, primary key(user_id,hash,position), foreign key(user_id,hash) references public.documents on delete cascade);
create table public.scored(user_id uuid, hash text, position integer, week timestamptz not null, primary key(user_id,hash,position), foreign key(user_id,hash) references public.documents on delete cascade);
create index scored_week on public.scored(week,user_id);
create table public.rewards(user_id uuid references public.profiles on delete cascade, week timestamptz, placement integer check(placement between 1 and 3), primary key(user_id,week));
create table public.closed_weeks(week timestamptz primary key);
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.documents enable row level security;
alter table public.sessions enable row level security;
alter table public.presented enable row level security;
alter table public.scored enable row level security;
alter table public.rewards enable row level security;
alter table public.closed_weeks enable row level security;
-- No direct table access. All access goes through restricted functions.
revoke all on public.profiles,public.friendships,public.documents,public.sessions,public.presented,public.scored,public.rewards,public.closed_weeks from anon,authenticated;
create function public.utc_week(p_time timestamptz) returns timestamptz language sql immutable set search_path=public as $$select date_trunc('week',p_time at time zone 'UTC') at time zone 'UTC'$$;
create function public.ensure_profile() returns uuid language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); begin if u is null then raise exception 'Autenticação necessária'; end if; insert into profiles(id) values(u) on conflict do nothing; return u; end $$;
create function public.set_username(p_username text) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile(); begin update profiles set username=lower(trim(p_username)) where id=u; end$$;
create function public.search_profiles(p_query text) returns table(id uuid,username text) language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile(); begin if length(trim(p_query))<3 then raise exception 'Digite pelo menos 3 caracteres';end if; return query select p.id,p.username from profiles p where p.id<>u and p.username like replace(replace(lower(trim(p_query)),'%','\%'),'_','\_')||'%' limit 20;end$$;
create function public.request_friend(p_target uuid) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile();begin if p_target=u then raise exception 'Escolha outro usuário';end if; if not exists(select 1 from profiles where id=u and username is not null) then raise exception 'Defina seu nome de usuário no Perfil';end if;insert into friendships(sender,recipient) values(u,p_target) on conflict do nothing;end$$;
create function public.respond_friend(p_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile();begin if p_accept then update friendships set status='accepted' where id=p_id and recipient=u and status='pending';else delete from friendships where id=p_id and recipient=u and status='pending';end if;end$$;
create function public.remove_friend(p_id uuid) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile();begin delete from friendships where id=p_id and u in(sender,recipient);end$$;
create function public.list_friends() returns table(id uuid,username text,status text,incoming boolean) language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile();begin return query select f.id,p.username,f.status,f.recipient=u from friendships f join profiles p on p.id=case when f.sender=u then f.recipient else f.sender end where u in(f.sender,f.recipient);end$$;
create function public.submit_session(p_id uuid,p_hash text,p_total integer,p_positions integer[],p_wpm integer,p_active_ms bigint) returns integer language plpgsql security definer set search_path=public as $$
declare u uuid:=ensure_profile(); inserted integer; previous_total integer; count_positions integer;begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if exists(select 1 from sessions where id=p_id and user_id=u) then return 0;end if;
 if p_hash is null or p_total is null or p_positions is null or p_wpm is null or p_active_ms is null or p_total<1 or p_total>1000000 or p_hash !~ '^[a-f0-9]{64}$' or p_wpm<100 or p_wpm>800 or p_active_ms<0 or p_active_ms>86400000 then raise exception 'Sessão inválida';end if;
 count_positions:=cardinality(p_positions);
 if count_positions<1 or count_positions>1000 or exists(select 1 from unnest(p_positions) x where x is null or x<0 or x>=p_total) then raise exception 'Posições inválidas';end if;
 if p_active_ms+1 < count_positions*60000.0/p_wpm then raise exception 'Duração insuficiente';end if;
 -- Receipt-time weekly attribution. Duration is client reported, not proof of comprehension.
 insert into documents(user_id,hash,total) values(u,p_hash,p_total) on conflict do nothing;
 select total into previous_total from documents where user_id=u and hash=p_hash;
 if previous_total<>p_total then raise exception 'Documento inconsistente';end if;
 insert into sessions(id,user_id) values(p_id,u);
 insert into presented(user_id,hash,position) select u,p_hash,x from unnest(p_positions) x on conflict do nothing;
 inserted:=0;
 if p_wpm<=600 then insert into scored(user_id,hash,position,week) select u,p_hash,x,utc_week(now()) from unnest(p_positions) x on conflict do nothing;get diagnostics inserted=row_count;end if;
 return inserted;
end$$;
create function public.weekly_ranking() returns table(id uuid,username text,words bigint,placement bigint) language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile();begin return query with members as(select u as id union select case when f.sender=u then f.recipient else f.sender end from friendships f where f.status='accepted' and u in(f.sender,f.recipient)), totals as(select p.id,coalesce(p.username,'leitor') as username,count(s.position) as words from members m join profiles p on p.id=m.id left join scored s on s.user_id=p.id and s.week=utc_week(now()) group by p.id) select t.id,t.username,t.words,rank() over(order by t.words desc) from totals t order by t.words desc,t.username;end$$;
create function public.my_profile() returns table(username text,premium_until timestamptz,total_words bigint,completed_pdfs bigint) language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile();begin return query select p.username,p.premium_until,(select count(*) from scored where user_id=u),(select count(*) from documents d where d.user_id=u and d.total=(select count(*) from presented r where r.user_id=u and r.hash=d.hash)) from profiles p where p.id=u;end$$;
create function public.my_rewards() returns table(week timestamptz,placement integer) language plpgsql security definer set search_path=public as $$declare u uuid:=ensure_profile();begin return query select r.week,r.placement from rewards r where r.user_id=u order by r.week desc;end$$;
create function public.delete_account() returns void language plpgsql security definer set search_path=public as $$declare u uuid:=auth.uid();begin if u is null then raise exception 'Autenticação necessária';end if;delete from auth.users where id=u;end$$;
-- Schedule this function every Monday at 00:00 UTC. Run missed weeks chronologically.
-- Friendship membership is sampled at closing time; production scheduling is required.
create function public.close_week(p_week timestamptz) returns integer language plpgsql security definer set search_path=public as $$declare r record;granted integer:=0;begin
 if p_week<>utc_week(p_week) or p_week>=utc_week(now()) then raise exception 'Semana ainda não encerrada ou inválida';end if;
 perform pg_advisory_xact_lock(104729);
 insert into closed_weeks(week) values(p_week) on conflict do nothing;
 if not found then return 0;end if;
 for r in with totals as(select p.id,count(s.position) words from profiles p left join scored s on s.user_id=p.id and s.week=p_week group by p.id), placements as(select t.id,t.words,1+(select count(*) from totals other where other.words>t.words and (other.id=t.id or exists(select 1 from friendships f where f.status='accepted' and ((f.sender=t.id and f.recipient=other.id)or(f.recipient=t.id and f.sender=other.id))))) as placement from totals t) select * from placements where words>0 and placement<=3 loop
 insert into rewards(user_id,week,placement) values(r.id,p_week,r.placement) on conflict do nothing;
 if found then update profiles set premium_until=greatest(coalesce(premium_until,now()),now())+interval '7 days' where id=r.id;granted:=granted+1;end if;
 end loop;return granted;
end$$;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.set_username(text),public.search_profiles(text),public.request_friend(uuid),public.respond_friend(uuid,boolean),public.remove_friend(uuid),public.list_friends(),public.submit_session(uuid,text,integer,integer[],integer,bigint),public.weekly_ranking(),public.my_profile(),public.my_rewards(),public.delete_account() to authenticated;
grant execute on function public.close_week(timestamptz) to service_role;
