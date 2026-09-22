-- База брендов — схема Supabase.
-- Выполняется целиком в SQL Editor проекта. Скрипт идемпотентен: повторный
-- запуск не ломает уже залитые данные.

-- ---------------------------------------------------------------------------
-- 1. Три таблицы категорий
-- ---------------------------------------------------------------------------
-- Служебные колонки (id, updated_at, updated_by, archived) одинаковы у всех
-- трёх и на сайт как поля не выводятся. Все остальные колонки — text: это
-- сохраняет строковый контракт клиента (мультизначные поля через запятую,
-- галочки словом «да») и делает редактор таблиц в панели похожим на привычную
-- таблицу.

create table if not exists public.brands_fashion (
  id          uuid primary key default gen_random_uuid(),
  updated_at  timestamptz not null default now(),
  updated_by  text not null default '',
  archived    boolean not null default false,

  -- общее ядро: эти колонки есть во всех трёх таблицах, и именно по ним
  -- работают поиск и фильтры в режиме «Все»
  name            text not null,
  url             text not null default '',
  price_tier      text not null default '',
  marketplace     text not null default '',
  multibrand      text not null default '',
  zhp             text not null default '',
  contact         text not null default '',

  -- своё. Страна, город и год основания остались только здесь: в лайфстайле и
  -- красоте редакция их не собирает (правки 22.09)
  country         text not null default '',
  city            text not null default '',
  founded_year    text not null default '',
  own_production  text not null default '',
  handmade        text not null default '',
  audience        text not null default '',
  tags            text not null default '',
  fashion_kind    text not null default '',
  style_role      text not null default ''
);

create table if not exists public.brands_lifestyle (
  id          uuid primary key default gen_random_uuid(),
  updated_at  timestamptz not null default now(),
  updated_by  text not null default '',
  archived    boolean not null default false,

  -- Страны, города и года основания тут нет: в лайфстайле редакция их не
  -- собирает (правки 22.09). Побочный эффект — они выпали из общего ядра, и на
  -- вкладке «Все» фильтра по городу больше нет, он живёт только в моде.
  name            text not null,
  url             text not null default '',
  price_tier      text not null default '',
  marketplace     text not null default '',
  multibrand      text not null default '',
  zhp             text not null default '',
  contact         text not null default '',

  own_production  text not null default '',
  handmade        text not null default '',
  lifestyle_kind  text not null default '',
  purpose         text not null default '',
  zones           text not null default '',
  -- Та же колонка, что «Характеристика» в моде, но справочник свой:
  -- «попроще / дизайнерское» вместо «Базовое / Акцентное».
  style_role      text not null default '',
  vintage         text not null default '',
  private_label   text not null default '',
  notes           text not null default ''
);

create table if not exists public.brands_beauty (
  id          uuid primary key default gen_random_uuid(),
  updated_at  timestamptz not null default now(),
  updated_by  text not null default '',
  archived    boolean not null default false,

  -- Своего производства и ручной работы тут тоже нет: в красоте это не
  -- критерий. Вместо города — «Пометки», открытый многозначный справочник.
  name            text not null,
  url             text not null default '',
  price_tier      text not null default '',
  marketplace     text not null default '',
  multibrand      text not null default '',
  zhp             text not null default '',
  contact         text not null default '',

  beauty_kind     text not null default '',
  notes           text not null default '',
  marks           text not null default ''
);

-- ---------------------------------------------------------------------------
-- 2. Описания полей — прямой наследник листа _schema
-- ---------------------------------------------------------------------------
-- Строка здесь ТОЛЬКО переопределяет то, что иначе взялось бы по умолчанию.
-- Колонка, которой тут нет, всё равно попадёт на сайт — как обычное текстовое
-- поле с заголовком, равным имени колонки.
-- table_name = '*' — правило для всех трёх таблиц сразу; строка с конкретной
-- таблицей перебивает общую.

create table if not exists public.field_defs (
  table_name   text not null,
  column_name  text not null,
  label        text,
  type         text check (type in ('text','longtext','url','select','multiselect','number','date','bool','openselect','openmulti')),
  options      text[],
  required     boolean,
  searchable   boolean,
  show_in_card boolean,
  sort_order   int,
  -- Только для галочек: имя общей группы фильтров. NULL — галочка стоит на
  -- экране поиска отдельной строкой, совпало у нескольких — общая группа.
  filter_group text,
  primary key (table_name, column_name)
);

