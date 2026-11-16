// Configuration du site.
// Remplissez SUPABASE_URL et SUPABASE_ANON_KEY avec les valeurs de votre projet Supabase
// (Supabase > Project Settings > API). La clé « anon » est publique par conception :
// ce sont les règles de sécurité (RLS) du fichier supabase/schema.sql qui protègent les données.
//
// Tant que ces deux valeurs sont vides, le site tourne en MODE DÉMO :
// données d'exemple stockées dans votre navigateur uniquement, sans connexion.

export const APP_NAME = "Pilotage de l'asso";

// Les membres se connectent avec un surnom, sans e-mail. Supabase exige quand même une adresse :
// le site en fabrique une à partir du surnom (surnom@LOGIN_DOMAIN). Aucun e-mail n'y est jamais envoyé.
// Ne changez plus cette valeur une fois des comptes créés, sinon ils ne pourraient plus se connecter.
export const LOGIN_DOMAIN = "bacymonix.github.io";
export const SUPABASE_URL = "https://pxpaajcuilqfubucnkry.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_UAVTF-456T_dZpP8y2WNKg_mqjbt_8h";
