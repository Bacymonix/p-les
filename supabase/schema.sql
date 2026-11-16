-- =====================================================================
-- Pilotage de l'asso : schéma de la base Supabase
-- À coller une seule fois dans Supabase > SQL Editor > New query > Run.
--
-- RÔLES
--   admin        : voit et modifie tout, gère les accès (validation, rôles, membres des pôles).
--   bureau       : voit et modifie tous les pôles ; ne gère pas les accès.
--   responsable  : (par pôle) gère son pôle : estimation /100, objectifs de la semaine,
--                  sections réservées, membres de son pôle.
--   membre       : (par pôle) voit uniquement les pôles dont il fait partie, ajoute du contenu
--                  dans les sections ouvertes, modifie/supprime seulement ce qu'il a ajouté.
--   Un compte non validé ne voit rien. Les e-mails ne sont visibles que des admins.
-- Ces règles sont appliquées par la base (Row Level Security), fichiers compris.
-- =====================================================================

-- ---------- Tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'membre' check (role in ('admin', 'bureau', 'membre')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- layout : liste des sections du pôle, ex. [{"key":"devis","title":"Devis","type":"quotes","categories":["Bus","Activité"]}]
--   types : files, quotes, ideas, notes, sales, partners, schedule, apartments
--   options : comments (bool), lead_only (bool : seul le respo ajoute), fields, categories
create table if not exists public.poles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  color text not null default '#4f5bd5',
  position int not null default 0,
  event_date date,
  has_gauge boolean not null default true,
  estimate int check (estimate between 0 and 100),
  estimate_note text not null default '',
  estimate_by uuid references public.profiles(id) on delete set null,
  estimate_at timestamptz,
  layout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pole_members (
  pole_id uuid not null references public.poles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'membre' check (role in ('responsable', 'membre')),
  created_at timestamptz not null default now(),
  primary key (pole_id, user_id)
);
create index if not exists pole_members_user_idx on public.pole_members(user_id);

-- Objectifs de la semaine (to-do list remplie par le respo). week_start = lundi de la semaine.
create table if not exists public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  pole_id uuid not null references public.poles(id) on delete cascade,
  week_start date not null,
  title text not null check (char_length(title) between 1 and 300),
  done boolean not null default false,
  position int not null default 0,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists weekly_goals_pole_week_idx on public.weekly_goals(pole_id, week_start);

-- Contenu des sections (fichier, devis, idée, note, vente, partenaire, étape, appartement).
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  pole_id uuid not null references public.poles(id) on delete cascade,
  section text not null,
  data jsonb not null default '{}'::jsonb,
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  link_url text,
  position int not null default 0,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_pole_idx on public.items(pole_id, section);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  pole_id uuid not null references public.poles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  author_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists comments_item_idx on public.comments(item_id);

-- ---------- Fonctions de droits (security definer : lisent les tables sans boucle RLS) ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and approved;
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'bureau'), false);
$$;

