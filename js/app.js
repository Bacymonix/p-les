import * as api from './data.js';
import { APP_NAME } from './config.js';
import { TEMPLATES, SECTION_TYPES } from './templates.js';

const ROLE_LABEL = { admin: 'Admin', bureau: 'Bureau', membre: 'Membre' };
const STALE_DAYS = 7;

const state = {
  me: null, profiles: [], poles: [], members: [], goals: [], items: [], comments: [],
  requests: [], directory: [], migrated: true,
  emails: {}, week: {}, openComments: new Set(),
};
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
document.title = APP_NAME;

// ---------- Utilitaires ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString('sv-SE'); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const mondayOf = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); return d.toLocaleDateString('sv-SE'); };
const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(n) || 0);
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const profile = (id) => state.profiles.find((p) => p.id === id);
const pole = (id) => state.poles.find((p) => p.id === id);
const nameOf = (id) => profile(id)?.full_name || '—';
const firstName = (id) => nameOf(id).split(' ')[0];
const initials = (id) => (profile(id)?.full_name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const plural = (n, w, pl = w + 's') => `${n} ${n > 1 ? pl : w}`;

function fmtDate(s, withYear = false) {
  if (!s) return '';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  const opts = { day: 'numeric', month: 'short' };
  if (withYear || d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('fr-FR', opts);
}
function relDays(iso) {
  if (!iso) return '';
  const diff = daysBetween(iso.slice(0, 10), today());
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return 'hier';
  return `il y a ${diff} j`;
}
function untilDate(s) {
  const diff = daysBetween(today(), s);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'demain';
  return diff > 0 ? `dans ${diff} j` : `il y a ${-diff} j`;
}

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a7 7 0 0 0-5-6.7"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m16 7 3 3"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (n) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

// ---------- Droits (affichage seulement : la base applique les mêmes règles) ----------
const role = () => (state.me?.approved ? state.me.role : null);
const isAdmin = () => role() === 'admin';
const isStaff = () => ['admin', 'bureau'].includes(role());
const myPoleRole = (pid) => state.members.find((m) => m.pole_id === pid && m.user_id === state.me.id)?.role || null;
const isLead = (pid) => myPoleRole(pid) === 'responsable';
const manages = (pid) => isStaff() || isLead(pid);
const canWrite = (pid, sec) => manages(pid) || (!!myPoleRole(pid) || isStaff()) && !sec.lead_only;
const canEditItem = (it, sec) => manages(it.pole_id) || (it.created_by === state.me.id && canWrite(it.pole_id, sec));
const canManageMembers = (pid) => isAdmin() || isLead(pid);
const leadsOf = (pid) => state.members.filter((m) => m.pole_id === pid && m.role === 'responsable').map((m) => m.user_id);
const myLeadPoles = () => state.members.filter((m) => m.user_id === state.me.id && m.role === 'responsable').map((m) => m.pole_id);

function roleText() {
  if (isAdmin()) return 'Administrateur';
  if (role() === 'bureau') return 'Bureau';
  const leads = myLeadPoles();
  if (leads.length) return `Resp. ${leads.map((id) => pole(id)?.name).filter(Boolean).join(', ')}`;
  return 'Membre';
}

function toast(msg, kind = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `show ${kind}`;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.className = ''), 3500);
}

const redraw = () => (state.me?.approved ? render() : renderJoin());

async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); await loadAll(); redraw(); return true; }
  catch (e) { toast(e.message || 'Erreur inattendue.', 'err'); return false; }
}

// ---------- Démarrage et session ----------
async function boot() {
  try { await api.init(); }
  catch { $app.innerHTML = `<div class="boot">Impossible de charger le site. Vérifie ta connexion internet.</div>`; return; }
  api.onAuth(() => refreshSession());
  window.addEventListener('hashchange', () => { if (state.me?.approved) { render(); window.scrollTo(0, 0); } });
  await refreshSession();
}

async function refreshSession() {
  const user = await api.currentUser();
  if (!user) { state.me = null; renderAuth((await api.setupNeeded()) ? 'setup' : 'login'); return; }
  state.me = await api.getMyProfile().catch(() => null);
  if (!state.me) { await api.signOut(); renderAuth('login'); return; }
  await loadAll();
  let timer;
  api.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!state.me) return;
      await loadAll();
      if (!$modal.open && !document.activeElement?.matches('input, textarea')) redraw();
    }, 500);
  });
  redraw();
}

async function loadAll() {
  const [all, me] = await Promise.all([api.loadEverything(), api.getMyProfile()]);
  Object.assign(state, all, { me });
  state.emails = isAdmin() ? await api.adminEmails().catch(() => ({})) : {};
  state.directory = isStaff() ? [] : await api.poleDirectory().catch(() => []);
}

// ---------- Barre de démo : « voir en tant que » ----------
function demoBar() {
  if (!api.DEMO) return '';
  const users = api.demoUsers();
  const ms = api.demoMembers();
  const label = (u) => {
    if (!u.approved) return `${u.full_name} (non validé)`;
    if (u.role !== 'membre') return `${u.full_name} (${ROLE_LABEL[u.role]})`;
    const leads = ms.filter((m) => m.user_id === u.id && m.role === 'responsable').length;
    return `${u.full_name} (${leads ? 'Responsable' : 'Membre'})`;
  };
  const meId = state.me?.id;
  return `<div class="demo-bar"><strong>Mode démo</strong> · données d'exemple, dans ce navigateur uniquement · voir en tant que
    <select data-input="demo-user" aria-label="Voir en tant que">${users.map((u) => `<option value="${esc(u.id)}" ${u.id === meId ? 'selected' : ''}>${esc(label(u))}</option>`).join('')}</select>
    <a href="#" data-action="export-demo">Exporter mes données</a> · <a href="#" data-action="reset-demo">Réinitialiser</a></div>`;
}

// ---------- Écrans de connexion ----------
function authShell(inner, wide = false) {
  $app.innerHTML = `${demoBar()}
    <main class="auth">
      <div class="auth-card ${wide ? 'wide' : ''}">
        <div class="brand big"><span class="logo"></span>${esc(APP_NAME)}</div>
        ${inner}
      </div>
    </main>`;
}

// mode : 'login', 'signup', ou 'setup' (première ouverture : création du compte administrateur)
function renderAuth(mode = 'login') {
  const creating = mode !== 'login';
  authShell(`
    ${mode === 'setup'
      ? `<span class="pill">Première ouverture</span>
         <h1>Crée le compte administrateur</h1>
         <p class="lead">Cette page n'apparaît qu'une seule fois. Ce compte gère tout : les pôles, les rôles et les accès de chacun.</p>`
      : `<div class="tabs" role="tablist">
           <button type="button" role="tab" data-auth="login" class="${mode === 'login' ? 'on' : ''}">Connexion</button>
           <button type="button" role="tab" data-auth="signup" class="${mode === 'signup' ? 'on' : ''}">Créer un compte</button>
         </div>`}
    <form id="auth-form" class="form">
      <label>${creating ? 'Ton surnom' : 'Surnom'}
        <input name="nick" required minlength="2" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${creating ? 'Celui que les autres reconnaîtront' : ''}"></label>
      <label>Mot de passe
        <span class="pw"><input name="password" type="password" required minlength="6" autocomplete="${creating ? 'new-password' : 'current-password'}" placeholder="${creating ? '6 caractères minimum' : ''}">
          <button type="button" class="pw-toggle" aria-label="Afficher le mot de passe">${icon('eye')}</button></span></label>
      ${creating ? `<label>Encore une fois<input name="password2" type="password" required minlength="6" autocomplete="new-password"></label>` : ''}
      <button class="btn primary big" type="submit">${{ login: 'Se connecter', signup: 'Créer mon compte', setup: 'Créer le compte administrateur' }[mode]}</button>
    </form>
    <p class="hint">${{
      login: 'Mot de passe oublié ? Demande à un admin de t\'en donner un nouveau.',
      signup: 'Pas besoin d\'e-mail. Ensuite tu choisis tes pôles, et un admin valide ta demande.',
      setup: 'Retiens bien ce mot de passe : il n\'y a pas d\'e-mail de secours.',
    }[mode]}</p>`);
  $app.querySelectorAll('[data-auth]').forEach((b) => b.addEventListener('click', () => renderAuth(b.dataset.auth)));
  const form = $app.querySelector('#auth-form');
  form.querySelector('.pw-toggle').addEventListener('click', () => {
    const show = form.password.type === 'password';
    form.querySelectorAll('[name^=password]').forEach((i) => { i.type = show ? 'text' : 'password'; });
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if (creating && f.password !== f.password2) return toast('Les deux mots de passe sont différents.', 'err');
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (creating) await api.signUp(f.nick, f.password); else await api.signIn(f.nick, f.password);
      await refreshSession();
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  });
  form.nick.focus();
}

