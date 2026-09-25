-- ======================================================================
-- DEVOLVER CADA COLUMNA A SU TABLERO (opcional — ejecútalo sólo si hace falta)
-- ----------------------------------------------------------------------
-- PROBLEMA QUE ARREGLA
-- `vault_categories` guarda en `module` a qué tablero pertenece cada columna
-- (credential | link | note). Cuando la app creaba una columna desde el tablero
-- de Links o de Notas sin mandar ese `module`, Postgres le ponía el default
-- 'credential' y la columna aparecía en Access en vez de donde la creaste. Las
-- tarjetas que colgaras de ella acababan también en el tablero equivocado.
--
-- La app ya está corregida: el módulo es obligatorio al crear una columna y
-- ningún enlace o nota puede guardarse en una columna de otro tablero. Este
-- script es sólo para arreglar lo que ya quedó mal en la base.
--
-- CÓMO USARLO
--   1) Ejecuta schema-encryption.sql ENTERO antes que esto: es el que añade la
--      columna `module` y actualiza get_vault_snapshot, la función que le
--      devuelve el módulo al cliente.
--   2) Abre ESTE archivo en Supabase Dashboard -> SQL Editor -> New query.
--   3) Empieza por la consulta 1 (diagnóstico) y anota en qué tablero debería
--      estar cada columna.
--   4) Ejecuta el resto.
--
-- QUÉ NO HACE
--   · No borra credenciales, enlaces, notas ni columnas.
--   · Como mucho deja algún enlace o nota "sin columna", pero entonces se ve
--     en su tablero (columna «Sin categoría») y puedes volver a arrastrarlo.
--
-- SOBRE EL FILTRO DE USUARIO
--   No se usa auth.uid() porque en el SQL Editor de Supabase devuelve NULL y
--   los UPDATE no tocarían ninguna fila. En su lugar, cada sentencia declara
--   `params.target_user`:
--     · null::uuid -> trabaja sobre TODAS las filas (lo normal si eres el
--       único usuario de la instancia).
--     · tu uuid    -> sólo con las filas de ese usuario. Sustitúyelo si la
--       consulta 1b te dice que hay más de un usuario.
-- ======================================================================

-- 1) DIAGNÓSTICO: qué contiene cada columna y en qué tablero está ahora.
--    Lo normal es que una columna sólo contenga un tipo de contenido.
select
  c.user_id,
  c.id,
  c.module                                    as modulo_actual,
  (select count(*) from public.vault_credentials cr where cr.category_id = c.id) as credenciales,
  (select count(*) from public.vault_links  l  where l.category_id  = c.id) as enlaces,
  (select count(*) from public.vault_notes  n  where n.category_id  = c.id) as notas
from public.vault_categories c
order by c.module, c.sort_order, c.name;

-- 1b) ¿Hay más de un usuario en esta instancia? Si sale un número mayor que
--     1, sustituye null::uuid por el uuid de tu usuario en el paso 2.
select count(distinct user_id) as usuarios_en_la_instancia
  from public.vault_categories;

-- 2) REASIGNACIÓN AUTOMÁTICA (heurística por contenido):
--    · columna sólo con enlaces -> Links
--    · columna sólo con notas   -> Notas
--    · columna con credenciales -> se queda en Access
--    Revisa el paso 1: si alguna columna no cae donde esperabas, corrígela a
--    mano con su uuid:
--      update public.vault_categories set module = 'link' where id = '<uuid>';

with params as (
  select null::uuid as target_user
)
update public.vault_categories c
   set module = 'link'
  from params
 where (params.target_user is null or c.user_id = params.target_user)
   and c.module is distinct from 'link'
   and not exists (select 1 from public.vault_credentials cr where cr.category_id = c.id)
   and exists (select 1 from public.vault_links l where l.category_id = c.id);

with params as (
  select null::uuid as target_user
)
update public.vault_categories c
   set module = 'note'
  from params
 where (params.target_user is null or c.user_id = params.target_user)
   and c.module is distinct from 'note'
   and not exists (select 1 from public.vault_credentials cr where cr.category_id = c.id)
   and not exists (select 1 from public.vault_links  l where l.category_id  = c.id)
   and exists (select 1 from public.vault_notes n where n.category_id = c.id);

-- 3) REFERENCIAS CRUZADAS: un registro nunca debe vivir en la columna de otro
--    tablero. Se sueltan (category_id = null) y el registro aparece en su
--    propio «Sin categoría»: visible y recuperable, en vez de desaparecer.
with params as (
  select null::uuid as target_user
)
update public.vault_links l
   set category_id = null
  from params
 where (params.target_user is null or l.user_id = params.target_user)
   and l.category_id is not null
   and l.category_id in (
     select c.id from public.vault_categories c where c.module is distinct from 'link'
   );

with params as (
  select null::uuid as target_user
)
update public.vault_notes n
   set category_id = null
  from params
 where (params.target_user is null or n.user_id = params.target_user)
   and n.category_id is not null
   and n.category_id in (
     select c.id from public.vault_categories c where c.module is distinct from 'note'
   );

with params as (
  select null::uuid as target_user
)
update public.vault_credentials cr
   set category_id = null
  from params
 where (params.target_user is null or cr.user_id = params.target_user)
   and cr.category_id is not null
   and cr.category_id in (
     select c.id from public.vault_categories c where c.module is distinct from 'credential'
   );

-- 4) JERARQUÍA: una columna no puede quedar anidada bajo una de otro tablero.
--    Al soltarla se convierte en columna de primer nivel de su propio tablero.
with params as (
  select null::uuid as target_user
)
update public.vault_categories c
   set parent_id = null
  from params
 where (params.target_user is null or c.user_id = params.target_user)
   and c.parent_id is not null
   and c.parent_id in (
     select p.id from public.vault_categories p
      where p.module is distinct from c.module
   );

-- 5) ORDEN: renumera las columnas de cada tablero por separado, para que
--    Access, Links y Notas tengan su propia secuencia 0, 1, 2...
with ranked as (
  select
    c.id,
    row_number() over (
      partition by c.module, c.section_id, c.parent_id
      order by c.sort_order, c.name
    ) - 1 as new_order
  from public.vault_categories c
)
update public.vault_categories c
   set sort_order = ranked.new_order
  from ranked
 where c.id = ranked.id
   and c.sort_order is distinct from ranked.new_order;

notify pgr, 'reload schema';

-- 6) COMPROBACIÓN FINAL: cada columna debe tener contenido de un solo tablero
--    (o estar vacía, que es lo normal en una columna recién creada).
select
  c.module                                    as modulo,
  count(distinct cr.id)                       as credenciales,
  count(distinct l.id)                        as enlaces,
  count(distinct n.id)                        as notas
from public.vault_categories c
left join public.vault_credentials cr on cr.category_id = c.id
left join public.vault_links       l  on l.category_id  = c.id
left join public.vault_notes       n  on n.category_id  = c.id
group by c.id, c.module, c.sort_order, c.name
having count(distinct cr.id) > 0
    or count(distinct l.id)  > 0
    or count(distinct n.id)  > 0
order by c.module, c.sort_order, c.name;
