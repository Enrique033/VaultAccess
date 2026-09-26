-- ==============================================================
-- COMPROBAR EL ESTADO DEL ARCHIVADO (sólo consultas, no cambia nada)
-- ------------------------------------------------------------------
-- Úsalo cuando quieras saber si la base está al día, por ejemplo antes de
-- ejecutar schema-encryption.sql. Es un SELECT: se puede ejecutar las veces que
-- quieras y no puede tumbar nada.
--
-- IMPORTANTE: este script NO puede fallar aunque las columnas no existan, que
-- es justo cuando más hace falta. Para conseguirlo no escribe `where
-- archived_at is not null` (eso exige que la columna exista y aborta con el
-- error 42703) sino `to_jsonb(fila) ->> 'archived_at'`, que no genera ninguna
-- referencia en tiempo de compilación: si la columna no está, devuelve NULL y el
-- resultado sale a 0 en lugar de reventar.
--
-- Lo normal tras aplicar las migraciones: 4 filas con `true` y, en el resumen,
-- el número de elementos archivados que tengas.
-- ==============================================================

-- 1) ¿Existe la columna archived_at en cada tabla?
--    Se consulta el catálogo (pg_attribute) en vez de la tabla, así que aquí no
--    hay forma de que reviente. EXISTS evita además el operador `?`, que sólo
--    existe para text[] y no para name[], que es el tipo de attname.
select
  t.tabla,
  exists (
    select 1
    from pg_attribute a
    where a.attrelid = to_regclass(format('public.%I', t.tabla))
      and a.attname = 'archived_at'
      and a.attnum > 0
      and not a.attisdropped
  ) as tiene_archived_at
from (values
  ('vault_categories'), ('vault_credentials'),
  ('vault_links'),       ('vault_notes')
) as t(tabla);

-- 2) Cuántos elementos hay archivados ahora mismo. Sale a 0 en todo si las
--    columnas todavía no existen, y es lo correcto: aún no hay nada archivado
--    porque la función de archivado aún no está aplicada.
select
  'columnas' as tipo,
  (select count(*) from public.vault_categories c
    where (to_jsonb(c) ->> 'archived_at') is not null) as archivados
union all
select 'credenciales', (select count(*) from public.vault_credentials c
                        where (to_jsonb(c) ->> 'archived_at') is not null)
union all
select 'enlaces', (select count(*) from public.vault_links c
                   where (to_jsonb(c) ->> 'archived_at') is not null)
union all
select 'notas', (select count(*) from public.vault_notes c
                 where (to_jsonb(c) ->> 'archived_at') is not null);
