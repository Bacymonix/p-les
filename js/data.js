// Couche d'accès aux données : Supabase en production, navigateur en mode démo.
// En mode démo, les mêmes règles d'accès que la base (schema.sql) sont simulées ici,
// pour pouvoir tester chaque rôle avec « Voir en tant que ».
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { TEMPLATES, ASSO_POLES } from './templates.js';

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
export const MAX_FILE_MB = 50;
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const BUCKET = 'pole-files';

let sb = null;
let channel = null;

export async function init() {
  if (DEMO) { demo.load(); return; }
  const { createClient } = await import(SUPABASE_JS);
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function check({ data, error }) {
  if (error) throw new Error(translate(error.message));
  return data;
}

function translate(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return "Adresse e-mail pas encore confirmée : cliquez sur le lien reçu par e-mail.";
  if (m.includes('user already registered')) return 'Un compte existe déjà avec cet e-mail.';
  if (m.includes('password should be at least')) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (m.includes('row-level security') || m.includes('permission denied') || m.includes('unauthorized')) return "Vous n'avez pas les droits pour cette action.";
  if (m.includes('exceeded the maximum allowed size') || m.includes('payload too large')) return `Fichier trop lourd (${MAX_FILE_MB} Mo maximum) : déposez plutôt un lien (Drive, YouTube…).`;
  if (m.includes('duplicate key') && m.includes('pole_members')) return 'Cette personne est déjà dans le pôle.';
  if (m.includes('rate limit')) return 'Trop de tentatives, réessayez dans quelques minutes.';
  return msg;
}

const redirectUrl = () => location.origin + location.pathname;

// ---------- Authentification ----------
export async function currentUser() {
  if (DEMO) return { id: demo.db.meId };
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export function onAuth(cb) {
  if (DEMO) return;
  sb.auth.onAuthStateChange((event) => {
    if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) setTimeout(() => cb(event), 0);
  });
}

export async function signIn(email, password) { check(await sb.auth.signInWithPassword({ email, password })); }
export async function signUp(email, password, fullName) {
  const data = check(await sb.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: redirectUrl() } }));
  return { needsConfirmation: !data.session };
}
export async function resetPassword(email) { check(await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() })); }
export async function setNewPassword(password) { check(await sb.auth.updateUser({ password })); }
export async function signOut() { if (!DEMO) await sb.auth.signOut(); }

// ---------- Lecture groupée (la base ne renvoie que ce que l'utilisateur a le droit de voir) ----------
export async function loadEverything() {
  if (DEMO) return demo.readAll();
  const q = (t, order = 'created_at') => sb.from(t).select('*').order(order);
  const [profiles, poles, members, goals, items, comments] = await Promise.all(
    [q('profiles', 'full_name'), q('poles', 'position'), q('pole_members'), q('weekly_goals', 'position'), q('items', 'position'), q('comments')]
      .map(async (p) => check(await p)));
  return { profiles, poles, members, goals, items, comments };
}

export async function getMyProfile() {
  if (DEMO) return demo.clone(demo.db.profiles.find((p) => p.id === demo.db.meId));
  const user = await currentUser();
  if (!user) return null;
  return check(await sb.from('profiles').select('*').eq('id', user.id).maybeSingle());
}

export async function adminEmails() {
  if (DEMO) { if (!rules.admin()) denied(); return Object.fromEntries(demo.db.profiles.map((p) => [p.id, `${p.id}@exemple.fr`])); }
  const rows = check(await sb.rpc('admin_member_emails'));
  return Object.fromEntries(rows.map((r) => [r.id, r.email]));
}

// ---------- Écritures génériques ----------
// table : profiles, poles, pole_members, weekly_goals, items, comments
export async function insert(table, row) {
  if (DEMO) return demo.insert(table, row);
  return check(await sb.from(table).insert(row).select().single());
}
export async function update(table, match, patch) {
  if (DEMO) return demo.update(table, match, patch);
  let q = sb.from(table).update(patch);
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const rows = check(await q.select());
  if (!rows.length) denied();
}
export async function remove(table, match) {
  if (DEMO) return demo.remove(table, match);
  let q = sb.from(table).delete();
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const rows = check(await q.select());
  if (!rows.length) denied();
}