// Compte créé mais pas encore validé : la personne choisit les pôles qu'elle veut rejoindre.
function renderJoin() {
  const mine = new Set(state.requests.filter((r) => r.user_id === state.me.id).map((r) => r.pole_id));
  authShell(`
    <h1>Salut ${esc(state.me.full_name.split(' ')[0])} !</h1>
    <p class="lead">Choisis les pôles que tu veux rejoindre. Un admin valide ta demande, et tu y as accès.</p>
    ${pickGrid(mine)}
    <p class="notice ${mine.size ? 'ok' : ''}">${mine.size
      ? `Demande envoyée pour ${plural(mine.size, 'pôle')}. Tu auras accès dès qu'un admin aura validé : cette page se met à jour toute seule.`
      : 'Aucune demande pour l\'instant : touche un pôle pour demander à le rejoindre.'}</p>
    <div class="row"><button class="btn" data-action="refresh">Actualiser</button>${api.DEMO ? '' : '<button class="btn ghost" data-action="logout">Se déconnecter</button>'}</div>`, true);
}

function pickGrid(mine) {
  const member = new Set(state.members.filter((m) => m.user_id === state.me.id).map((m) => m.pole_id));
  const list = state.directory.filter((p) => !member.has(p.id));
  if (!state.migrated) return `<p class="notice">Cette fonction arrive : l'admin doit d'abord mettre la base à jour.</p>`;
  if (!list.length) return `<p class="notice">${state.directory.length ? 'Tu es déjà dans tous les pôles.' : 'Aucun pôle n\'existe encore.'}</p>`;
  return `<div class="pick-grid">${list.map((p) => `<button type="button" class="pick ${mine.has(p.id) ? 'on' : ''}" data-action="request-toggle" data-pole="${esc(p.id)}" style="--c:${esc(p.color)}" aria-pressed="${mine.has(p.id)}">
      <span class="dot" style="background:${esc(p.color)}"></span><span class="pick-name">${esc(p.name)}</span>
      <span class="pick-state">${mine.has(p.id) ? `${icon('check')} Demandé` : 'Rejoindre'}</span></button>`).join('')}</div>`;
}

// ---------- Mise en page principale ----------
function route() {
  const [, view, id] = (location.hash || '#/').split('/');
  return { view: view || '', id: id && decodeURIComponent(id) };
}

function render() {
  const r = route();
  let main;
  if (r.view === 'pole' && pole(r.id)) main = viewPole(pole(r.id));
  else if (r.view === 'poles' && isAdmin()) main = viewManagePoles();
  else if (r.view === 'membres' && isAdmin()) main = viewMembers();
  else main = viewDashboard();
  const cur = location.hash || '#/';
  const todo = adminTodo();
  const myPending = state.requests.filter((q) => q.user_id === state.me.id).length;

  $app.innerHTML = `
    ${demoBar()}
    <div class="layout">
      <aside class="side">
        <a class="brand" href="#/"><span class="logo"></span><span>${esc(APP_NAME)}</span></a>
        <nav>
          <a href="#/" class="${cur === '#/' || cur === '#' ? 'active' : ''}">${icon('grid')}<span>${isStaff() ? 'Vue d\'ensemble' : 'Mes pôles'}</span></a>
          <div class="nav-title">Pôles</div>
          ${state.poles.map((p) => `<a href="#/pole/${esc(p.id)}" class="${cur === '#/pole/' + p.id ? 'active' : ''}"><span class="dot" style="background:${esc(p.color)}"></span><span>${esc(p.name)}</span>${isLead(p.id) ? '<span class="tag">respo</span>' : ''}</a>`).join('') || '<span class="nav-empty">Aucun pôle pour l\'instant</span>'}
          ${isStaff() ? '' : `<button type="button" class="nav-join" data-action="join-open">${icon('plus')}<span>Rejoindre un pôle</span>${myPending ? `<span class="badge soft">${myPending} en attente</span>` : ''}</button>`}
          ${isAdmin() ? `<div class="nav-title">Administration</div>
            <a href="#/membres" class="${cur === '#/membres' ? 'active' : ''}">${icon('users')}<span>Membres et demandes</span>${todo ? `<span class="badge">${todo}</span>` : ''}</a>
            <a href="#/poles" class="${cur === '#/poles' ? 'active' : ''}">${icon('sliders')}<span>Gérer les pôles</span></a>` : ''}
        </nav>
        <div class="me">
          <span class="avatar">${esc(initials(state.me.id))}</span>
          <div class="me-id"><div class="me-name">${esc(state.me.full_name)}</div><div class="me-role">${esc(roleText())}</div></div>
          <button class="icon-btn" data-action="edit-me" title="Mon profil">${icon('edit')}</button>
          ${api.DEMO ? '' : `<button class="icon-btn" data-action="logout" title="Se déconnecter">${icon('logout')}</button>`}
        </div>
      </aside>
      <main class="content">${main}</main>
    </div>`;
  hydrate();
}

// Nombre de choses qui attendent l'admin : demandes de pôles + comptes sans demande à valider.
function adminTodo() {
  if (!isAdmin()) return 0;
  const withReq = new Set(state.requests.map((q) => q.user_id));
  return state.requests.length + state.profiles.filter((p) => !p.approved && !withReq.has(p.id)).length;
}

// ---------- Composants ----------
function gauge(v, color, size = 'md') {
  const val = v == null ? 0 : Math.max(0, Math.min(100, v));
  return `<svg class="gauge ${size}" viewBox="0 0 120 72" role="img" aria-label="Avancement estimé : ${v == null ? 'non renseigné' : v + ' sur 100'}">
    <path d="M12 62 A48 48 0 0 1 108 62" class="g-bg" pathLength="100"/>
    <path d="M12 62 A48 48 0 0 1 108 62" class="g-val" pathLength="100" style="stroke:${esc(color)};stroke-dasharray:${val} 100"/>
    <text x="60" y="56" text-anchor="middle" class="g-num">${v == null ? '—' : v}</text>
    <text x="60" y="70" text-anchor="middle" class="g-unit">/ 100</text>
  </svg>`;
}

function bar(v, color) {
  return `<div class="bar"><span style="width:${Math.max(0, Math.min(100, v))}%;${color ? `background:${esc(color)}` : ''}"></span></div>`;
}

const weekGoals = (pid, offset = 0) => state.goals.filter((g) => g.pole_id === pid && g.week_start === mondayOf(offset)).sort((a, b) => a.position - b.position);
const isStale = (p) => p.has_gauge && (!p.estimate_at || daysBetween(p.estimate_at.slice(0, 10), today()) > STALE_DAYS);
const itemsOf = (pid, key) => state.items.filter((i) => i.pole_id === pid && i.section === key).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));

// Résumé chiffré pour les pôles sans jauge.
function poleSummary(p) {
  const out = [];
  for (const sec of p.layout) {
    const its = itemsOf(p.id, sec.key);
    if (sec.type === 'sales') {
      const total = its.reduce((s, i) => s + (Number(i.data.revenue) || 0), 0);
      out.push(`<div class="big-fig">${eur(total)}</div><div class="muted small">de recette sur ${plural(its.length, 'vente')}</div>`);
    } else if (sec.type === 'partners') {
      out.push(`<div class="big-fig">${its.length}</div><div class="muted small">${its.length > 1 ? 'partenaires' : 'partenaire'}</div>`);
    }
  }
  return out.join('') || `<div class="muted small">${plural(state.items.filter((i) => i.pole_id === p.id).length, 'élément')}</div>`;
}

// ---------- Tableau de bord ----------
function viewDashboard() {
  const poles = state.poles;
  if (!poles.length) {
    const waiting = state.requests.filter((q) => q.user_id === state.me.id).length;
    return `<header class="page-head hero"><div><p class="eyebrow">${esc(roleText())}</p><h1>Salut ${esc(state.me.full_name.split(' ')[0])}</h1></div></header>
      <div class="panel empty-big">
        <p>${isStaff() ? 'Aucun pôle n\'existe encore.' : waiting ? `Tu as ${plural(waiting, 'demande')} en attente de validation par un admin.` : 'Tu n\'es encore dans aucun pôle.'}</p>
        ${isAdmin() ? '<a class="btn primary" href="#/poles">Créer les pôles</a>' : isStaff() ? '' : `<button class="btn primary" data-action="join-open">${icon('plus')} Rejoindre un pôle</button>`}
      </div>`;
  }
  const gauged = poles.filter((p) => p.has_gauge);
  const withEst = gauged.filter((p) => p.estimate != null);
  const avg = withEst.length ? Math.round(withEst.reduce((s, p) => s + p.estimate, 0) / withEst.length) : null;
  const goals = poles.flatMap((p) => weekGoals(p.id));
  const done = goals.filter((g) => g.done).length;
  const stale = gauged.filter(isStale);

  return `
    <header class="page-head hero">
      <div><p class="eyebrow">${esc(roleText())} · semaine du ${fmtDate(mondayOf())}</p>
        <h1>Salut ${esc(state.me.full_name.split(' ')[0])}</h1>
        <p class="muted">${isStaff() ? `Vue d'ensemble des ${poles.length} pôles de l'asso.` : `Voici ${poles.length > 1 ? `tes ${poles.length} pôles` : 'ton pôle'}.`}</p></div>
    </header>
    ${adminTodo() ? `<a class="banner" href="#/membres">${icon('users')}<span><strong>${plural(adminTodo(), 'demande')} en attente</strong> : des membres attendent ta validation.</span><span class="banner-go">Voir ${icon('right')}</span></a>` : ''}
    ${isAdmin() && !state.migrated ? `<div class="banner warn">${icon('sliders')}<span><strong>Base à mettre à jour</strong> : lance <code>supabase/migration-2.sql</code> dans Supabase (SQL Editor) pour activer les demandes de pôles.</span></div>` : ''}
    <section class="kpis">
      <div class="kpi"><div class="kpi-label">Avancement moyen estimé</div><div class="kpi-value">${avg ?? '—'}<small> / 100</small></div>${bar(avg ?? 0)}</div>
      <div class="kpi"><div class="kpi-label">Objectifs de la semaine</div><div class="kpi-value">${done}<small> / ${goals.length}</small></div>${bar(goals.length ? (done / goals.length) * 100 : 0, 'var(--ok)')}</div>
      <div class="kpi ${stale.length ? 'risk' : ''}"><div class="kpi-label">Estimations à mettre à jour</div><div class="kpi-value">${stale.length}<small> / ${gauged.length}</small></div>
        <div class="muted small">${stale.length ? esc(stale.map((p) => p.name).join(', ')) : `Toutes mises à jour depuis moins de ${STALE_DAYS} jours`}</div></div>
    </section>
    <section class="dash-grid">
      ${poles.map((p) => {
        const gs = weekGoals(p.id);
        const d = gs.filter((g) => g.done).length;
        return `<a class="dash-card" href="#/pole/${esc(p.id)}" style="--c:${esc(p.color)}">
          <div class="dash-head"><span class="dot" style="background:${esc(p.color)}"></span><strong>${esc(p.name)}</strong>
            ${p.event_date ? `<span class="muted small evt">${fmtDate(p.event_date)}</span>` : ''}</div>
          <div class="dash-gauge">
            ${p.has_gauge ? `${gauge(p.estimate, p.color)}
              <div class="muted small ${isStale(p) ? 'stale' : ''}">${p.estimate_at ? `Estimé ${relDays(p.estimate_at)} par ${esc(firstName(p.estimate_by))}` : 'Pas encore estimé'}</div>`
              : `<div class="summary">${poleSummary(p)}</div>`}
          </div>
          <div class="dash-goals">
            <div class="dash-goals-head"><span>Objectifs de la semaine</span><span class="count">${d}/${gs.length}</span></div>
            ${gs.length ? `<ul class="mini-goals">${gs.slice(0, 5).map((g) => `<li class="${g.done ? 'done' : ''}"><span class="ck">${g.done ? '✓' : ''}</span>${esc(g.title)}</li>`).join('')}${gs.length > 5 ? `<li class="muted">+ ${gs.length - 5} autres</li>` : ''}</ul>`
              : '<p class="muted small">Aucun objectif fixé cette semaine.</p>'}
          </div>
          <div class="dash-foot muted small">Resp. ${esc(leadsOf(p.id).map(firstName).join(', ') || '—')}</div>
        </a>`;
      }).join('')}
    </section>`;
}

// ---------- Page d'un pôle ----------
function viewPole(p) {
  const leads = leadsOf(p.id);
  const off = state.week[p.id] || 0;
  const gs = weekGoals(p.id, off);
  const done = gs.filter((g) => g.done).length;
  const team = state.members.filter((m) => m.pole_id === p.id)
    .sort((a, b) => (a.role === 'responsable' ? 0 : 1) - (b.role === 'responsable' ? 0 : 1) || nameOf(a.user_id).localeCompare(nameOf(b.user_id)));
  const addable = state.profiles.filter((u) => u.approved && !team.some((m) => m.user_id === u.id));
  const mg = manages(p.id);

  return `
    <header class="page-head">
      <div>
        <h1><span class="dot big" style="background:${esc(p.color)}"></span>${esc(p.name)}</h1>
        <p class="muted">${esc(p.description)}</p>
        <p class="muted small">Responsable${leads.length > 1 ? 's' : ''} : ${esc(leads.map(nameOf).join(', ') || '—')}
          ${p.event_date ? ` · Date clé : <strong>${fmtDate(p.event_date, true)}</strong> (${untilDate(p.event_date)})` : ''}
          · Ton rôle : ${isStaff() ? ROLE_LABEL[role()] : isLead(p.id) ? 'Responsable' : 'Membre'}</p>
      </div>
      ${mg ? `<button class="btn" data-action="edit-pole" data-id="${esc(p.id)}">Modifier le pôle</button>` : ''}
    </header>

    <section class="pole-top ${p.has_gauge ? '' : 'no-gauge'}">
      ${p.has_gauge ? `<div class="panel est-panel">
        <h2>Avancement estimé par le respo</h2>
        <div class="est-body">
          ${gauge(p.estimate, p.color, 'lg')}
          <div class="est-meta">
            ${p.estimate_note ? `<p class="est-note">« ${esc(p.estimate_note)} »</p>` : ''}
            <p class="muted small ${isStale(p) ? 'stale' : ''}">${p.estimate_at ? `Mis à jour ${relDays(p.estimate_at)} par ${esc(nameOf(p.estimate_by))}` : 'Pas encore estimé'}${isStale(p) && p.estimate_at ? ' · à mettre à jour' : ''}</p>
          </div>
        </div>
        ${mg ? `<form class="est-form" data-form="estimate" data-pole="${esc(p.id)}">
          <label class="est-range"><span>Nouvelle estimation : <output>${p.estimate ?? 0}</output> / 100</span>
            <input type="range" name="estimate" min="0" max="100" step="5" value="${p.estimate ?? 0}" data-live-output></label>
          <input name="estimate_note" maxlength="200" placeholder="Commentaire (facultatif) : où en est-on ?" value="${esc(p.estimate_note || '')}">
          <button class="btn primary small" type="submit">Enregistrer l'estimation</button>
        </form>` : ''}
      </div>` : ''}

      <div class="panel goals-panel">
        <div class="goals-head">
          <h2>Objectifs de la semaine</h2>
          <div class="week-nav">
            <button class="icon-btn" data-action="week" data-pole="${esc(p.id)}" data-delta="-1" title="Semaine précédente">${icon('left')}</button>
            <span class="small">${off === 0 ? 'Cette semaine' : `Sem. du ${fmtDate(mondayOf(off))}`}</span>
            <button class="icon-btn" data-action="week" data-pole="${esc(p.id)}" data-delta="1" title="Semaine suivante">${icon('right')}</button>
          </div>
        </div>
        ${gs.length ? `${bar((done / gs.length) * 100, 'var(--ok)')}<p class="muted small">${done} sur ${gs.length} atteint${done > 1 ? 's' : ''}</p>` : ''}
        <ul class="goals">
          ${gs.map((g) => `<li class="${g.done ? 'done' : ''}">
            <label><input type="checkbox" data-input="goal-done" data-id="${esc(g.id)}" ${g.done ? 'checked' : ''} ${mg ? '' : 'disabled'}><span>${esc(g.title)}</span></label>
            ${mg ? `<button class="icon-btn no" data-action="goal-delete" data-id="${esc(g.id)}" title="Supprimer l'objectif">${icon('x')}</button>` : ''}
          </li>`).join('') || `<li class="muted small">${mg ? 'Aucun objectif : ajoute la to-do list de la semaine.' : 'Le responsable n\'a pas encore fixé d\'objectif.'}</li>`}
        </ul>
        ${mg ? `<form class="inline-add" data-form="goal" data-pole="${esc(p.id)}" data-week="${mondayOf(off)}">
          <input name="title" required maxlength="300" placeholder="Nouvel objectif…"><button class="btn small" type="submit">Ajouter</button></form>` : ''}
      </div>

      <div class="panel team-panel">
        <h2>Équipe <span class="count">${team.length}</span></h2>
        <ul class="team">
          ${team.map((m) => `<li>
            <span class="avatar xs">${esc(initials(m.user_id))}</span><span class="grow">${esc(nameOf(m.user_id))}</span>
            ${m.role === 'responsable' ? '<span class="tag strong">respo</span>' : ''}
            ${isAdmin() ? `<button class="btn ghost small" data-action="member-role" data-pole="${esc(p.id)}" data-user="${esc(m.user_id)}" data-role="${m.role === 'responsable' ? 'membre' : 'responsable'}">${m.role === 'responsable' ? 'Retirer respo' : 'Nommer respo'}</button>` : ''}
            ${(isAdmin() || (isLead(p.id) && m.role === 'membre')) && m.user_id !== state.me.id ? `<button class="icon-btn no" data-action="member-remove" data-pole="${esc(p.id)}" data-user="${esc(m.user_id)}" title="Retirer du pôle">${icon('x')}</button>` : ''}
          </li>`).join('') || '<li class="muted small">Personne pour l\'instant.</li>'}
        </ul>
        ${canManageMembers(p.id) && addable.length ? `<form class="inline-add" data-form="member-add" data-pole="${esc(p.id)}">
          <select name="user_id" required><option value="">Ajouter un membre…</option>${addable.map((u) => `<option value="${esc(u.id)}">${esc(u.full_name)}</option>`).join('')}</select>
          <button class="btn small" type="submit">Ajouter</button></form>` : ''}
        ${isStaff() && !isAdmin() ? '<p class="muted small">Seuls les admins et le respo gèrent l\'équipe.</p>' : ''}
      </div>
    </section>

    ${p.layout.map((sec) => renderSection(p, sec)).join('')}`;
}

// ---------- Sections ----------
function renderSection(p, sec) {
  const its = itemsOf(p.id, sec.key);
  const can = canWrite(p.id, sec);
  const body = {
    files: secFiles, quotes: secQuotes, ideas: secIdeas, notes: secNotes, sales: secSales,
    partners: secPartners, schedule: secSchedule, apartments: secApartments,
  }[sec.type]?.(p, sec, its) ?? '';
  const addLabel = { files: 'Déposer', quotes: 'Ajouter un devis', ideas: 'Ajouter une idée', notes: 'Ajouter une note', sales: 'Nouvelle vente', partners: 'Ajouter un partenaire', schedule: 'Ajouter une étape', apartments: 'Ajouter un appartement' }[sec.type];
  return `<section class="section" id="sec-${esc(sec.key)}">
    <div class="section-head">
      <h2>${esc(sec.title)} <span class="count">${its.length}</span></h2>
      ${sec.lead_only ? '<span class="muted small">Réservé au respo</span>' : ''}
      <span class="spacer"></span>
      ${can ? `<button class="btn primary small" data-action="item-new" data-pole="${esc(p.id)}" data-section="${esc(sec.key)}">${icon('plus')} ${addLabel}</button>` : ''}
    </div>
    ${body}
  </section>`;
}

function itemActions(it, sec) {
  if (!canEditItem(it, sec)) return '';
  return `<span class="item-actions">
    <button class="icon-btn" data-action="item-edit" data-id="${esc(it.id)}" title="Modifier">${icon('edit')}</button>
    <button class="icon-btn no" data-action="item-delete" data-id="${esc(it.id)}" title="Supprimer">${icon('trash')}</button></span>`;
}

const byline = (it) => `<span class="muted small">${esc(firstName(it.created_by))} · ${fmtDate(it.created_at)}</span>`;

function commentsBlock(it, sec) {
  if (!sec.comments) return '';
  const cs = state.comments.filter((c) => c.item_id === it.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const open = state.openComments.has(it.id);
  return `<div class="comments">
    <button class="btn ghost small" data-action="comments-toggle" data-id="${esc(it.id)}">${icon('chat')} ${cs.length ? plural(cs.length, 'commentaire') : 'Commenter'}</button>
    ${open ? `<ul class="comment-list">${cs.map((c) => `<li><strong>${esc(firstName(c.author_id))}</strong> <span class="muted small">${fmtDate(c.created_at)}</span>
        ${c.author_id === state.me.id || manages(it.pole_id) ? `<button class="icon-btn no" data-action="comment-delete" data-id="${esc(c.id)}" title="Supprimer le commentaire">${icon('x')}</button>` : ''}
        <div class="comment-body">${esc(c.body)}</div></li>`).join('')}</ul>
      <form class="inline-add" data-form="comment" data-item="${esc(it.id)}"><input name="body" required maxlength="2000" placeholder="Ton commentaire…"><button class="btn small" type="submit">Envoyer</button></form>` : ''}
  </div>`;
}

// Aperçu d'un fichier, d'un lien ou d'un texte. Les adresses des fichiers sont ajoutées ensuite (hydrate).
function preview(it, { compact = false } = {}) {
  const t = it.file_type || '';
  if (it.file_path) {
    if (t.startsWith('image/')) return `<a class="pv pv-img" data-path="${esc(it.file_path)}" data-attr="href" target="_blank" rel="noopener"><img data-path="${esc(it.file_path)}" alt="${esc(it.data.title || it.file_name)}"></a>`;
    if (t.startsWith('video/')) return `<video class="pv" controls preload="metadata" data-path="${esc(it.file_path)}"></video>`;
    if (t.startsWith('audio/')) return `<div class="pv pv-audio"><span class="file-ico">${icon('music')}</span><audio controls preload="none" data-path="${esc(it.file_path)}"></audio></div>`;
    const ico = icon('file');
    return `<div class="pv pv-file"><span class="file-ico">${ico}</span><span class="fname">${esc(it.file_name)}</span>
      ${t === 'application/pdf' && !compact ? `<button class="btn small" data-action="pdf-preview" data-path="${esc(it.file_path)}" data-name="${esc(it.file_name)}">Aperçu</button>` : ''}
      <a class="btn small" data-path="${esc(it.file_path)}" data-attr="href" download="${esc(it.file_name)}" target="_blank" rel="noopener">Ouvrir</a></div>`;
  }
  if (it.link_url) {
    let host = it.link_url; try { host = new URL(it.link_url).hostname.replace(/^www\./, ''); } catch { /* lien brut */ }
    return `<a class="pv pv-link" href="${esc(safeUrl(it.link_url))}" target="_blank" rel="noopener noreferrer"><span class="file-ico">${icon('link')}</span><span>${esc(host)}</span></a>`;
  }
  if (it.data.text) return `<div class="pv pv-text">${esc(it.data.text)}</div>`;
  return '';
}

const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');

function secFiles(p, sec, its) {
  if (!its.length) return `<p class="empty">Rien pour l'instant.</p>`;
  return `<div class="file-grid">${its.map((it) => `<article class="file-card">
      ${preview(it)}
      <div class="file-meta"><strong>${esc(it.data.title || it.file_name || 'Sans titre')}</strong>${itemActions(it, sec)}</div>
      ${it.data.note ? `<p class="small">${esc(it.data.note)}</p>` : ''}
      ${byline(it)}
      ${commentsBlock(it, sec)}
    </article>`).join('')}</div>`;
}

