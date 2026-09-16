-- Run after setup.sql. Existing progress is migrated lazily, without deleting data.
create or replace function public.reading_family(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_state jsonb;
  family jsonb;
  child_id text;
  record jsonb;
  page_counts jsonb;
  catalog jsonb := '{"1":[8,6,8],"2":[6,8,8],"3":[6,5,6],"4":[7,7,6],"5":[7,8,8],"6":[7,8,7],"7":[6,7,6],"8":[7,8,6],"9":[11,12,13,12,14,12,14,14],"10":[24,22,27,25,25,25,25,26,28,28],"11":[35,36,36,35,35,35,37,37,34,36,37,35]}'::jsonb;
  book integer; page integer; words integer; i integer;
  done boolean := true;
  generation integer;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  insert into public.reader_accounts(user_id) values(uid) on conflict do nothing;
  select state into family from public.reader_accounts where user_id=uid for update;
  if not (family ? 'children') then
    family := jsonb_build_object('generation',coalesce((family->>'generation')::integer,0),'children',jsonb_build_object('default', family - 'generation'));
  end if;
  generation := (family->>'generation')::integer;
  child_id := payload->>'childId';
  if action='load' then
    update public.reader_accounts set state=family where user_id=uid;
    return family;
  end if;
  if action='reset' then
    family := jsonb_build_object('generation',generation+1,'children',jsonb_build_object('default',jsonb_build_object('name','Reader','voice','','rate',0.82,'books','{}'::jsonb)));
  else
    if (payload->>'generation')::integer is distinct from generation then
      raise exception 'Progress was reset on another device';
    end if;
    if child_id is null or length(child_id) not between 1 and 80 then raise exception 'Choose a child'; end if;
    if action='add_child' then
      if not (family->'children' ? child_id) then
        if length(trim(payload->>'name')) not between 1 and 30 or payload->>'name' is null then raise exception 'Invalid nickname'; end if;
        if (select count(*) from jsonb_object_keys(family->'children')) >= 20 then raise exception 'A family can have up to 20 children'; end if;
        family := jsonb_set(family,array['children',child_id],jsonb_build_object('name',trim(payload->>'name'),'voice','','rate',0.82,'books','{}'::jsonb));
      end if;
      update public.reader_accounts set state=family where user_id=uid;
      return family;
    end if;
    if not (family->'children' ? child_id) then raise exception 'Child not found'; end if;
    current_state := family->'children'->child_id;
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
      if book is null or page is null or words is null or not (catalog ? book::text) then raise exception 'Invalid progress'; end if;
      page_counts := catalog->book::text;
      if page < 0 or page >= jsonb_array_length(page_counts) then raise exception 'Invalid page'; end if;
      if words not between 1 and (page_counts->>page)::integer then raise exception 'Invalid word count'; end if;
      record := coalesce(current_state->'books'->book::text, '{"pages":{}}'::jsonb);
      record := jsonb_set(record,array['pages',page::text],to_jsonb(greatest(words,coalesce((record->'pages'->>page::text)::integer,0))),true);
      for i in 0..jsonb_array_length(page_counts)-1 loop
        if coalesce((record->'pages'->>i::text)::integer,0) < (page_counts->>i)::integer then done := false; end if;
      end loop;
      if done and not(record ? 'completedAt') then record := jsonb_set(record,'{completedAt}',to_jsonb(now())); end if;
      current_state := jsonb_set(current_state,array['books',book::text],record,true);
    else raise exception 'Unknown action'; end if;
    family := jsonb_set(family,array['children',child_id],current_state);
  end if;
  update public.reader_accounts set state=family where user_id=uid;
  return family;
end;
$$;
revoke all on function public.reading_family(text,jsonb) from public, anon;
grant execute on function public.reading_family(text,jsonb) to authenticated;

-- Old app tabs must reload instead of overwriting the family structure.
create or replace function public.reading_account(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Please reload Bright Reads to use family profiles';
end;
$$;
