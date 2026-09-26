-- ==============================================================
-- COMPROBAR EL ESTADO DEL ARCHIVADO (sólo consultas, no cambia nada)
-- ------------------------------------------------------------------
-- Úsalo cuando quieras saber si la base está al día, por ejemplo antes de
-- ejecutar schema-encryption.sql. Es un SELECT: se puede ejecutar las veces que
-- quieras y no puede tumbar nada.
--
-- Lo normal tras aplicar las migraciones: 4 filas y `tiene_archived_at` = true
-- en todas.
-- ==============================================================

-- 1) ¿Existe la columna archived_at en cada tabla?
--    Se usa EXISTS en lugar de comparar arrays porque pg_attribute.attname es
--    de tipo "name" y el operador `?` sólo existe para text[].
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

-- 2) Resumen de lo que hay archivado ahora mismo, por módulo.
--    Si el tablero no cuadra con lo que ves en la app, ejecuta
--    schema-encryption.sql entero: es idempotente y no borra nada.
select
  'columnas' as tipo,
  (select count(*) from public.vault_categories
    where archived_at is not null) as archivadas
union all
select 'credenciales', (select count(*) from public.vault_credentials
                        where archived_at is not null)
union all
select 'enlaces', (select count(*) from public.vault_links
                   where archived_at is not null)
union all
select 'notas', (select count(*) from public.vault_notes
                 where archived_at is not null);
