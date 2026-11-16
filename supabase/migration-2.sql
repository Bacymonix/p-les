-- =====================================================================
-- Mise à jour n°2 : inscription par surnom, demandes de pôles, outils admin.
-- À coller dans Supabase > SQL Editor > New query > Run (une fois ; relançable sans risque).
-- Ne touche à aucune donnée existante.
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