-- ---------------------------------------------------------------------------
-- 3. Вью brand_fields — то, что читает сайт вместо шапки листа
-- ---------------------------------------------------------------------------
-- Источник истины по составу полей — сами колонки таблиц (information_schema),
-- ровно как раньше ей была шапка листа. Отсюда свойство «добавил колонку —
-- поле появилось на сайте без единой строчки кода».

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
  -- Без coalesce: NULL тут значим, он и означает «отдельная строка фильтров».
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
-- 4. Доступы: база закрыта целиком, и на чтение тоже
-- ---------------------------------------------------------------------------
-- anon-ключ лежит в собранном сайте, поэтому считать его секретом нельзя —
-- база закрывается не им, а политиками RLS. Ни одна политика не выдана роли
-- anon: посторонний с ключом на руках получит пустой ответ, а не данные.
-- Всё содержательное доступно только роли authenticated, то есть после входа
-- под паролем редакции.
--
-- Grant для anon при этом намеренно оставлен: без него PostgREST отвечал бы
-- ошибкой доступа, а с ним — пустым списком. Это удобнее (сайт показывает
-- экран входа, а не сбой) и позволяет keepalive-воркфлоу пинговать базу.

alter table public.brands_fashion   enable row level security;
alter table public.brands_lifestyle enable row level security;
alter table public.brands_beauty    enable row level security;
alter table public.field_defs       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['brands_fashion', 'brands_lifestyle', 'brands_beauty'] loop
    execute format('drop policy if exists brands_read   on public.%I', t);
    execute format('drop policy if exists brands_insert on public.%I', t);
    execute format('drop policy if exists brands_update on public.%I', t);
    execute format('drop policy if exists brands_delete on public.%I', t);

    execute format('create policy brands_read   on public.%I for select to authenticated using (true)', t);
    execute format('create policy brands_insert on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy brands_update on public.%I for update to authenticated using (true) with check (true)', t);
    -- Архив прячет бренд из выдачи, delete убирает строку насовсем: редакции
    -- нужны оба действия, поэтому право на удаление у роли есть.
    execute format('create policy brands_delete on public.%I for delete to authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists field_defs_read on public.field_defs;
create policy field_defs_read on public.field_defs for select to authenticated using (true);
-- Правки field_defs — только из панели Supabase (service role обходит RLS).

-- Гранты на уровне таблиц: RLS решает, какие строки видно, но сперва роль
-- должна иметь само право select. Вью с security_invoker читает
-- information_schema от имени вызывающего, поэтому без этих грантов список
-- колонок пришёл бы пустым.
--
-- anon грант на таблицы сохраняет намеренно: строк RLS ему всё равно не отдаст,
-- зато PostgREST ответит пустым списком, а не ошибкой доступа — сайт покажет
-- экран входа, а keepalive-воркфлоу останется зелёным.
grant select on public.brands_fashion, public.brands_lifestyle, public.brands_beauty,
                public.field_defs
  to anon, authenticated;

-- brand_fields — вью, а на вью политики RLS не распространяются: доступ там
-- решает только грант. Поэтому anon его не получает вовсе — иначе состав
-- колонок читался бы без входа.
revoke all on public.brand_fields from anon;
grant select on public.brand_fields to authenticated;
grant insert, update, delete on public.brands_fashion, public.brands_lifestyle, public.brands_beauty
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Стартовые описания полей
-- ---------------------------------------------------------------------------
-- Порядок задаёт сразу две вещи: как поля идут в форме и в карточке и какие
-- фильтры видно на экране поиска без раскрывашки (всё до 6-го включительно).
-- Отсюда «Мультибренд» под номером 6 — редакция просила его в основных
-- фильтрах, а «Продается на маркетплейсе» и «ЖП» — под раскрывашкой.
--
--   1 Бренд                 6 Мультибренд      11 Своё производство  16 Страна
--   2 Сайт                  7 Теги / Зоны      12 Ручная работа      17 Год основания
--   3 Категория             8 Характеристика   13 Винтаж             18 Пометки
--   4 Для кого/Назначение   9 На маркетплейсе  14 СТМ                19 Контакт
--   5 Ценовой сегмент      10 ЖП               15 Город              20 Примечания
--
-- filter_group у галочек: пусто — галочка стоит в фильтрах отдельной строкой
-- («Мультибренд», «Продается на маркетплейсе», «ЖП» — редакция путала их с
-- остальными свойствами); «Особенности» — общая группа для всего прочего.
--
-- Строки с table_name = '*' для city, country и founded_year намеренно общие,
-- хотя колонки остались только в моде: brand_fields строится по
-- information_schema, и правило без колонки просто не даёт строки.

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
  ('brands_beauty',    'beauty_kind',    'Категория',      'multiselect', '{"Уход","Макияж","Для волос","Для лица","Для тела","Мужское","Парфюм","Бытовая химия","Для детей","Для подростков","Личная гигиена","Тревел"}', true, true, true, 3, null),
  -- Заменили городу место: открытый многозначный справочник, куда редакция
  -- дописывает часто встречающиеся нюансы прямо из формы и потом ищет по ним.
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