function secQuotes(p, sec, its) {
  if (!its.length) return `<p class="empty">Aucun devis pour l'instant.</p>`;
  const cats = sec.categories?.length ? sec.categories : [''];
  const groups = cats.map((c) => ({ c, list: its.filter((i) => (cats.length === 1 && !c) || (i.data.category || cats[0]) === c) }));
  const mins = groups.map((g) => g.list.length ? Math.min(...g.list.map((i) => Number(i.data.price) || 0)) : 0);
  const estimate = mins.reduce((s, v) => s + v, 0);
  return `<div class="panel tight">
    <table class="table"><thead><tr><th>Devis</th>${cats[0] ? '<th>Catégorie</th>' : ''}<th>Prestataire</th><th class="r">Prix</th><th>Pièce jointe</th><th></th></tr></thead><tbody>
    ${groups.flatMap((g, gi) => g.list.sort((a, b) => (a.data.price || 0) - (b.data.price || 0)).map((it) => `<tr>
      <td><strong>${esc(it.data.label)}</strong>${it.data.note ? `<div class="muted small">${esc(it.data.note)}</div>` : ''}</td>
      ${cats[0] ? `<td><span class="tag">${esc(it.data.category || cats[0])}</span></td>` : ''}
      <td class="muted">${esc(it.data.provider || '')}</td>
      <td class="r nowrap"><strong>${eur(it.data.price)}</strong>${g.list.length > 1 && Number(it.data.price) === mins[gi] ? ' <span class="tag good">moins cher</span>' : ''}</td>
      <td>${it.file_path || it.link_url ? preview(it, { compact: true }) : '<span class="muted small">—</span>'}</td>
      <td class="actions">${itemActions(it, sec)}</td></tr>`)).join('')}
    </tbody></table>
    <div class="totals">${groups.filter((g) => g.c).map((g, i) => `<span>${esc(g.c)} : ${g.list.length ? `à partir de <strong>${eur(mins[groups.indexOf(g)])}</strong>` : 'aucun devis'}</span>`).join('')}
      <span class="total-main">Estimation (devis les moins chers) : <strong>${eur(estimate)}</strong></span></div>
  </div>`;
}

