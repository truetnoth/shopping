-- Правки редакции от 22.09: лишние поля вон, галочки — по отдельности.
--
-- Разовая правка боевой базы: вставить целиком в SQL Editor проекта → Run.
-- Идемпотентна: колонки добавляются через if not exists, описания полей
-- присваиваются, а не сдвигаются. В свежей базе делать ничего не нужно —
-- schema.sql уже актуален.
--
-- Источник — пять скриншотов редакции и сводка в тексте. Смысл правок один:
-- убрать из разделов «паспортные» поля, которые редакция не собирает, и
-- вытащить три галочки из общей кучи «Особенности» в отдельные пункты.
--
-- Частично отменяет миграцию 2026-09-16: та намеренно оставила страну и город
-- во всех трёх таблицах, чтобы фильтры по ним были и в режиме «Все». Теперь
-- редакция просит обратного — они нужны только в моде. Последствие принято:
-- на вкладке «Все» фильтров по городу и стране больше нет.

-- ---------------------------------------------------------------------------
-- 0. Прогнать ДО запуска: что потеряется
-- ---------------------------------------------------------------------------
-- Шаг 3 удаляет колонки, а вместе с ними и то, что в них записано. Запрос
-- показывает, сколько строк реально заполнено. Ожидаются нули; если нет —
-- сперва перенесите значения, а потом запускайте миграцию.
--
--   select 'lifestyle.city' as col, count(*) from public.brands_lifestyle where city <> ''
--   union all select 'lifestyle.country',      count(*) from public.brands_lifestyle where country <> ''
--   union all select 'lifestyle.founded_year', count(*) from public.brands_lifestyle where founded_year <> ''
--   union all select 'beauty.city',            count(*) from public.brands_beauty    where city <> ''
--   union all select 'beauty.country',         count(*) from public.brands_beauty    where country <> ''
--   union all select 'beauty.founded_year',    count(*) from public.brands_beauty    where founded_year <> ''
--   union all select 'beauty.own_production',  count(*) from public.brands_beauty    where own_production <> ''
--   union all select 'beauty.handmade',        count(*) from public.brands_beauty    where handmade <> '';

-- ---------------------------------------------------------------------------
-- 1. Новые возможности описаний полей
-- ---------------------------------------------------------------------------
-- filter_group — какие галочки сливаются в одну группу фильтров. Пусто:
-- галочка рисуется отдельной строкой; одинаковое значение у нескольких: общая
-- группа с этим заголовком. Умолчание «каждая сама по себе» намеренное —
-- «Мультибренд», «Продается на маркетплейсе» и «ЖП» редакция путала с
-- остальными свойствами бренда, когда они лежали в общей куче.

alter table public.field_defs add column if not exists filter_group text;

-- openmulti — открытый справочник, в котором значений можно выбрать несколько.
-- Ограничение приходится пересоздавать: create table if not exists в schema.sql
-- уже созданную таблицу не трогает, новый тип иначе не пройдёт check.

alter table public.field_defs drop constraint if exists field_defs_type_check;
alter table public.field_defs add constraint field_defs_type_check
  check (type in ('text','longtext','url','select','multiselect','number','date','bool','openselect','openmulti'));

-- ---------------------------------------------------------------------------
-- 2. Вью brand_fields отдаёт filter_group
-- ---------------------------------------------------------------------------
-- create or replace допускает дописывание колонок только в конец списка —
-- filter_group идёт после is_name, поэтому гранты и зависимости сохраняются.
-- Без coalesce: NULL тут значим, он и означает «отдельная строка фильтров».

create or replace view public.brand_fields
with (security_invoker = on) as
select
  c.table_name::text                                    as table_name,
  c.column_name::text                                   as column_name,
  coalesce(d.label, c.column_name::text)                as label,
  coalesce(d.type, 'text')                              as type,
  coalesce(d.options, '{}'::text[])                     as options,
  coalesce(d.required, c.column_name::text = 'name')    as required,
  coalesce(d.searchable, true)                          as searchable,
  coalesce(d.show_in_card, true)                        as show_in_card,
  coalesce(d.sort_order, 100 + c.ordinal_position::int) as sort_order,
  c.column_name::text = 'name'                          as is_name,
  d.filter_group                                        as filter_group
from information_schema.columns c
left join lateral (
  select f.*
  from public.field_defs f
  where f.column_name = c.column_name::text
    and f.table_name in (c.table_name::text, '*')
  -- конкретная таблица важнее общего правила '*'
  order by (f.table_name = '*')
  limit 1
) d on true
where c.table_schema::text = 'public'
  and c.table_name::text in ('brands_fashion', 'brands_lifestyle', 'brands_beauty')
  and c.column_name::text not in ('id', 'updated_at', 'updated_by', 'archived');