create or replace function public.in_pole(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or (public.my_role() is not null and exists (
    select 1 from public.pole_members where pole_id = p and user_id = auth.uid()));
$$;

create or replace function public.is_pole_lead(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null and exists (
    select 1 from public.pole_members where pole_id = p and user_id = auth.uid() and role = 'responsable');
$$;

create or replace function public.manages_pole(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or public.is_pole_lead(p);
$$;

-- La section est-elle réservée au respo (option lead_only dans le layout du pôle) ?
create or replace function public.section_lead_only(p uuid, s text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (sec->>'lead_only')::boolean
    from public.poles, jsonb_array_elements(layout) sec
    where id = p and sec->>'key' = s limit 1), false);
$$;

-- Peut ajouter / modifier dans cette section.
create or replace function public.can_write_section(p uuid, s text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.manages_pole(p) or (public.in_pole(p) and not public.section_lead_only(p, s));
$$;

create or replace function public.can_see_profile(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or public.is_staff()
    or (public.my_role() is not null and (
         (exists (select 1 from public.pole_members where user_id = auth.uid() and role = 'responsable')
          and exists (select 1 from public.profiles where id = target and approved))
      or exists (select 1 from public.profiles where id = target and approved and role in ('admin', 'bureau'))
      or exists (select 1 from public.pole_members a join public.pole_members b on a.pole_id = b.pole_id
                 where a.user_id = auth.uid() and b.user_id = target)));
$$;

-- Pôle d'un fichier du stockage : chemin « <pole_id>/<fichier> ». Renvoie null si le chemin est invalide.
create or replace function public.pole_of_path(path text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create or replace function public.admin_member_emails() returns table (id uuid, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query select u.id, u.email::text from auth.users u;
end $$;
revoke all on function public.admin_member_emails() from public, anon;
grant execute on function public.admin_member_emails() to authenticated;

-- ---------- Déclencheurs ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, full_name, role, approved)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    case when is_first then 'admin' else 'membre' end,
    is_first
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.role is distinct from old.role
    or new.approved is distinct from old.approved
    or new.id is distinct from old.id) then
    raise exception 'Seul un administrateur peut modifier le rôle ou la validation d''un membre';
  end if;
  if old.role = 'admin' and old.approved and (new.role <> 'admin' or not new.approved)
     and not exists (select 1 from public.profiles where role = 'admin' and approved and id <> old.id) then
    raise exception 'Impossible : il doit rester au moins un administrateur';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

create or replace function public.revoke_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.approved and not new.approved then
    delete from public.pole_members where user_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists revoke_cleanup on public.profiles;
create trigger revoke_cleanup after update of approved on public.profiles
  for each row execute function public.revoke_cleanup();

-- Pôles : seul l'admin change la structure (nom, sections, jauge, ordre) ;
-- l'auteur et la date de l'estimation sont remplis automatiquement.
create or replace function public.protect_pole() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.name is distinct from old.name or new.layout is distinct from old.layout
    or new.has_gauge is distinct from old.has_gauge or new.position is distinct from old.position) then
    raise exception 'Seul un administrateur peut modifier la structure d''un pôle';
  end if;
  if new.estimate is distinct from old.estimate or new.estimate_note is distinct from old.estimate_note then
    new.estimate_by = auth.uid();
    new.estimate_at = now();
  end if;
  return new;
end $$;

drop trigger if exists protect_pole on public.poles;
create trigger protect_pole before update on public.poles
  for each row execute function public.protect_pole();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- Un élément ne change jamais de pôle ; un commentaire prend le pôle de son élément.
create or replace function public.lock_item_pole() returns trigger
language plpgsql as $$
begin
  if new.pole_id is distinct from old.pole_id or new.section is distinct from old.section then
    raise exception 'Un élément ne peut pas changer de pôle ou de section';
  end if;
  return new;
end $$;

drop trigger if exists lock_item_pole on public.items;
create trigger lock_item_pole before update on public.items
  for each row execute function public.lock_item_pole();

create or replace function public.comment_pole() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select pole_id into new.pole_id from public.items where id = new.item_id;
  return new;
end $$;

drop trigger if exists comment_pole on public.comments;
create trigger comment_pole before insert on public.comments
  for each row execute function public.comment_pole();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.poles enable row level security;
alter table public.pole_members enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.items enable row level security;
alter table public.comments enable row level security;

-- Profils
drop policy if exists "profiles lecture" on public.profiles;
create policy "profiles lecture" on public.profiles for select to authenticated
  using (public.can_see_profile(id));
drop policy if exists "profiles modification" on public.profiles;
create policy "profiles modification" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- Pôles
drop policy if exists "poles lecture" on public.poles;
create policy "poles lecture" on public.poles for select to authenticated using (public.in_pole(id));
drop policy if exists "poles ajout" on public.poles;
create policy "poles ajout" on public.poles for insert to authenticated with check (public.is_admin());
drop policy if exists "poles modification" on public.poles;
create policy "poles modification" on public.poles for update to authenticated
  using (public.manages_pole(id)) with check (public.manages_pole(id));
drop policy if exists "poles suppression" on public.poles;
create policy "poles suppression" on public.poles for delete to authenticated using (public.is_admin());

-- Membres des pôles (le bureau ne gère pas les accès)
drop policy if exists "pole_members lecture" on public.pole_members;
create policy "pole_members lecture" on public.pole_members for select to authenticated
  using (public.in_pole(pole_id));
drop policy if exists "pole_members ajout" on public.pole_members;
create policy "pole_members ajout" on public.pole_members for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = user_id and approved)
    and (public.is_admin() or (public.is_pole_lead(pole_id) and role = 'membre')));
drop policy if exists "pole_members modification" on public.pole_members;
create policy "pole_members modification" on public.pole_members for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "pole_members suppression" on public.pole_members;
create policy "pole_members suppression" on public.pole_members for delete to authenticated
  using (public.is_admin() or (public.is_pole_lead(pole_id) and role = 'membre'));

-- Objectifs de la semaine : lus par le pôle, écrits par le respo (et bureau/admin)
drop policy if exists "goals lecture" on public.weekly_goals;
create policy "goals lecture" on public.weekly_goals for select to authenticated using (public.in_pole(pole_id));
drop policy if exists "goals ajout" on public.weekly_goals;
create policy "goals ajout" on public.weekly_goals for insert to authenticated with check (public.manages_pole(pole_id));
drop policy if exists "goals modification" on public.weekly_goals;
create policy "goals modification" on public.weekly_goals for update to authenticated
  using (public.manages_pole(pole_id)) with check (public.manages_pole(pole_id));
drop policy if exists "goals suppression" on public.weekly_goals;
create policy "goals suppression" on public.weekly_goals for delete to authenticated using (public.manages_pole(pole_id));

-- Contenu des sections
drop policy if exists "items lecture" on public.items;
create policy "items lecture" on public.items for select to authenticated using (public.in_pole(pole_id));
drop policy if exists "items ajout" on public.items;
create policy "items ajout" on public.items for insert to authenticated
  with check (public.can_write_section(pole_id, section) and created_by = auth.uid());
drop policy if exists "items modification" on public.items;
create policy "items modification" on public.items for update to authenticated
  using (public.manages_pole(pole_id) or (created_by = auth.uid() and public.can_write_section(pole_id, section)))
  with check (public.in_pole(pole_id));
drop policy if exists "items suppression" on public.items;
create policy "items suppression" on public.items for delete to authenticated
  using (public.manages_pole(pole_id) or (created_by = auth.uid() and public.can_write_section(pole_id, section)));

-- Commentaires : tout membre du pôle commente ; on supprime les siens (le respo peut tout supprimer)
drop policy if exists "comments lecture" on public.comments;
create policy "comments lecture" on public.comments for select to authenticated using (public.in_pole(pole_id));
drop policy if exists "comments ajout" on public.comments;
create policy "comments ajout" on public.comments for insert to authenticated
  with check (public.in_pole(pole_id) and author_id = auth.uid());
drop policy if exists "comments suppression" on public.comments;
create policy "comments suppression" on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.manages_pole(pole_id));