function secIdeas(p, sec, its) {
  if (!its.length) return `<p class="empty">Aucune idée pour l'instant.</p>`;
  const f = sec.fields || [];
  const total = f.includes('qty') && f.includes('price') ? its.reduce((s, i) => s + (Number(i.data.qty) || 0) * (Number(i.data.price) || 0), 0) : null;
  return `<div class="idea-grid">${its.map((it) => `<article class="idea-card">
      ${it.file_path ? preview(it) : ''}
      <div class="idea-body">
        <div class="file-meta"><strong>${esc(it.data.title)}</strong>${itemActions(it, sec)}</div>
        ${it.data.description ? `<p class="small">${esc(it.data.description)}</p>` : ''}
        ${f.includes('qty') || f.includes('price') ? `<div class="idea-figs">
          ${f.includes('qty') && it.data.qty != null ? `<span>${it.data.qty} ex.</span>` : ''}
          ${f.includes('price') && it.data.price != null ? `<span>${eur(it.data.price)}${f.includes('qty') ? ' / u' : ''}</span>` : ''}
          ${f.includes('qty') && f.includes('price') && it.data.qty != null && it.data.price != null ? `<strong>= ${eur(it.data.qty * it.data.price)}</strong>` : ''}
        </div>` : ''}
        ${f.includes('ingredients') && it.data.ingredients ? `<p class="small"><span class="muted">Ingrédients :</span> ${esc(it.data.ingredients)}</p>` : ''}
        ${byline(it)}
      </div>
      ${commentsBlock(it, sec)}
    </article>`).join('')}</div>
    ${total != null ? `<div class="totals"><span class="total-main">Total estimé : <strong>${eur(total)}</strong></span></div>` : ''}`;
}

function secNotes(p, sec, its) {
  if (!its.length) return `<p class="empty">Aucune note pour l'instant.</p>`;
  return `<div class="notes">${its.map((it) => `<article class="note">
    <div class="file-meta">${it.data.title ? `<strong>${esc(it.data.title)}</strong>` : '<span></span>'}${itemActions(it, sec)}</div>
    <div class="note-text">${esc(it.data.text)}</div>${byline(it)}${commentsBlock(it, sec)}</article>`).join('')}</div>`;
}

