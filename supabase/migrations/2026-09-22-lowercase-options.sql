-- Справочники строчными буквами и склейка дублей в «Пометках».
--
-- Разовая правка боевой базы: вставить целиком в SQL Editor проекта → Run.
-- Запускать ПОСЛЕ 2026-09-22-sections-cleanup.sql. Идемпотентна: lower() от
-- строчного текста — тот же текст, повторный запуск ничего не портит.
--
-- Правит не только описания полей, но и сами данные: значения справочников
-- лежат в ячейках брендов строками, и если поменять только options, у
-- заполненных карточек значения выпадут из списка и встанут лишними кнопками.
--
-- Город и страна намеренно остаются с большой буквы: это имена собственные,
-- «москва» читалась бы как опечатка.

-- ---------------------------------------------------------------------------
-- 0. Прогнать ДО запуска: что изменится
-- ---------------------------------------------------------------------------
--   select 'fashion.fashion_kind' as col, count(*) from public.brands_fashion where fashion_kind <> lower(fashion_kind)
--   union all select 'fashion.tags',       count(*) from public.brands_fashion where tags       <> lower(tags)
--   union all select 'fashion.style_role', count(*) from public.brands_fashion where style_role <> lower(style_role)
--   union all select 'fashion.audience',   count(*) from public.brands_fashion where audience   <> lower(audience)
--   union all select 'beauty.beauty_kind', count(*) from public.brands_beauty  where beauty_kind<> lower(beauty_kind)
--   union all select 'beauty.marks',       count(*) from public.brands_beauty  where marks      <> lower(marks);

-- ---------------------------------------------------------------------------
-- 1. Данные брендов
-- ---------------------------------------------------------------------------
-- Мультизначные ячейки лежат строкой через запятую, поэтому lower() по всей
-- ячейке разом приводит к строчным каждое значение в ней.

update public.brands_fashion
   set fashion_kind = lower(fashion_kind),
       tags         = lower(tags),
       style_role   = lower(style_role),
       audience     = lower(audience)
 where fashion_kind <> lower(fashion_kind)
    or tags         <> lower(tags)
    or style_role   <> lower(style_role)
    or audience     <> lower(audience);

update public.brands_beauty
   set beauty_kind = lower(beauty_kind)
 where beauty_kind <> lower(beauty_kind);

-- «Пометки» — отдельно: там уже завелись два написания одного и того же
-- («Не тестируется на животных» из старой текстовой колонки рядом с
-- «не тестируется на животных» из справочника). Одного lower() мало — после
-- него в ячейке остались бы два одинаковых значения подряд, поэтому
-- раскладываем список, схлопываем дубли и собираем обратно, сохраняя порядок.

with normalized as (
  select b.id,
         string_agg(m.v, ', ' order by m.first_ord) as marks
    from public.brands_beauty b
    join lateral (
      select trim(lower(t.value)) as v, min(t.ord) as first_ord
        from unnest(string_to_array(b.marks, ',')) with ordinality as t(value, ord)
       where trim(t.value) <> ''
       group by trim(lower(t.value))
    ) m on true
   group by b.id
)
update public.brands_beauty b
   set marks = n.marks
  from normalized n
 where n.id = b.id
   and b.marks <> n.marks;

-- ---------------------------------------------------------------------------
-- 2. Справочники
-- ---------------------------------------------------------------------------

update public.field_defs
   set options = '{"для женщин","для мужчин"}'
 where column_name = 'audience';

update public.field_defs
   set options = '{"одежда","верхняя одежда","обувь","сумки","аксессуары","нижнее белье","украшения"}'
 where (table_name, column_name) = ('brands_fashion', 'fashion_kind');

update public.field_defs
   set options = '{"кэжуал","деловой стиль","ледилайк","аутдор","ворквир","авангард"}'
 where (table_name, column_name) = ('brands_fashion', 'tags');

update public.field_defs
   set options = '{"базовое","акцентное"}'
 where (table_name, column_name) = ('brands_fashion', 'style_role');

update public.field_defs
   set options = '{"уход","макияж","для волос","для лица","для тела","мужское","парфюм","бытовая химия","для детей","для подростков","личная гигиена","тревел"}'
 where (table_name, column_name) = ('brands_beauty', 'beauty_kind');

-- Лайфстайл трогать не нужно: его справочники изначально строчные.

-- ---------------------------------------------------------------------------
-- Проверки
-- ---------------------------------------------------------------------------
-- Ни одного варианта с большой буквы, кроме города и страны.
--
--   select table_name, column_name, options from public.field_defs
--    where column_name not in ('city', 'country')
--      and exists (select 1 from unnest(options) o where o <> lower(o));
--
-- Ни одной ячейки с большой буквы в справочных колонках. Ожидается пусто.
--
--   select 'fashion' as t, count(*) from public.brands_fashion
--    where fashion_kind <> lower(fashion_kind) or tags <> lower(tags)
--       or style_role <> lower(style_role) or audience <> lower(audience)
--   union all select 'beauty', count(*) from public.brands_beauty
--    where beauty_kind <> lower(beauty_kind) or marks <> lower(marks);
--
-- Какие пометки остались в базе — дублей по регистру быть не должно.
--
--   select distinct trim(v) as mark from public.brands_beauty,
--          unnest(string_to_array(marks, ',')) as v
--    where trim(v) <> '' order by 1;