revoke all on public.profiles, public.poles, public.pole_members, public.weekly_goals, public.items, public.comments from anon;

-- ---------- Fichiers (Supabase Storage) ----------
-- Dossier privé « pole-files », un sous-dossier par pôle. Limite : 50 Mo par fichier.
insert into storage.buckets (id, name, public, file_size_limit)
values ('pole-files', 'pole-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "pole files lecture" on storage.objects;
create policy "pole files lecture" on storage.objects for select to authenticated
  using (bucket_id = 'pole-files' and public.in_pole(public.pole_of_path(name)));
drop policy if exists "pole files ajout" on storage.objects;
create policy "pole files ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'pole-files' and public.in_pole(public.pole_of_path(name)));
drop policy if exists "pole files suppression" on storage.objects;
create policy "pole files suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'pole-files' and (owner = auth.uid() or public.manages_pole(public.pole_of_path(name))));

-- ---------- Temps réel (respecte les droits ci-dessus) ----------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'poles', 'pole_members', 'weekly_goals', 'items', 'comments'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =====================================================================
-- Inscription par surnom, demandes de pôles, outils admin (identique à migration-2.sql)
-- =====================================================================
-- ---------- Demandes pour rejoindre un pôle ----------
create table if not exists public.join_requests (
  pole_id uuid not null references public.poles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pole_id, user_id)
);
alter table public.join_requests enable row level security;