function secSales(p, sec, its) {
  if (!its.length) return `<p class="empty">Aucune vente enregistrée.</p>`;
  const list = its.slice().sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''));
  const total = its.reduce((s, i) => s + (Number(i.data.revenue) || 0), 0);
  const people = its.reduce((s, i) => s + (Number(i.data.people) || 0), 0);
  return `<section class="kpis small-kpis">
      <div class="kpi"><div class="kpi-label">Recette totale</div><div class="kpi-value">${eur(total)}</div></div>
      <div class="kpi"><div class="kpi-label">Ventes</div><div class="kpi-value">${its.length}</div></div>
      <div class="kpi"><div class="kpi-label">Recette moyenne</div><div class="kpi-value">${eur(total / its.length)}</div></div>
      <div class="kpi"><div class="kpi-label">Personnes mobilisées (moy.)</div><div class="kpi-value">${(people / its.length).toFixed(1).replace('.', ',')}</div></div>
    </section>
    <div class="panel tight"><table class="table"><thead><tr><th>Date</th><th>Vente</th><th class="r">Personnes</th><th class="r">Recette</th><th></th></tr></thead><tbody>
    ${list.map((it) => `<tr><td class="nowrap">${fmtDate(it.data.date, true)}</td><td>${esc(it.data.label || '')}${it.data.note ? `<div class="muted small">${esc(it.data.note)}</div>` : ''}</td>
      <td class="r">${it.data.people ?? '—'}</td><td class="r"><strong>${eur(it.data.revenue)}</strong></td><td class="actions">${itemActions(it, sec)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function secPartners(p, sec, its) {
  if (!its.length) return `<p class="empty">Aucun partenaire pour l'instant.</p>`;
  return `<div class="idea-grid">${its.map((it) => `<article class="idea-card partner">
    <div class="idea-body">
      <div class="file-meta"><span class="partner-name">${it.file_path ? `<img class="logo-sm" data-path="${esc(it.file_path)}" alt="">` : ''}<strong>${esc(it.data.name)}</strong></span>${itemActions(it, sec)}</div>
      <p class="small"><span class="muted">Avantages :</span> ${esc(it.data.advantages || '—')}</p>
      ${it.data.contact ? `<p class="small"><span class="muted">Contact :</span> ${esc(it.data.contact)}</p>` : ''}
      ${it.link_url ? `<a class="small" href="${esc(safeUrl(it.link_url))}" target="_blank" rel="noopener noreferrer">Site web</a>` : ''}
      ${byline(it)}
    </div></article>`).join('')}</div>`;
}

function addMinutes(hhmm, min) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const t = h * 60 + m + (Number(min) || 0);
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function secSchedule(p, sec, its) {
  if (!its.length) return `<p class="empty">Aucune étape pour l'instant.</p>`;
  const list = its.slice().sort((a, b) => (a.data.time || '').localeCompare(b.data.time || ''));
  const total = list.reduce((s, i) => s + (Number(i.data.duration) || 0), 0);
  return `<div class="panel tight"><ol class="schedule">${list.map((it) => `<li>
      <span class="sch-time">${esc(it.data.time || '--:--')}<small>→ ${addMinutes(it.data.time, it.data.duration)}</small></span>
      <span class="sch-body"><strong>${esc(it.data.title)}</strong><span class="muted small">${it.data.duration ? `${it.data.duration} min` : ''}${it.data.who ? ` · ${esc(it.data.who)}` : ''}</span>
        ${it.data.note ? `<span class="small">${esc(it.data.note)}</span>` : ''}</span>
      ${itemActions(it, sec)}</li>`).join('')}</ol>
    <div class="totals"><span class="total-main">Durée totale : <strong>${Math.floor(total / 60) ? `${Math.floor(total / 60)} h ` : ''}${total % 60} min</strong></span></div></div>`;
}

function secApartments(p, sec, its) {
  return `<div class="apt-layout">
    <div class="map" id="map-${esc(p.id)}-${esc(sec.key)}" data-map-pole="${esc(p.id)}" data-map-section="${esc(sec.key)}"></div>
    <div class="apt-list">${its.length ? its.map((it, i) => `<article class="apt">
      <div class="file-meta"><strong><span class="pin">${i + 1}</span> ${esc(it.data.name)}</strong>${itemActions(it, sec)}</div>
      ${it.data.address ? `<p class="muted small">${esc(it.data.address)}</p>` : ''}
      <ul class="roles">${(it.data.roles || []).map((r) => `<li><strong>${esc(r.person)}</strong> : ${esc(r.role)}</li>`).join('') || '<li class="muted small">Aucun rôle attribué.</li>'}</ul>
      ${it.data.lat == null ? '<p class="muted small">Pas encore placé sur la carte.</p>' : ''}
    </article>`).join('') : '<p class="empty">Aucun appartement pour l\'instant.</p>'}</div>
  </div>`;
}

// ---------- Fichiers et cartes après affichage ----------
async function hydrate(root = document) {
  for (const el of root.querySelectorAll('[data-path]')) {
    const url = await api.fileUrl(el.dataset.path);
    if (!url) continue;
    if (el.dataset.attr === 'href') el.href = url; else el.src = url;
  }
  const maps = root.querySelectorAll('[data-map-pole]');
  if (maps.length) {
    const L = await loadLeaflet().catch(() => null);
    if (!L) { maps.forEach((m) => { m.innerHTML = '<p class="empty">Carte indisponible (pas de connexion ?).</p>'; }); return; }
    for (const el of maps) {
      const its = itemsOf(el.dataset.mapPole, el.dataset.mapSection).filter((i) => i.data.lat != null);
      const map = L.map(el, { scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      const all = itemsOf(el.dataset.mapPole, el.dataset.mapSection);
      const pts = its.map((it) => {
        const n = all.indexOf(it) + 1;
        L.marker([it.data.lat, it.data.lng], { icon: L.divIcon({ className: 'map-pin', html: `<span>${n}</span>`, iconSize: [26, 26] }) })
          .addTo(map).bindPopup(`<strong>${esc(it.data.name)}</strong><br>${(it.data.roles || []).map((r) => `${esc(r.person)} : ${esc(r.role)}`).join('<br>')}`);
        return [it.data.lat, it.data.lng];
      });
      if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30] });
      else if (pts.length === 1) map.setView(pts[0], 15);
      else map.setView([46.6, 2.4], 5);
    }
  }
}

let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  leafletPromise ||= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.append(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve(window.L); s.onerror = reject;
    document.head.append(s);
  });
  return leafletPromise;
}

// ---------- Administration ----------
function viewManagePoles() {
  return `
    <header class="page-head"><div><h1>Gérer les pôles</h1><p class="muted">Créer, renommer, choisir la disposition et la jauge de chaque pôle.</p></div>
      <div class="row">
        <label class="btn" title="Reprendre les pôles, estimations, objectifs et contenus saisis en mode démo">Importer des données de la démo…<input type="file" accept=".json,application/json" data-input="import-demo" hidden></label>
        <button class="btn primary" data-action="new-pole">${icon('plus')} Nouveau pôle</button>
      </div></header>
    <section class="panel">
      ${state.poles.length ? `<table class="table"><thead><tr><th>Pôle</th><th>Sections</th><th>Jauge</th><th>Responsables</th><th>Membres</th><th></th></tr></thead><tbody>
      ${state.poles.map((p) => `<tr>
        <td><span class="dot" style="background:${esc(p.color)}"></span> <strong>${esc(p.name)}</strong></td>
        <td class="muted small">${esc(p.layout.map((s) => s.title).join(' · '))}</td>
        <td>${p.has_gauge ? 'Oui' : 'Non'}</td>
        <td>${esc(leadsOf(p.id).map(firstName).join(', ') || '—')}</td>
        <td>${state.members.filter((m) => m.pole_id === p.id).length}</td>
        <td class="actions"><button class="btn small" data-action="edit-pole" data-id="${esc(p.id)}">Modifier</button><button class="btn small danger" data-action="delete-pole" data-id="${esc(p.id)}">Supprimer</button></td>
      </tr>`).join('')}</tbody></table>` : '<p class="empty">Aucun pôle.</p>'}
    </section>`;
}

