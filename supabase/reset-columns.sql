-- ======================================================================
-- RESET DE COLUMNAS  ·  DESTRUCTIVO ·  SÓLO SI QUIERES EMPEZAR DE CERO
-- ----------------------------------------------------------------------
-- ESTE ARCHIVO BORRA TUS COLUMNAS Y SECCIONES. No forma parte de ninguna
-- migración: está aparte precisamente para que no se ejecute sin querer.
--
-- No borra tus credenciales, enlaces ni notas: los deja "sin columna", y los
-- verás en el tablero dentro de la columna «Sin categoría». Lo que pierdes es la
-- organización (los nombres y el orden de tus columnas).
--
-- CUÁNDO HACERLO
--   Sólo si quieres tirar la organización actual y empezar el tablero en
--   blanco. Si lo que quieres es devolver cada columna a su tablero, usa
--   fix-category-modules.sql: ese no borda nada.
--
-- ANTES DE EJECUTARLO
--   1) Haz una copia por si acaso (ajustes -> exportar / respaldar).
--   2) Sustituye `where true` por `where user_id = 'TU-USUARIO-UUID'` en el
--      paso 2 si tu instancia tiene más de un usuario. Con auth.uid() no vale:
--      en el SQL Editor devuelve NULL y el DELETE no tocaría ninguna fila.
-- ======================================================================

-- 1) Desasignar la columna de los registros (no se borran, quedan sueltos).
update public.vault_credentials
   set category_id = null
 where category_id is not null;

update public.vault_links
   set category_id = null
 where category_id is not null;

update public.vault_notes
   set category_id = null
 where category_id is not null;

-- 2) BORRAR columnas y secciones. OJO: aquí es donde se pierde la
--    organización. Las columnas con subcolumnas caen en cascada.
delete from public.vault_categories where true;
delete from public.vault_sections   where true;

notify pgr, 'reload schema';

-- 3) Comprobación: debe devolver 0.
select count(*) as categorias_restantes
  from public.vault_categories;

-- Recarga la app: el tablero aparece vacío y ya puedes crear tus columnas.
