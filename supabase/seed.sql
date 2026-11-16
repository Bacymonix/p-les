-- =====================================================================
-- Les 11 pôles de l'association avec leur disposition (sections).
-- À lancer APRÈS schema.sql, dans Supabase > SQL Editor > Run.
-- Aucun contenu d'exemple : les responsables remplissent ensuite le site.
-- Ensuite, dans le site (admin) : Membres et accès > « Pôles… » pour donner
-- à chacun ses pôles et nommer les responsables.
-- =====================================================================
insert into public.poles (name, description, color, position, has_gauge, layout) values
  ('Goodies', 'Devis Festi Print, logos et idées de goodies.', '#7048e8', 1, true, '[{"key":"devis","title":"Devis Festi Print","type":"files","comments":true},{"key":"logos","title":"Logos","type":"files","comments":true},{"key":"idees","title":"Idées de goodies","type":"ideas","fields":["image","qty","price"]}]'::jsonb),
  ('Aprèm sport', 'Organisation de l''après-midi sportive.', '#e64980', 2, true, '[{"key":"devis","title":"Devis (bus + activité)","type":"quotes","categories":["Bus","Activité"]}]'::jsonb),
  ('Communication', 'Fonds des stories et vidéos.', '#4f5bd5', 3, true, '[{"key":"stories","title":"Fonds des stories","type":"files"},{"key":"videos","title":"Stockage des vidéos","type":"files"}]'::jsonb),
  ('Rap', 'Prod, texte et musique finale.', '#343a40', 4, true, '[{"key":"prod","title":"Prod","type":"files","comments":true},{"key":"texte","title":"Texte","type":"files","comments":true},{"key":"final","title":"Musique finale","type":"files","comments":true}]'::jsonb),
  ('Kermesse', 'Activités et disposition de la kermesse.', '#1c7ed6', 5, true, '[{"key":"devis","title":"Devis (activités)","type":"quotes","categories":["Activité"]},{"key":"idees","title":"Idées de disposition et d''activités","type":"ideas","fields":["image"]}]'::jsonb),
  ('Soirée BDS', 'Soirée avec le BDS.', '#c2255c', 6, true, '[{"key":"devis","title":"Devis (bus + activité)","type":"quotes","categories":["Bus","Activité"]},{"key":"idees","title":"Idées d''activités","type":"ideas","fields":["image"]}]'::jsonb),
  ('Film', 'Synopsis et versions du film.', '#f08c00', 7, true, '[{"key":"synopsis","title":"Synopsis","type":"notes"},{"key":"versions","title":"Versions du film","type":"files","comments":true}]'::jsonb),
  ('Vente cookies', 'Suivi des ventes de cookies.', '#a0522d', 8, false, '[{"key":"ventes","title":"Ventes","type":"sales","lead_only":true}]'::jsonb),
  ('SOS', 'Plats, desserts et organisation des appartements.', '#2f9e44', 9, true, '[{"key":"plats","title":"Idées de plats","type":"ideas","fields":["image","price","ingredients"]},{"key":"desserts","title":"Idées de desserts","type":"ideas","fields":["image","price","ingredients"]},{"key":"orga","title":"Organisation : appartements et rôles","type":"apartments"}]'::jsonb),
  ('Partenariat', 'Partenaires et avantages obtenus.', '#0c8599', 10, false, '[{"key":"partenaires","title":"Partenaires","type":"partners","lead_only":true}]'::jsonb),
  ('Dévoilement', 'Idées, déroulé minuté et fichiers.', '#e8590c', 11, true, '[{"key":"idees","title":"Bloc-notes idées","type":"notes"},{"key":"deroule","title":"Déroulement minuté","type":"schedule"},{"key":"fichiers","title":"Fichiers","type":"files","comments":true}]'::jsonb);