function viewMembers() {
  const reqOf = (uid) => state.requests.filter((q) => q.user_id === uid && pole(q.pole_id));
  const waiting = state.profiles.filter((p) => !p.approved || reqOf(p.id).length)
    .sort((a, b) => Number(a.approved) - Number(b.approved) || a.full_name.localeCompare(b.full_name));
  const members = state.profiles.filter((p) => p.approved).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const nick = (id) => { const e = api.nickOf(state.emails[id] || ''); return e ? `<span class="muted small">${e.includes('@') ? esc(e) : '@' + esc(e)}</span>` : ''; };
  const polesOf = (uid) => state.members.filter((m) => m.user_id === uid && pole(m.pole_id))
    .map((m) => `<span class="chip" style="--c:${esc(pole(m.pole_id).color)}">${esc(pole(m.pole_id).name)}${m.role === 'responsable' ? ' · respo' : ''}</span>`).join('');

  const reqCard = (p) => {
    const rs = reqOf(p.id);
    return `<article class="req-card">
      <div class="req-head">
        <span class="avatar">${esc(initials(p.id))}</span>
        <div class="grow"><strong>${esc(p.full_name)}</strong> ${nick(p.id)}<div class="small ${p.approved ? 'muted' : 'new'}">${p.approved ? 'Déjà membre, demande un pôle de plus' : 'Nouveau compte, pas encore validé'}</div></div>
        ${rs.length > 1 ? `<button class="btn small primary" data-action="req-accept-all" data-user="${esc(p.id)}">${icon('check')} Tout accepter</button>` : ''}
        ${!p.approved && !rs.length ? `<button class="btn small primary" data-action="approve" data-id="${esc(p.id)}">Valider sans pôle</button>` : ''}
        ${!p.approved ? `<button class="btn small danger" data-action="user-delete" data-id="${esc(p.id)}">Supprimer</button>` : ''}
      </div>
      <div class="req-poles">${rs.map((q) => `<span class="req-chip" style="--c:${esc(pole(q.pole_id).color)}">
          <span class="dot" style="background:${esc(pole(q.pole_id).color)}"></span>${esc(pole(q.pole_id).name)}
          <button class="icon-btn ok" data-action="req-accept" data-pole="${esc(q.pole_id)}" data-user="${esc(p.id)}" title="Accepter">${icon('check')}</button>
          <button class="icon-btn no" data-action="req-refuse" data-pole="${esc(q.pole_id)}" data-user="${esc(p.id)}" title="Refuser">${icon('x')}</button></span>`).join('')
        || '<span class="muted small">N\'a encore demandé aucun pôle.</span>'}</div>
    </article>`;
  };

  const row = (p) => `<tr>
    <td><div class="who-cell"><span class="avatar xs">${esc(initials(p.id))}</span><div><strong>${esc(p.full_name)}</strong>${p.id === state.me.id ? ' <span class="muted small">(toi)</span>' : ''}<div>${nick(p.id)}</div></div></div></td>
    <td>${p.id === state.me.id ? `<span class="tag strong">${ROLE_LABEL[p.role]}</span>`
      : `<select data-input="global-role" data-id="${esc(p.id)}" aria-label="Rôle de ${esc(p.full_name)}">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}" ${k === p.role ? 'selected' : ''}>${v}</option>`).join('')}</select>`}</td>
    <td><div class="chips">${['admin', 'bureau'].includes(p.role) ? '<span class="muted small">Tous les pôles (vue d\'ensemble)</span>' : polesOf(p.id) || '<span class="muted small">Aucun pôle : ne voit rien</span>'}</div></td>
    <td class="actions">
      <button class="btn small" data-action="member-poles" data-id="${esc(p.id)}">Pôles…</button>
      ${p.id === state.me.id ? '' : `<button class="icon-btn" data-action="pw-reset" data-id="${esc(p.id)}" title="Donner un nouveau mot de passe">${icon('key')}</button>
        <button class="icon-btn no" data-action="revoke" data-id="${esc(p.id)}" title="Retirer l'accès">${icon('x')}</button>`}</td>
  </tr>`;

  return `
    <header class="page-head"><div><h1>Membres et demandes</h1>
      <p class="muted">Chacun demande ses pôles, tu attribues. Tu peux aussi ajuster le rôle de chaque personne.</p></div></header>

    <h2>Demandes en attente <span class="count">${waiting.length}</span></h2>
    ${waiting.length ? `<section class="req-list">${waiting.map(reqCard).join('')}</section>` : '<p class="empty">Rien à valider pour l\'instant.</p>'}

    <h2>Rôles</h2>
    <section class="role-grid">
      <div class="role-card"><strong>Admin</strong><p>Voit tout, modifie tout, gère les comptes, les rôles et les pôles.</p></div>
      <div class="role-card"><strong>Bureau</strong><p>Vue d'ensemble de tous les pôles, peut tout modifier. Ne gère pas les accès.</p></div>
      <div class="role-card"><strong>Membre</strong><p>Ne voit que ses pôles. « Respo » d'un pôle : gère sa jauge, ses objectifs et son équipe.</p></div>
    </section>

    <h2>Membres <span class="count">${members.length}</span></h2>
    <section class="panel tight"><table class="table"><thead><tr><th>Nom</th><th>Rôle</th><th>Pôles</th><th></th></tr></thead><tbody>${members.map(row).join('')}</tbody></table></section>`;
}

// ---------- Fenêtres de saisie ----------
function openModal(html, onSubmit, after) {
  $modal.innerHTML = `<form method="dialog" class="form modal-form">${html}</form>`;
  const form = $modal.querySelector('form');
  form.addEventListener('submit', async (e) => {
    const action = e.submitter?.value;
    if (action === 'cancel') return;
    e.preventDefault();
    const btns = form.querySelectorAll('button'); btns.forEach((b) => (b.disabled = true));
    const ok = await onSubmit(action === 'delete' ? null : form, action || 'save');
    btns.forEach((b) => (b.disabled = false));
    if (ok) $modal.close();
  });
  $modal.showModal();
  form.querySelector('input:not([type=hidden]):not([type=radio]), textarea, select')?.focus();
  after?.(form);
}

const modalButtons = (canDelete) => `<div class="modal-actions">
  ${canDelete ? '<button class="btn danger" value="delete" formnovalidate>Supprimer</button>' : ''}
  <span class="spacer"></span>
  <button class="btn" value="cancel" formnovalidate>Annuler</button>
  <button class="btn primary" value="save">Enregistrer</button></div>`;

function options(items, selected, empty) {
  return (empty ? `<option value="">${empty}</option>` : '') +
    items.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
}

const fileInput = (label, accept, it) => `<label>${label}<input type="file" name="file" ${accept ? `accept="${accept}"` : ''}>
  <span class="muted small">${it?.file_path ? `Actuel : ${esc(it.file_name)} (laisser vide pour le garder)` : `${api.MAX_FILE_MB} Mo maximum ; pour une vidéo lourde, mets plutôt un lien.`}</span></label>`;

function itemForm(p, sec, it) {
  const isNew = !it;
  const d = it?.data || {};
  const f = sec.fields || [];
  let fields = '';
  switch (sec.type) {
    case 'files': {
      const mode = it ? (it.file_path ? 'file' : it.link_url ? 'link' : 'text') : 'file';
      fields = `<label>Titre<input name="title" maxlength="200" value="${esc(d.title || '')}" placeholder="ex. Prod v2, Version finale…"></label>
        <div class="seg" role="radiogroup">${[['file', 'Fichier'], ['link', 'Lien'], ['text', 'Texte']].map(([v, l]) => `<label><input type="radio" name="mode" value="${v}" ${mode === v ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        <div data-mode="file">${fileInput('Fichier (image, vidéo, audio, PDF…)', '', it)}</div>
        <div data-mode="link"><label>Lien (Drive, YouTube, SoundCloud…)<input name="link_url" type="url" value="${esc(it?.link_url || '')}" placeholder="https://"></label></div>
        <div data-mode="text"><label>Texte<textarea name="text" rows="8">${esc(d.text || '')}</textarea></label></div>
        <label>Note (facultatif)<input name="note" maxlength="300" value="${esc(d.note || '')}"></label>`;
      break;
    }
    case 'quotes':
      fields = `<label>Objet du devis<input name="label" required maxlength="200" value="${esc(d.label || '')}" placeholder="ex. Car 50 places aller-retour"></label>
        <div class="grid2">
          ${sec.categories?.length > 1 ? `<label>Catégorie<select name="category">${options(sec.categories.map((c) => [c, c]), d.category || sec.categories[0])}</select></label>` : `<input type="hidden" name="category" value="${esc(sec.categories?.[0] || '')}">`}
          <label>Prix total (€)<input name="price" type="number" min="0" step="0.01" required value="${d.price ?? ''}"></label>
          <label>Prestataire<input name="provider" maxlength="120" value="${esc(d.provider || '')}"></label>
        </div>
        ${fileInput('Devis en pièce jointe (PDF, photo…)', '', it)}
        <label>Note<input name="note" maxlength="300" value="${esc(d.note || '')}"></label>`;
      break;
    case 'ideas':
      fields = `<label>Idée<input name="title" required maxlength="200" value="${esc(d.title || '')}"></label>
        <label>Description<textarea name="description" rows="2">${esc(d.description || '')}</textarea></label>
        <div class="grid2">
          ${f.includes('qty') ? `<label>Nombre<input name="qty" type="number" min="0" step="1" value="${d.qty ?? ''}"></label>` : ''}
          ${f.includes('price') ? `<label>Prix estimé${f.includes('qty') ? ' à l\'unité' : ''} (€)<input name="price" type="number" min="0" step="0.01" value="${d.price ?? ''}"></label>` : ''}
        </div>
        ${f.includes('ingredients') ? `<label>Ingrédients<textarea name="ingredients" rows="2">${esc(d.ingredients || '')}</textarea></label>` : ''}
        ${f.includes('image') ? fileInput('Image', 'image/*', it) : ''}`;
      break;
    case 'notes':
      fields = `<label>Titre (facultatif)<input name="title" maxlength="200" value="${esc(d.title || '')}"></label>
        <label>Texte<textarea name="text" rows="10" required>${esc(d.text || '')}</textarea></label>`;
      break;
    case 'sales':
      fields = `<div class="grid2">
          <label>Date<input name="date" type="date" required value="${esc(d.date || today())}"></label>
          <label>Lieu / nom de la vente<input name="label" maxlength="120" value="${esc(d.label || '')}"></label>
          <label>Personnes mobilisées<input name="people" type="number" min="0" step="1" required value="${d.people ?? ''}"></label>
          <label>Recette (€)<input name="revenue" type="number" min="0" step="0.01" required value="${d.revenue ?? ''}"></label>
        </div>
        <label>Note<input name="note" maxlength="300" value="${esc(d.note || '')}"></label>`;
      break;
    case 'partners':
      fields = `<label>Partenaire<input name="name" required maxlength="120" value="${esc(d.name || '')}"></label>
        <label>Avantages donnés<textarea name="advantages" rows="3" required>${esc(d.advantages || '')}</textarea></label>
        <div class="grid2">
          <label>Contact<input name="contact" maxlength="200" value="${esc(d.contact || '')}"></label>
          <label>Site web<input name="link_url" type="url" value="${esc(it?.link_url || '')}" placeholder="https://"></label>
        </div>
        ${fileInput('Logo', 'image/*', it)}`;
      break;
    case 'schedule':
      fields = `<div class="grid2">
          <label>Heure<input name="time" type="time" required value="${esc(d.time || '')}"></label>
          <label>Durée (minutes)<input name="duration" type="number" min="0" step="1" required value="${d.duration ?? ''}"></label>
        </div>
        <label>Étape<input name="title" required maxlength="200" value="${esc(d.title || '')}"></label>
        <label>Qui<input name="who" maxlength="120" value="${esc(d.who || '')}"></label>
        <label>Note<input name="note" maxlength="300" value="${esc(d.note || '')}"></label>`;
      break;
    case 'apartments':
      fields = `<label>Nom de l'appartement<input name="name" required maxlength="120" value="${esc(d.name || '')}" placeholder="ex. Appart 1 (cuisine)"></label>
        <label>Adresse (visible des seuls membres du pôle)<input name="address" maxlength="200" value="${esc(d.address || '')}"></label>
        <label>Rôles (une ligne par personne : « Prénom : rôle »)<textarea name="roles" rows="4">${esc((d.roles || []).map((r) => `${r.person} : ${r.role}`).join('\n'))}</textarea></label>
        <div><span class="lbl">Emplacement : clique sur la carte</span><div class="map map-pick" id="pick-map"></div>
          <input type="hidden" name="lat" value="${d.lat ?? ''}"><input type="hidden" name="lng" value="${d.lng ?? ''}"></div>`;
      break;
  }

  openModal(`<h2>${isNew ? 'Ajouter' : 'Modifier'} · ${esc(sec.title)}</h2>${fields}${modalButtons(!isNew && canEditItem(it, sec))}`,
    async (form, action) => {
      if (action === 'delete') return deleteItem(it);
      const v = Object.fromEntries(new FormData(form));
      const file = form.querySelector('[name=file]')?.files?.[0];
      try {
        const row = { data: buildData(sec, v), link_url: null };
        if (sec.type === 'files') {
          if (v.mode === 'link') { if (!v.link_url) throw new Error('Indique le lien.'); row.link_url = v.link_url; }
          if (v.mode === 'text' && !v.text.trim()) throw new Error('Écris le texte.');
          if (v.mode === 'file' && !file && !it?.file_path) throw new Error('Choisis un fichier.');
          if (v.mode !== 'file') Object.assign(row, { file_path: null, file_name: null, file_type: null, file_size: null });
          if (v.mode !== 'text') row.data.text = '';
        }
        if (sec.type === 'partners') row.link_url = v.link_url || null;
        if (sec.type === 'quotes' && it?.link_url) row.link_url = it.link_url;
        if (file) Object.assign(row, await api.uploadFile(p.id, file));
        const oldPath = it?.file_path;
        if (isNew) await api.insert('items', { pole_id: p.id, section: sec.key, position: Date.now() % 2147483647, ...row });
        else await api.update('items', { id: it.id }, row);
        if (oldPath && ('file_path' in row) && row.file_path !== oldPath) await api.removeFile(oldPath);
        toast(isNew ? 'Ajouté.' : 'Enregistré.');
        await loadAll(); render(); return true;
      } catch (e) { toast(e.message, 'err'); return false; }
    },
    (form) => {
      if (sec.type === 'files') {
        const sync = () => { const m = form.querySelector('[name=mode]:checked').value; form.querySelectorAll('[data-mode]').forEach((el) => { el.hidden = el.dataset.mode !== m; }); };
        form.querySelectorAll('[name=mode]').forEach((r) => r.addEventListener('change', sync)); sync();
      }
      if (sec.type === 'apartments') pickMap(form, d);
    });
}

