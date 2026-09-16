-- Run once in the Supabase SQL Editor. Safe to re-run.
create table if not exists public.reader_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"name":"Reader","voice":"","rate":0.82,"books":{},"generation":0}'::jsonb
);
alter table public.reader_accounts enable row level security;
revoke all on public.reader_accounts from anon, authenticated;
grant select on public.reader_accounts to authenticated;
drop policy if exists "Read own account" on public.reader_accounts;
create policy "Read own account" on public.reader_accounts for select to authenticated using ((select auth.uid()) = user_id);

-- All writes are serialized on the account row. A generation check rejects
-- old writes after a reset, so another device cannot resurrect deleted progress.
create or replace function public.reading_account(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_state jsonb;
  record jsonb;
  page_counts jsonb;
  catalog jsonb := '[[8, 6, 8], [6, 8, 8], [6, 5, 6], [7, 7, 6], [7, 8, 8], [7, 8, 7], [6, 7, 6], [7, 8, 6]]'::jsonb;
  book integer; page integer; words integer; i integer;
  done boolean := true;
  generation integer;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  insert into public.reader_accounts(user_id) values(uid) on conflict do nothing;
  select state into current_state from public.reader_accounts where user_id=uid for update;
  generation := (current_state->>'generation')::integer;
  if action='load' then return current_state; end if;
  if action='reset' then
    current_state := jsonb_build_object('name','Reader','voice','','rate',0.82,'books','{}'::jsonb,'generation',generation+1);
  else
    if (payload->>'generation')::integer is distinct from generation then
      raise exception 'Progress was reset on another device';
    end if;
    if action='preferences' then
      if payload ? 'name' then
        if length(trim(payload->>'name')) not between 1 and 30 then raise exception 'Invalid nickname'; end if;
        current_state := jsonb_set(current_state,'{name}',to_jsonb(trim(payload->>'name')));
      end if;
      if payload ? 'voice' then
        if length(payload->>'voice') > 500 then raise exception 'Invalid voice'; end if;
        current_state := jsonb_set(current_state,'{voice}',payload->'voice');
      end if;
      if payload ? 'rate' then
        if (payload->>'rate')::numeric not in (0.65,0.82,1) then raise exception 'Invalid rate'; end if;
        current_state := jsonb_set(current_state,'{rate}',payload->'rate');
      end if;
    elsif action='progress' then
      book := (payload->>'book')::integer;
      page := (payload->>'page')::integer;
      words := (payload->>'words')::integer;
      if book is null or page is null or words is null or book not between 1 and 8 or page not between 0 and 2 then raise exception 'Invalid progress'; end if;
      page_counts := catalog->(book-1);
      if words not between 1 and (page_counts->>page)::integer then raise exception 'Invalid word count'; end if;
      record := coalesce(current_state->'books'->book::text, '{"pages":{}}'::jsonb);
      record := jsonb_set(record,array['pages',page::text],to_jsonb(greatest(words,coalesce((record->'pages'->>page::text)::integer,0))),true);
      for i in 0..2 loop
        if coalesce((record->'pages'->>i::text)::integer,0) < (page_counts->>i)::integer then done := false; end if;
      end loop;
      if done and not(record ? 'completedAt') then record := jsonb_set(record,'{completedAt}',to_jsonb(now())); end if;
      current_state := jsonb_set(current_state,array['books',book::text],record,true);
    else raise exception 'Unknown action'; end if;
  end if;
  update public.reader_accounts set state=current_state where user_id=uid;
  return current_state;
end;
$$;
revoke all on function public.reading_account(text,jsonb) from public, anon;
grant execute on function public.reading_account(text,jsonb) to authenticated;