// ---------- Fichiers ----------
const urlCache = new Map();
const demoFiles = new Map();

export async function uploadFile(poleId, file) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Fichier trop lourd (${MAX_FILE_MB} Mo maximum) : déposez plutôt un lien (Drive, YouTube…).`);
  const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `${poleId}/${crypto.randomUUID()}-${safe}`;
  if (DEMO) {
    if (!rules.inPole(poleId)) denied();
    demoFiles.set(path, URL.createObjectURL(file));
  } else {
    check(await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' }));
  }
  return { file_path: path, file_name: file.name, file_type: file.type || '', file_size: file.size };
}

export async function fileUrl(path) {
  if (!path) return '';
  if (path.startsWith('data:')) return path;
  if (DEMO) return demoFiles.get(path) || '';
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return '';
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function removeFile(path) {
  if (!path || path.startsWith('data:')) return;
  if (DEMO) { demoFiles.delete(path); return; }
  await sb.storage.from(BUCKET).remove([path]);
}

// ---------- Temps réel ----------
export function subscribe(onChange) {
  if (DEMO || channel) return;
  channel = sb.channel('pilotage');
  for (const t of ['profiles', 'poles', 'pole_members', 'weekly_goals', 'items', 'comments']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, onChange);
  }
  channel.subscribe();
}

// ---------- Mode démo ----------
export function resetDemo() { demo.reset(); }
export function exportDemo() { return JSON.stringify({ format: 'pilotage-demo', version: 1, exported_at: new Date().toISOString(), ...demo.db }, null, 2); }
export function setDemoUser(id) { demo.db.meId = id; demo.save(); }
export function demoUsers() { return demo.clone(demo.db.profiles); }
export function demoMembers() { return demo.clone(demo.db.pole_members); }

function denied() { throw new Error("Vous n'avez pas les droits pour cette action."); }

// Mêmes règles que schema.sql.
const rules = {
  get db() { return demo.db; },
  role() { const m = this.db.profiles.find((p) => p.id === this.db.meId); return m && m.approved ? m.role : null; },
  admin() { return this.role() === 'admin'; },
  staff() { return ['admin', 'bureau'].includes(this.role()); },
  inPole(p) { return this.staff() || (!!this.role() && this.db.pole_members.some((m) => m.pole_id === p && m.user_id === this.db.meId)); },
  lead(p) { return !!this.role() && this.db.pole_members.some((m) => m.pole_id === p && m.user_id === this.db.meId && m.role === 'responsable'); },
  manages(p) { return this.staff() || this.lead(p); },
  leadOnly(p, s) { return !!this.db.poles.find((x) => x.id === p)?.layout.find((x) => x.key === s)?.lead_only; },
  canWrite(p, s) { return this.manages(p) || (this.inPole(p) && !this.leadOnly(p, s)); },
  seeProfile(id) {
    const me = this.db.meId;
    if (id === me || this.staff()) return true;
    if (!this.role()) return false;
    const t = this.db.profiles.find((p) => p.id === id);
    if (t?.approved && this.db.pole_members.some((m) => m.user_id === me && m.role === 'responsable')) return true;
    if (t?.approved && ['admin', 'bureau'].includes(t.role)) return true;
    const mine = this.db.pole_members.filter((m) => m.user_id === me).map((m) => m.pole_id);
    return this.db.pole_members.some((m) => m.user_id === id && mine.includes(m.pole_id));
  },
  canRead(table, r) {
    if (table === 'profiles') return this.seeProfile(r.id);
    if (table === 'poles') return this.inPole(r.id);
    return this.inPole(r.pole_id);
  },
  canInsert(table, r) {
    switch (table) {
      case 'poles': return this.admin();
      case 'pole_members': return this.db.profiles.some((p) => p.id === r.user_id && p.approved) && (this.admin() || (this.lead(r.pole_id) && r.role === 'membre'));
      case 'weekly_goals': return this.manages(r.pole_id);
      case 'items': return this.canWrite(r.pole_id, r.section);
      case 'comments': return this.inPole(r.pole_id);
      default: return false;
    }
  },
  canUpdate(table, r, patch) {
    switch (table) {
      case 'profiles':
        if (this.admin()) return true;
        return r.id === this.db.meId && !('role' in patch) && !('approved' in patch);
      case 'poles':
        if (this.admin()) return true;
        return this.manages(r.id) && !['name', 'layout', 'has_gauge', 'position'].some((k) => k in patch);
      case 'pole_members': return this.admin();
      case 'weekly_goals': return this.manages(r.pole_id);
      case 'items': return this.manages(r.pole_id) || (r.created_by === this.db.meId && this.canWrite(r.pole_id, r.section));
      default: return false;
    }
  },
  canDelete(table, r) {
    switch (table) {
      case 'poles': return this.admin();
      case 'pole_members': return this.admin() || (this.lead(r.pole_id) && r.role === 'membre');
      case 'weekly_goals': return this.manages(r.pole_id);
      case 'items': return this.manages(r.pole_id) || (r.created_by === this.db.meId && this.canWrite(r.pole_id, r.section));
      case 'comments': return r.author_id === this.db.meId || this.manages(r.pole_id);
      default: return false;
    }
  },
};

const matches = (r, match) => Object.entries(match).every(([k, v]) => r[k] === v);
const TABLES = { profiles: 'profiles', poles: 'poles', members: 'pole_members', goals: 'weekly_goals', items: 'items', comments: 'comments' };

const demo = {
  KEY: 'pilotage-demo-v4',
  db: null,
  load() {
    try { const s = localStorage.getItem(this.KEY); if (s) { this.db = JSON.parse(s); return; } } catch { /* stockage indisponible */ }
    this.db = demoSeed(); this.save();
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.db)); } catch { /* ignoré */ } },
  reset() { const me = this.db?.meId; this.db = demoSeed(); if (me) this.db.meId = me; this.save(); },
  clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); },
  readAll() {
    const out = {};
    for (const [k, t] of Object.entries(TABLES)) out[k] = this.clone(this.db[t].filter((r) => rules.canRead(t, r)));
    out.poles.sort((a, b) => a.position - b.position);
    return out;
  },
  insert(table, row) {
    const now = new Date().toISOString();
    const r = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...row };
    if (table === 'comments') { r.author_id = this.db.meId; r.pole_id = this.db.items.find((i) => i.id === r.item_id)?.pole_id; }
    else if (['weekly_goals', 'items'].includes(table)) r.created_by = this.db.meId;
    if (!rules.canInsert(table, r)) denied();
    if (table === 'pole_members' && this.db.pole_members.some((m) => m.pole_id === r.pole_id && m.user_id === r.user_id)) throw new Error('Cette personne est déjà dans le pôle.');
    this.db[table].push(r); this.save(); return this.clone(r);
  },
  update(table, match, patch) {
    const rows = this.db[table].filter((r) => matches(r, match));
    if (!rows.length || !rows.every((r) => rules.canUpdate(table, r, patch))) denied();
    for (const r of rows) {
      if (table === 'profiles' && r.role === 'admin' && ((patch.role && patch.role !== 'admin') || patch.approved === false)
        && !this.db.profiles.some((p) => p.id !== r.id && p.role === 'admin' && p.approved)) throw new Error('Impossible : il doit rester au moins un administrateur');
      Object.assign(r, patch, { updated_at: new Date().toISOString() });
      if (table === 'poles' && ('estimate' in patch || 'estimate_note' in patch)) { r.estimate_by = this.db.meId; r.estimate_at = new Date().toISOString(); }
      if (table === 'profiles' && patch.approved === false) this.db.pole_members = this.db.pole_members.filter((m) => m.user_id !== r.id);
    }
    this.save();
  },
  remove(table, match) {
    const rows = this.db[table].filter((r) => matches(r, match));
    if (!rows.length || !rows.every((r) => rules.canDelete(table, r))) denied();
    this.db[table] = this.db[table].filter((r) => !matches(r, match));
    if (table === 'poles') for (const t of ['pole_members', 'weekly_goals', 'items', 'comments']) this.db[t] = this.db[t].filter((r) => r.pole_id !== match.id);
    if (table === 'items') this.db.comments = this.db.comments.filter((c) => c.item_id !== match.id);
    this.save();
  },
};

// ---------- Données d'exemple ----------
function day(offset) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString('sv-SE'); }
function monday(offset = 0) { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); return d.toLocaleDateString('sv-SE'); }
function ago(days) { return new Date(Date.now() - days * 86400000).toISOString(); }
function svg(label, color) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${color}"/><text x="160" y="112" font-family="sans-serif" font-size="26" font-weight="700" fill="white" text-anchor="middle">${label}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}

function demoSeed() {
  const now = new Date().toISOString();
  const P = (id, full_name, role = 'membre', approved = true) => ({ id, full_name, role, approved, created_at: now });
  const profiles = [
    P('camille', 'Camille Martin', 'admin'),
    P('lucas', 'Lucas Bernard', 'bureau'),
    P('ines', 'Inès Dubois'),
    P('hugo', 'Hugo Petit'),
    P('sarah', 'Sarah Leroy'),
    P('nina', 'Nina Moreau'),
    P('tom', 'Tom Garnier'),
    P('alex', 'Alex Nouveau', 'membre', false),
  ];
  const estimates = { goodies: 55, sport: 30, com: 70, rap: 40, kermesse: 15, bds: 60, film: 25, sos: 35, devoilement: 10 };
  const poles = ASSO_POLES.map((p, i) => ({
    id: `p-${p.tpl}`, name: p.name, color: p.color, description: p.description, position: i + 1,
    has_gauge: TEMPLATES[p.tpl].gauge, layout: TEMPLATES[p.tpl].layout, event_date: null,
    estimate: estimates[p.tpl] ?? null, estimate_note: '', estimate_by: null,
    estimate_at: estimates[p.tpl] != null ? ago(p.tpl === 'kermesse' || p.tpl === 'film' ? 10 : i % 3) : null,
    created_at: now,
  }));
  const pl = (id) => poles.find((p) => p.id === id);
  pl('p-bds').event_date = day(12);
  pl('p-sport').event_date = day(20);
  pl('p-goodies').estimate_note = 'Devis reçu, reste à valider le logo.';

  const M = (pole, user, role = 'membre') => ({ pole_id: `p-${pole}`, user_id: user, role, created_at: now });
  const pole_members = [
    M('goodies', 'ines', 'responsable'), M('goodies', 'nina'),
    M('com', 'ines', 'responsable'), M('com', 'nina'),
    M('rap', 'hugo', 'responsable'), M('rap', 'tom'),
    M('film', 'tom', 'responsable'), M('film', 'hugo'),
    M('cookies', 'sarah', 'responsable'), M('cookies', 'nina'),
    M('sos', 'sarah', 'responsable'), M('sos', 'tom'),
    M('sport', 'hugo', 'responsable'), M('bds', 'nina', 'responsable'), M('kermesse', 'tom', 'responsable'),
    M('partenariat', 'lucas', 'responsable'), M('devoilement', 'ines', 'responsable'),
  ];
  for (const p of poles) {
    const lead = pole_members.find((m) => m.pole_id === p.id && m.role === 'responsable');
    if (lead && p.estimate != null) p.estimate_by = lead.user_id;
  }

  let g = 0;
  const G = (pole, title, done = false, week = 0) => ({ id: `g${++g}`, pole_id: `p-${pole}`, week_start: monday(week), title, done, position: g, created_by: 'camille', created_at: now });
  const weekly_goals = [
    G('goodies', 'Envoyer le devis Festi Print au bureau', true), G('goodies', 'Choisir le logo final'), G('goodies', 'Chiffrer 3 idées de goodies'),
    G('sport', 'Obtenir 2 devis de bus', true), G('sport', 'Comparer les activités'),
    G('com', 'Préparer 5 fonds de story', true), G('com', 'Ranger les vidéos de la soirée', true),
    G('rap', 'Choisir la prod'), G('rap', 'Premier jet du texte'),
    G('kermesse', 'Lister les activités possibles'),
    G('bds', 'Réserver le bus', true), G('bds', 'Valider 3 activités'),
    G('film', 'Finir le synopsis'),
    G('cookies', 'Organiser la vente de jeudi', true),
    G('sos', 'Fixer les prix des plats'), G('sos', 'Répartir les rôles par appartement'),
    G('partenariat', 'Relancer la boulangerie'),
    G('devoilement', 'Écrire le déroulé minuté'),
    G('goodies', 'Demander le devis Festi Print', true, -1), G('goodies', 'Lister les idées', true, -1),
  ];

  let n = 0;
  const I = (pole, section, data, extra = {}, by = 'camille', daysAgo = 2) => ({
    id: `i${++n}`, pole_id: `p-${pole}`, section, data, file_path: null, file_name: null, file_type: null, file_size: null, link_url: null,
    position: n, created_by: by, created_at: ago(daysAgo), updated_at: ago(daysAgo), ...extra,
  });
  const img = (label, color) => ({ file_path: svg(label, color), file_name: `${label}.svg`, file_type: 'image/svg+xml', file_size: 1200 });
  const items = [
    I('goodies', 'devis', { title: 'Devis Festi Print (t-shirts)', note: '200 t-shirts, 2 couleurs' }, { link_url: 'https://www.example.com/devis-festi-print.pdf' }, 'ines', 5),
    I('goodies', 'logos', { title: 'Logo version A' }, img('Logo A', '#7048e8'), 'nina', 4),
    I('goodies', 'logos', { title: 'Logo version B' }, img('Logo B', '#e64980'), 'ines', 3),
    I('goodies', 'idees', { title: 'Tote bag', description: 'Logo brodé', qty: 100, price: 3.5 }, img('Tote bag', '#495057'), 'nina', 3),
    I('goodies', 'idees', { title: 'Gourde', description: 'Inox 50 cl', qty: 50, price: 6 }, img('Gourde', '#1c7ed6'), 'ines', 2),
    I('sport', 'devis', { label: 'Car 50 places aller-retour', category: 'Bus', price: 650, provider: 'Autocars X' }, {}, 'hugo', 6),
    I('sport', 'devis', { label: 'Accrobranche (40 pers.)', category: 'Activité', price: 720, provider: 'Parc Y' }, {}, 'hugo', 4),
    I('sport', 'devis', { label: 'Laser game (40 pers.)', category: 'Activité', price: 560, provider: 'Laser Z' }, {}, 'hugo', 2),
    I('com', 'stories', { title: 'Fond story gala' }, img('Story gala', '#4f5bd5'), 'nina', 2),
    I('com', 'videos', { title: 'Aftermovie soirée d\'intégration' }, { link_url: 'https://drive.google.com/' }, 'ines', 7),
    I('rap', 'prod', { title: 'Prod 1 (boom bap)' }, { link_url: 'https://soundcloud.com/' }, 'hugo', 6),
    I('rap', 'texte', { title: 'Couplet 1', text: 'Premier jet du couplet…\n(à retravailler)' }, {}, 'tom', 3),
    I('kermesse', 'devis', { label: 'Château gonflable', category: 'Activité', price: 300, provider: 'Loc Fun' }, {}, 'tom', 3),
    I('kermesse', 'idees', { title: 'Stands en U autour de la scène', description: 'Buvette à l\'entrée, jeux au fond.' }, {}, 'tom', 2),
    I('bds', 'devis', { label: 'Bus 60 places', category: 'Bus', price: 800, provider: 'Autocars X' }, {}, 'nina', 5),
    I('bds', 'idees', { title: 'Blind test géant', description: 'Par équipes de 6' }, {}, 'nina', 2),
    I('film', 'synopsis', { title: 'Synopsis v1', text: 'Une semaine dans la vie de l\'asso, racontée par ses membres.' }, {}, 'tom', 8),
    I('film', 'versions', { title: 'Version 0.1 (montage brut)' }, { link_url: 'https://drive.google.com/' }, 'tom', 1),
    I('cookies', 'ventes', { date: day(-14), label: 'Vente hall A', people: 6, revenue: 182.5 }, {}, 'sarah', 14),
    I('cookies', 'ventes', { date: day(-7), label: 'Vente cafétéria', people: 4, revenue: 136 }, {}, 'sarah', 7),
    I('cookies', 'ventes', { date: day(-2), label: 'Vente soirée', people: 8, revenue: 245 }, {}, 'sarah', 2),
    I('sos', 'plats', { title: 'Burger maison', price: 6, ingredients: 'Pain brioché, steak, cheddar, salade, sauce' }, img('Burger', '#f08c00'), 'sarah', 3),
    I('sos', 'plats', { title: 'Wrap poulet', price: 5, ingredients: 'Tortilla, poulet, crudités, sauce blanche' }, img('Wrap', '#2f9e44'), 'tom', 2),
    I('sos', 'desserts', { title: 'Cookie XXL', price: 2, ingredients: 'Farine, beurre, sucre, pépites de chocolat' }, img('Cookie', '#a0522d'), 'sarah', 2),
    I('sos', 'orga', { name: 'Appart 1 (cuisine)', address: 'Adresse à compléter', lat: 48.8566, lng: 2.3522, roles: [{ person: 'Sarah', role: 'Cuisine' }, { person: 'Tom', role: 'Préparation des commandes' }] }, {}, 'sarah', 2),
    I('sos', 'orga', { name: 'Appart 2 (livraison)', address: 'Adresse à compléter', lat: 48.8606, lng: 2.3376, roles: [{ person: 'Nina', role: 'Départ des livreurs' }] }, {}, 'sarah', 2),
    I('partenariat', 'partenaires', { name: 'Boulangerie du coin', advantages: '-10 % pour les membres, cookies offerts pour la kermesse', contact: 'Le gérant' }, {}, 'lucas', 10),
    I('partenariat', 'partenaires', { name: 'Salle de sport Fit', advantages: 'Accès gratuit pour l\'Aprèm sport', contact: 'Accueil' }, {}, 'lucas', 4),
    I('devoilement', 'idees', { title: 'Idée d\'ouverture', text: 'Compte à rebours sur grand écran, puis lumière sur la scène.' }, {}, 'ines', 2),
    I('devoilement', 'deroule', { time: '19:00', duration: 15, title: 'Accueil', who: 'Bureau' }, {}, 'ines', 2),
    I('devoilement', 'deroule', { time: '19:15', duration: 10, title: 'Discours du bureau', who: 'Camille' }, {}, 'ines', 2),
    I('devoilement', 'deroule', { time: '19:25', duration: 5, title: 'Dévoilement', who: 'Com' }, {}, 'ines', 2),
  ];
  const comments = [
    { id: 'c1', item_id: 'i2', pole_id: 'p-goodies', body: 'Je préfère celui-ci, plus lisible.', author_id: 'ines', created_at: ago(3) },
    { id: 'c2', item_id: 'i11', pole_id: 'p-rap', body: 'Bonne base, peut-être ralentir un peu le tempo.', author_id: 'tom', created_at: ago(5) },
  ];
  return { meId: 'camille', profiles, poles, pole_members, weekly_goals, items, comments };
}