async function pickMap(form, d) {
  const L = await loadLeaflet().catch(() => null);
  const el = form.querySelector('#pick-map');
  if (!L) { el.innerHTML = '<p class="empty">Carte indisponible.</p>'; return; }
  const map = L.map(el);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const others = state.items.filter((i) => i.section === 'orga' || i.data?.lat != null).filter((i) => i.data.lat != null);
  let marker = null;
  const set = (lat, lng) => {
    form.querySelector('[name=lat]').value = lat.toFixed(6); form.querySelector('[name=lng]').value = lng.toFixed(6);
    if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map);
  };
  if (d.lat != null) { map.setView([d.lat, d.lng], 15); set(d.lat, d.lng); }
  else if (others.length) map.setView([others[0].data.lat, others[0].data.lng], 13);
  else map.setView([46.6, 2.4], 5);
  map.on('click', (e) => set(e.latlng.lat, e.latlng.lng));
  setTimeout(() => map.invalidateSize(), 150);
}

function buildData(sec, v) {
  const t = (k) => (v[k] ?? '').trim();
  switch (sec.type) {
    case 'files': return { title: t('title'), note: t('note'), text: v.text ?? '' };
    case 'quotes': return { label: t('label'), category: t('category'), price: num(v.price), provider: t('provider'), note: t('note') };
    case 'ideas': return { title: t('title'), description: t('description'), qty: num(v.qty), price: num(v.price), ingredients: t('ingredients') };
    case 'notes': return { title: t('title'), text: v.text ?? '' };
    case 'sales': return { date: v.date, label: t('label'), people: num(v.people), revenue: num(v.revenue), note: t('note') };
    case 'partners': return { name: t('name'), advantages: t('advantages'), contact: t('contact') };
    case 'schedule': return { time: v.time, duration: num(v.duration), title: t('title'), who: t('who'), note: t('note') };
    case 'apartments': return {
      name: t('name'), address: t('address'), lat: num(v.lat), lng: num(v.lng),
      roles: t('roles').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [person, ...r] = l.split(/\s*:\s*/); return { person: person.trim(), role: r.join(' : ').trim() }; }),
    };
    default: return {};
  }
}

async function deleteItem(it) {
  if (!confirm('Supprimer cet élément ? Cette action est définitive.')) return false;
  try {
    await api.remove('items', { id: it.id });
    await api.removeFile(it.file_path);
    toast('Supprimé.'); await loadAll(); render(); return true;
  } catch (e) { toast(e.message, 'err'); return false; }
}

