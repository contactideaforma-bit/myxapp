-- =====================================================================
--  myXapp — Table rase du catalogue de positions
--
--  A n'executer QUE si tu veux repartir de zero : supprime les fiches,
--  les illustrations deposees et les marques (envies, tests, coups de
--  coeur). Le reste de l'application n'est pas touche.
-- =====================================================================

delete from public.position_images;
delete from public.position_marks;
delete from public.positions;

select 'Catalogue vide. Lance le script d''import.' as resultat;
