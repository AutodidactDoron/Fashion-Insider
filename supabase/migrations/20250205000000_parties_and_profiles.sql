-- Profiles: id = auth.users.id, store email and avatar for display in party/messages
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  avatar_url text,
  display_name text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select to public using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Parties: one row per party
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.parties enable row level security;

create policy "Parties viewable by authenticated"
  on public.parties for select to authenticated using (true);

create policy "Authenticated can create party"
  on public.parties for insert to authenticated with check (auth.uid() = created_by);

create policy "Creator can delete party"
  on public.parties for delete to authenticated using (auth.uid() = created_by);

-- Party members: who is in which party (user_id = profiles.id for join)
create table if not exists public.party_members (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(party_id, user_id)
);

alter table public.party_members enable row level security;

create policy "Party members viewable by authenticated"
  on public.party_members for select to authenticated using (true);

create policy "Authenticated can join party"
  on public.party_members for insert to authenticated with check (auth.uid() = user_id);

create policy "User can leave party (delete own row)"
  on public.party_members for delete to authenticated using (auth.uid() = user_id);

-- Realtime for party_members so UI updates when someone joins/leaves
alter publication supabase_realtime add table public.party_members;

-- Trigger: create profile on signup (optional; or create from client on first login)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