function poleForm(p) {
  const isNew = !p;
  const admin = isAdmin();
  openModal(`
    <h2>${isNew ? 'Nouveau pôle' : `Modifier · ${esc(p.name)}`}</h2>
    ${admin ? `<label>Nom<input name="name" required maxlength="80" value="${esc(p?.name || '')}"></label>` : ''}
    <label>Description<textarea name="description" rows="2">${esc(p?.description || '')}</textarea></label>
    <div class="grid2">
      <label>Date clé (événement, rendu…)<input type="date" name="event_date" value="${esc(p?.event_date || '')}"></label>
      <label>Couleur<input type="color" name="color" value="${esc(p?.color || '#4f5bd5')}"></label>
      ${admin ? `<label>Disposition${isNew ? '' : ' (remplace les sections)'}<select name="tpl">${isNew ? '' : '<option value="">Garder la disposition actuelle</option>'}${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}">${esc(t.label)} : ${esc(t.layout.map((s) => SECTION_TYPES[s.type]).join(', '))}</option>`).join('')}</select></label>
      <label>Ordre d'affichage<input type="number" name="position" value="${p?.position ?? state.poles.length + 1}"></label>
      <label class="check"><input type="checkbox" name="has_gauge" ${(p ? p.has_gauge : true) ? 'checked' : ''}> Jauge d'avancement /100</label>` : ''}
    </div>
    ${admin && !isNew ? '<p class="muted small">Changer de disposition ne supprime pas le contenu, mais les sections retirées ne sont plus affichées.</p>' : ''}
    ${modalButtons(false)}`,
  async (form) => {
    const v = Object.fromEntries(new FormData(form));
    const row = { description: v.description.trim(), event_date: v.event_date || null, color: v.color };
    if (admin) {
      Object.assign(row, { name: v.name.trim(), position: Number(v.position) || 0, has_gauge: !!v.has_gauge });
      if (v.tpl) row.layout = TEMPLATES[v.tpl].layout;
    }
    return run(() => (isNew ? api.insert('poles', row) : api.update('poles', { id: p.id }, row)), isNew ? 'Pôle créé.' : 'Pôle enregistré.');
  });
}

function memberPolesForm(uid) {
  const cur = (pid) => state.members.find((m) => m.pole_id === pid && m.user_id === uid)?.role || '';
  openModal(`
    <h2>Pôles de ${esc(nameOf(uid))}</h2>
    <p class="muted small">Cette personne ne verra que les pôles choisis ici. Un respo gère la jauge, les objectifs et l'équipe de son pôle.</p>
    <div class="pole-access">${state.poles.map((p) => `<label class="row-between"><span><span class="dot" style="background:${esc(p.color)}"></span> ${esc(p.name)}</span>
      <select name="${esc(p.id)}">${options([['membre', 'Membre'], ['responsable', 'Responsable']], cur(p.id), 'Pas d\'accès')}</select></label>`).join('')}</div>
    ${modalButtons(false)}`,
  async (form) => {
    const v = Object.fromEntries(new FormData(form));
    return run(async () => {
      for (const p of state.poles) {
        const before = cur(p.id); const after = v[p.id] || '';
        if (before === after) continue;
        if (!after) await api.remove('pole_members', { pole_id: p.id, user_id: uid });
        else if (!before) await api.insert('pole_members', { pole_id: p.id, user_id: uid, role: after });
        else await api.update('pole_members', { pole_id: p.id, user_id: uid }, { role: after });
      }
    }, 'Accès enregistrés.');
  });
}

function meForm() {
  openModal(`<h2>Mon profil</h2>
    <label>Surnom affiché<input name="full_name" required maxlength="80" value="${esc(state.me.full_name)}"></label>
    ${api.DEMO ? '' : `<label>Nouveau mot de passe (laisser vide pour ne pas changer)<input name="password" type="password" minlength="6" autocomplete="new-password"></label>
    <p class="muted small">Tu te connectes toujours avec le surnom choisi à l'inscription, même si tu changes le surnom affiché.</p>`}
    ${modalButtons(false)}`,
  (form) => {
    const v = Object.fromEntries(new FormData(form));
    return run(async () => {
      await api.update('profiles', { id: state.me.id }, { full_name: v.full_name.trim() });
      if (v.password) await api.changeMyPassword(v.password);
    }, v.password ? 'Profil et mot de passe enregistrés.' : 'Profil enregistré.');
  });
}

function joinModal() {
  const mine = new Set(state.requests.filter((q) => q.user_id === state.me.id).map((q) => q.pole_id));
  $modal.innerHTML = `<form method="dialog" class="form modal-form">
    <h2>Rejoindre un pôle</h2>
    <p class="muted small">Touche un pôle pour demander à le rejoindre. Un admin valide, puis le pôle apparaît dans ton menu.</p>
    ${pickGrid(mine)}
    <div class="modal-actions"><span class="spacer"></span><button class="btn primary" value="cancel">Terminé</button></div></form>`;
  if (!$modal.open) $modal.showModal();
}

function passwordResetForm(uid) {
  openModal(`<h2>Nouveau mot de passe pour ${esc(nameOf(uid))}</h2>
    <p class="muted small">À utiliser quand quelqu'un a oublié le sien. Donne-lui ce mot de passe : il pourra le changer ensuite dans « Mon profil ».</p>
    <label>Mot de passe provisoire<input name="password" required minlength="6" autocomplete="off" value="${Math.random().toString(36).slice(2, 10)}"></label>
    ${modalButtons(false)}`,
  async (form) => {
    try { await api.adminResetPassword(uid, new FormData(form).get('password')); toast('Mot de passe changé : transmets-le-lui.'); return true; }
    catch (e) { toast(e.message, 'err'); return false; }
  });
}

async function pdfPreview(path, name) {
  const url = await api.fileUrl(path);
  $modal.innerHTML = `<form method="dialog" class="modal-form pdf-modal"><div class="row-between"><h2>${esc(name)}</h2><button class="btn" value="cancel">Fermer</button></div>
    <iframe src="${esc(url)}" title="${esc(name)}"></iframe></form>`;
  $modal.showModal();
}

// ---------- Import des données saisies en mode démo ----------
// Reprend les pôles (fiche, disposition, estimation), les objectifs, les contenus et les commentaires.
// Les comptes et les équipes ne sont pas repris : ce sont de vraies personnes à inviter.
// Les fichiers déposés en démo n'existent que le temps de la page : seuls les liens, textes et images d'exemple suivent.
async function importDemo(file) {
  let db;
  try { db = JSON.parse(await file.text()); } catch { return toast('Fichier illisible.', 'err'); }
  if (db.format !== 'pilotage-demo' || !Array.isArray(db.poles)) return toast("Ce fichier n'est pas un export de la démo.", 'err');
  const nItems = (db.items || []).length;
  if (!confirm(`Importer ${db.poles.length} pôles, ${(db.weekly_goals || []).length} objectifs et ${nItems} contenus ?\nLes pôles qui existent déjà (même nom) seront mis à jour ; les contenus seront ajoutés.`)) return;
  const authorName = (id) => (db.profiles || []).find((p) => p.id === id)?.full_name?.split(' ')[0];
  let lost = 0;
  try {
    const poleIds = {};
    for (const p of db.poles) {
      const row = { name: p.name, description: p.description || '', color: p.color, position: p.position, event_date: p.event_date || null,
        has_gauge: !!p.has_gauge, layout: p.layout || [], estimate: p.estimate ?? null, estimate_note: p.estimate_note || '' };
      const existing = state.poles.find((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
      if (existing) { await api.update('poles', { id: existing.id }, row); poleIds[p.id] = existing.id; }
      else poleIds[p.id] = (await api.insert('poles', row)).id;
    }
    for (const g of db.weekly_goals || []) {
      if (!poleIds[g.pole_id]) continue;
      await api.insert('weekly_goals', { pole_id: poleIds[g.pole_id], week_start: g.week_start, title: g.title, done: !!g.done, position: g.position || 0 });
    }
    const itemIds = {};
    for (const it of db.items || []) {
      if (!poleIds[it.pole_id]) continue;
      const keepFile = it.file_path?.startsWith('data:');
      if (it.file_path && !keepFile) lost++;
      const row = { pole_id: poleIds[it.pole_id], section: it.section, data: it.data || {}, link_url: it.link_url || null, position: it.position || 0 };
      if (keepFile) Object.assign(row, { file_path: it.file_path, file_name: it.file_name, file_type: it.file_type, file_size: it.file_size });
      itemIds[it.id] = (await api.insert('items', row)).id;
    }
    for (const c of db.comments || []) {
      if (!itemIds[c.item_id]) continue;
      const who = authorName(c.author_id);
      await api.insert('comments', { item_id: itemIds[c.item_id], body: who ? `${who} : ${c.body}` : c.body });
    }
    toast(`Import terminé.${lost ? ` ${lost} fichier(s) déposé(s) en démo n'ont pas pu suivre : redépose-les.` : ''}`);
  } catch (e) { toast(`Import interrompu : ${e.message}`, 'err'); }
  await loadAll(); render();
}

// ---------- Événements ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !state.me) return;
  const { action, id } = el.dataset;
  if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
  const item = () => state.items.find((i) => i.id === id);
  const secOf = (it) => pole(it.pole_id)?.layout.find((s) => s.key === it.section);
  switch (action) {
    case 'reset-demo':
      if (!confirm('Réinitialiser la démo ? Tout ce que tu as saisi en démo sera effacé (pense à « Exporter mes données » avant).')) return;
      api.resetDemo(); return refreshSession();
    case 'export-demo': {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([api.exportDemo()], { type: 'application/json' }));
      a.download = `pilotage-demo-${today()}.json`;
      document.body.append(a); a.click(); a.remove();
      return toast('Fichier exporté : importe-le ensuite dans le vrai site (Gérer les pôles).');
    }
    case 'logout': await api.signOut(); state.me = null; location.hash = ''; return refreshSession();
    case 'refresh': await loadAll(); return redraw();
    case 'join-open': return joinModal();
    case 'request-toggle': {
      const pid = el.dataset.pole;
      const has = state.requests.some((q) => q.pole_id === pid && q.user_id === state.me.id);
      await run(() => (has ? api.remove('join_requests', { pole_id: pid, user_id: state.me.id }) : api.insert('join_requests', { pole_id: pid, user_id: state.me.id })),
        has ? 'Demande annulée.' : 'Demande envoyée.');
      if ($modal.open) joinModal();
      return;
    }
    case 'req-accept': return run(() => api.acceptRequest(el.dataset.pole, el.dataset.user), `${nameOf(el.dataset.user)} rejoint ${pole(el.dataset.pole)?.name}.`);
    case 'req-accept-all': {
      const list = state.requests.filter((q) => q.user_id === el.dataset.user);
      return run(async () => { for (const q of list) await api.acceptRequest(q.pole_id, q.user_id); }, `${plural(list.length, 'pôle')} attribué${list.length > 1 ? 's' : ''} à ${nameOf(el.dataset.user)}.`);
    }
    case 'req-refuse': return run(() => api.remove('join_requests', { pole_id: el.dataset.pole, user_id: el.dataset.user }), 'Demande refusée.');
    case 'pw-reset': return passwordResetForm(id);
    case 'user-delete':
      if (!confirm(`Supprimer définitivement le compte de ${nameOf(id)} ?`)) return;
      return run(() => api.adminDeleteUser(id), 'Compte supprimé.');
    case 'edit-me': return meForm();
    case 'new-pole': return poleForm(null);
    case 'edit-pole': return poleForm(pole(id));
    case 'delete-pole': {
      const p = pole(id);
      if (!confirm(`Supprimer le pôle « ${p.name} » et tout son contenu (objectifs, fichiers, devis…) ? Cette action est définitive.`)) return;
      const paths = state.items.filter((i) => i.pole_id === id && i.file_path).map((i) => i.file_path);
      return run(async () => { await api.remove('poles', { id }); for (const path of paths) await api.removeFile(path); }, 'Pôle supprimé.');
    }
    case 'week': state.week[el.dataset.pole] = (state.week[el.dataset.pole] || 0) + Number(el.dataset.delta); return render();
    case 'goal-delete': return run(() => api.remove('weekly_goals', { id }), 'Objectif supprimé.');
    case 'member-remove':
      if (!confirm(`Retirer ${nameOf(el.dataset.user)} du pôle ? Il n'y aura plus accès.`)) return;
      return run(() => api.remove('pole_members', { pole_id: el.dataset.pole, user_id: el.dataset.user }), 'Retiré du pôle.');
    case 'member-role': return run(() => api.update('pole_members', { pole_id: el.dataset.pole, user_id: el.dataset.user }, { role: el.dataset.role }), 'Rôle modifié.');
    case 'item-new': { const p = pole(el.dataset.pole); return itemForm(p, p.layout.find((s) => s.key === el.dataset.section), null); }
    case 'item-edit': { const it = item(); return itemForm(pole(it.pole_id), secOf(it), it); }
    case 'item-delete': return deleteItem(item());
    case 'comments-toggle': state.openComments.has(id) ? state.openComments.delete(id) : state.openComments.add(id); return render();
    case 'comment-delete': return run(() => api.remove('comments', { id }), 'Commentaire supprimé.');
    case 'pdf-preview': return pdfPreview(el.dataset.path, el.dataset.name);
    case 'approve': return run(() => api.update('profiles', { id }, { approved: true }), 'Compte validé.');
    case 'revoke':
      if (!confirm(`Retirer l'accès de ${nameOf(id)} ? Cette personne ne verra plus rien et sera retirée de tous ses pôles.`)) return;
      return run(() => api.update('profiles', { id }, { approved: false, role: 'membre' }), 'Accès retiré.');
    case 'member-poles': return memberPolesForm(id);
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(form));
  const { pole: pid } = form.dataset;
  switch (form.dataset.form) {
    case 'estimate':
      return run(() => api.update('poles', { id: pid }, { estimate: Number(v.estimate), estimate_note: (v.estimate_note || '').trim() }), 'Estimation enregistrée.');
    case 'goal': {
      const max = Math.max(0, ...state.goals.filter((g) => g.pole_id === pid).map((g) => g.position));
      return run(() => api.insert('weekly_goals', { pole_id: pid, week_start: form.dataset.week, title: v.title.trim(), position: max + 1 }), 'Objectif ajouté.');
    }
    case 'member-add': return run(() => api.insert('pole_members', { pole_id: pid, user_id: v.user_id, role: 'membre' }), 'Ajouté au pôle.');
    case 'comment': state.openComments.add(form.dataset.item); return run(() => api.insert('comments', { item_id: form.dataset.item, body: v.body.trim() }));
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  const key = t.dataset?.input;
  if (key === 'goal-done') return run(() => api.update('weekly_goals', { id: t.dataset.id }, { done: t.checked }));
  if (key === 'global-role') {
    if (!confirm(`Donner le rôle « ${ROLE_LABEL[t.value]} » à ${nameOf(t.dataset.id)} ?${t.value !== 'membre' ? ' Cette personne verra alors tous les pôles.' : ' Elle ne verra plus que ses pôles.'}`)) { render(); return; }
    return run(() => api.update('profiles', { id: t.dataset.id }, { role: t.value }), 'Rôle modifié.');
  }
  if (key === 'demo-user') { api.setDemoUser(t.value); location.hash = '#/'; return refreshSession(); }
  if (key === 'import-demo' && t.files[0]) { const f = t.files[0]; t.value = ''; return importDemo(f); }
});

document.addEventListener('input', (e) => {
  if (e.target.matches('[data-live-output]')) e.target.closest('label').querySelector('output').textContent = e.target.value;
});

boot();