-- ---------------------------------------------------------------------------
-- 3. Состав колонок
-- ---------------------------------------------------------------------------
-- «Мультибренд» редакция просила и в красоте — в форме он встаёт над
-- «Маркетплейсом». Имя колонки то же, что в двух других таблицах: так поле
-- остаётся в общем ядре и работает фильтром в режиме «Все».

alter table public.brands_beauty
  add column if not exists multibrand text not null default '';

-- Страна, город и год основания нужны только в моде. Своё производство и
-- ручная работа в красоте — не критерий.

alter table public.brands_lifestyle
  drop column if exists city,
  drop column if exists country,
  drop column if exists founded_year;

alter table public.brands_beauty
  drop column if exists city,
  drop column if exists country,
  drop column if exists founded_year,
  drop column if exists own_production,
  drop column if exists handmade;

-- Строки field_defs с table_name = '*' для city, country, founded_year,
-- own_production и handmade удалять не нужно: brand_fields строится по
-- information_schema, и правило без колонки просто не даёт строки. А вот общее
-- правило для «Пометок» осталось без хозяина — колонка есть только в красоте,
-- и у красоты теперь своя строка со своим справочником.

delete from public.field_defs where (table_name, column_name) = ('*', 'marks');

-- ---------------------------------------------------------------------------
-- 4. Описания полей
-- ---------------------------------------------------------------------------
-- Порядок задаёт сразу две вещи: как поля идут в форме и в карточке и какие
-- фильтры видно на экране поиска без раскрывашки (всё до 6-го включительно).
-- Граница сдвинулась с 5 на 6 — вместе с PRIMARY_FILTER_MAX_ORDER в коде, —
-- чтобы «Мультибренд» попал в основные фильтры.
--
--   1 Бренд                 6 Мультибренд      11 Своё производство  16 Страна
--   2 Сайт                  7 Теги / Зоны      12 Ручная работа      17 Год основания
--   3 Категория             8 Характеристика   13 Винтаж             18 Пометки
--   4 Для кого/Назначение   9 На маркетплейсе  14 СТМ                19 Контакт
--   5 Ценовой сегмент      10 ЖП               15 Город              20 Примечания
--
-- Видимые фильтры получаются такие: в моде — категория, «Для кого», сегмент и
-- мультибренд; в лайфстайле — категория, предназначение, сегмент и мультибренд;
-- в красоте — категория, сегмент и мультибренд.

insert into public.field_defs
  (table_name, column_name, label, type, options, required, searchable, show_in_card, sort_order, filter_group)
