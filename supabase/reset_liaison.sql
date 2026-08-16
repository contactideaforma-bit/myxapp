-- =====================================================================
--  REMISE A ZERO DE LA LIAISON
--  Supprime toutes les lignes "couples" et les messages associes.
--  Les COMPTES utilisateurs ne sont PAS touches.
--  A n'executer qu'apres avoir lu le diagnostic.
-- =====================================================================

delete from public.couples;

select 'Liaisons effacees. Rafraichissez les 2 navigateurs.' as resultat;