-- Chacun voit et gère ses propres demandes (même avant validation) ; l'admin les voit toutes.
drop policy if exists "requests lecture" on public.join_requests;
create policy "requests lecture" on public.join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "requests ajout" on public.join_requests;
create policy "requests ajout" on public.join_requests for insert to authenticated
  with check (user_id = auth.uid() and not exists (
    select 1 from public.pole_members m where m.pole_id = join_requests.pole_id and m.user_id = auth.uid()));
drop policy if exists "requests suppression" on public.join_requests;
create policy "requests suppression" on public.join_requests for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke all on public.join_requests from anon;

-- ---------- Fonctions ----------
-- Vrai tant qu'aucun compte n'existe : le site affiche alors la page « créer le compte administrateur ».
create or replace function public.setup_needed() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles);
$$;
grant execute on function public.setup_needed() to anon, authenticated;

-- Liste des pôles (nom et couleur seulement) pour qu'une personne connectée puisse demander à en rejoindre.
create or replace function public.pole_directory() returns table (id uuid, name text, color text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.color from public.poles p where auth.uid() is not null order by p.position, p.name;
$$;
revoke all on function public.pole_directory() from public, anon;
grant execute on function public.pole_directory() to authenticated;

-- L'admin accepte une demande : valide le compte si besoin, ajoute au pôle, retire la demande.
create or replace function public.accept_request(p uuid, u uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  update public.profiles set approved = true where id = u and not approved;
  insert into public.pole_members (pole_id, user_id, role) values (p, u, 'membre')
    on conflict (pole_id, user_id) do nothing;
  delete from public.join_requests where pole_id = p and user_id = u;
end $$;
revoke all on function public.accept_request(uuid, uuid) from public, anon;
grant execute on function public.accept_request(uuid, uuid) to authenticated;

-- Quand quelqu'un est ajouté à un pôle (par n'importe quel moyen), sa demande pour ce pôle disparaît.
create or replace function public.clear_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.join_requests where pole_id = new.pole_id and user_id = new.user_id;
  return new;
end $$;
drop trigger if exists clear_request on public.pole_members;
create trigger clear_request after insert on public.pole_members
  for each row execute function public.clear_request();

-- Mot de passe oublié : l'admin en fixe un nouveau (pas d'e-mail dans ce site).
create or replace function public.admin_reset_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  if char_length(new_password) < 6 then
    raise exception 'Mot de passe trop court (6 caractères minimum)';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now()
   where id = target;
  if not found then
    raise exception 'Compte introuvable';
  end if;
end $$;
revoke all on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;

-- Supprimer définitivement un compte (inscription inconnue, doublon…). Son contenu reste, sans auteur.
create or replace function public.admin_delete_user(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  if target = auth.uid() then
    raise exception 'Impossible de supprimer son propre compte';
  end if;
  delete from auth.users where id = target;
end $$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------- Temps réel ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'join_requests') then
    alter publication supabase_realtime add table public.join_requests;
  end if;
end $$;