values
  -- общее ядро
  ('*', 'name',           'Бренд',                     'text',        '{}',                                                      true,  true,  true,  1,  null),
  ('*', 'url',            'Сайт',                      'url',         '{}',                                                      true,  true,  true,  2,  null),
  ('*', 'audience',       'Для кого',                  'multiselect', '{"Для женщин","Для мужчин"}',                             false, true,  true,  4,  null),
  ('*', 'price_tier',     'Ценовой сегмент',           'select',      '{"$","$$","$$$"}',                                        false, false, true,  5,  null),
  ('*', 'multibrand',     'Мультибренд',               'bool',        '{да}',                                                    false, false, true,  6,  null),
  -- Прежняя подпись «Маркетплейс» читалась как свойство самого бренда и
  -- перекликалась с «Мультибрендом», поэтому развёрнута до целой фразы.
  ('*', 'marketplace',    'Продается на маркетплейсе', 'bool',        '{да}',                                                    false, false, true,  9,  null),
  -- Сокращение редакции, расшифровывать не просили: подпись правится одной
  -- строкой здесь и меняется на сайте без пересборки.
  ('*', 'zhp',            'ЖП',                        'bool',        '{да}',                                                    false, false, true,  10, null),
  ('*', 'own_production', 'Есть своё производство',    'bool',        '{да}',                                                    false, false, true,  11, 'Особенности'),
  ('*', 'handmade',       'Ручная работа',             'bool',        '{да}',                                                    false, false, true,  12, 'Особенности'),
  ('*', 'city',           'Город',                     'openselect',  '{"Москва","Петербург","Екатеринбург","Нижний Новгород"}', false, true,  true,  15, null),
  ('*', 'country',        'Страна',                    'openselect',  '{"Россия"}',                                              false, true,  true,  16, null),
  ('*', 'founded_year',   'Год основания',             'number',      '{}',                                                      false, false, true,  17, null),
  ('*', 'contact',        'Контакт',                   'text',        '{}',                                                      false, true,  true,  19, null),
  ('*', 'notes',          'Примечания',                'longtext',    '{}',                                                      false, true,  true,  20, null),

  -- мода
  ('brands_fashion',   'fashion_kind',   'Категория',      'multiselect', '{"Одежда","Верхняя одежда","Обувь","Сумки","Аксессуары","Нижнее белье","Украшения"}', true,  true, true, 3, null),
  ('brands_fashion',   'tags',           'Теги',           'multiselect', '{"Кэжуал","Деловой стиль","Ледилайк","Аутдор","Ворквир","Авангард"}',                 false, true, true, 7, null),
  ('brands_fashion',   'style_role',     'Характеристика', 'select',      '{"Базовое","Акцентное"}',                                                             false, true, true, 8, null),

  -- лайфстайл
  ('brands_lifestyle', 'lifestyle_kind', 'Категория',      'multiselect', '{"посуда","декор","мебель","хобби","уборка","текстиль","освещение","хранение","растения"}', true,  true, true, 3,  null),
  ('brands_lifestyle', 'purpose',        'Предназначение', 'multiselect', '{"для работы","для учебы","для путешествий","для дома"}',                                  false, true, true, 4,  null),
  ('brands_lifestyle', 'zones',          'Зоны',           'multiselect', '{"кухня","ванная","гостиная","спальня","дача","сад"}',                                     false, true, true, 7,  null),
  ('brands_lifestyle', 'style_role',     'Характеристика', 'select',      '{"попроще","дизайнерское"}',                                                               false, true, true, 8,  null),
  ('brands_lifestyle', 'vintage',        'Винтаж',         'bool',        '{да}',                                                                                     false, false, true, 13, 'Особенности'),
  ('brands_lifestyle', 'private_label',  'СТМ',            'bool',        '{да}',                                                                                     false, false, true, 14, 'Особенности'),

  -- красота
  -- «Критерии» были нашим словом, редакция называет этот блок категорией — как
  -- и в двух других разделах.
  ('brands_beauty',    'beauty_kind',    'Категория',      'multiselect', '{"Уход","Макияж","Для волос","Для лица","Для тела","Мужское","Парфюм","Бытовая химия","Для детей","Для подростков","Личная гигиена","Тревел"}', true, true, true, 3, null),
  -- Заняли место города: открытый многозначный справочник, куда редакция
  -- дописывает часто встречающиеся нюансы прямо из формы и потом ищет по ним.
  -- Затравка одна — пример из письма; остальное редакция заведёт сама.
  ('brands_beauty',    'marks',          'Пометки',        'openmulti',   '{"не тестируется на животных"}',                                                           false, true, true, 18, null)
on conflict (table_name, column_name) do update set
  label        = excluded.label,
  type         = excluded.type,
  options      = excluded.options,
  required     = excluded.required,
  searchable   = excluded.searchable,
  show_in_card = excluded.show_in_card,
  sort_order   = excluded.sort_order,
  filter_group = excluded.filter_group;

-- ---------------------------------------------------------------------------
-- Проверки
-- ---------------------------------------------------------------------------
-- Состав и порядок полей по разделам. Номера внутри раздела не повторяются, в
-- лайфстайле и красоте нет города, страны и года основания, в красоте нет
-- производства и ручной работы.
--
--   select table_name, sort_order, column_name, label, type, filter_group
--     from public.brand_fields order by table_name, sort_order;
--
-- Что видно на экране поиска сразу (всё остальное — под раскрывашкой).
-- Ожидается «Мультибренд» в конце каждой строки.
--
--   select table_name, string_agg(label, ', ' order by sort_order) as primary_filters
--     from public.brand_fields
--    where sort_order <= 6 and type in ('select','multiselect','openselect','openmulti','bool')
--    group by table_name;
--
-- Галочки, которые стоят в фильтрах отдельной строкой: ожидаются ровно
-- marketplace, multibrand и zhp.
--
--   select distinct column_name, label from public.brand_fields
--    where type = 'bool' and filter_group is null order by column_name;
--
-- Общее ядро режима «Все» — колонки, которые есть во всех трёх таблицах.
-- Ожидаются 7 строк: name, url, price_tier, marketplace, multibrand, zhp,
-- contact. Было 11 — ушли city, country, founded_year, own_production и
-- handmade, пришёл multibrand.
--
--   select column_name from public.brand_fields
--    group by column_name having count(*) = 3 order by min(sort_order);
