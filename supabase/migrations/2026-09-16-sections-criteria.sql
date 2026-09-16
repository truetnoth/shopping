-- Окончательные критерии по трём разделам.
--
-- Разовая правка боевой базы: вставить целиком в SQL Editor проекта → Run.
-- Идемпотентна: колонки добавляются через if not exists, описания полей
-- присваиваются, а не сдвигаются. В свежей базе делать ничего не нужно —
-- schema.sql уже актуален.
--
-- Источник — итоговая таблица редакции: вкладки «Мода», «Лайфстайл»,
-- «Красота». Справочники взяты из выпадающих списков самих вкладок, а не из
-- служебной вкладки _schema: та осталась на августовском состоянии и ни одного
-- нового блока не знает.
--
-- Вкладку «Мода» тоже читаем выборочно — её списки это снимок базы до
-- августовских миграций: ценовой сегмент там снова цифрами, страна снова
-- «Российский бренд», «Украшений» нет. Переносим оттуда только четыре новых
-- поля, остальное в моде не трогаем.

-- ---------------------------------------------------------------------------
-- 0. Прогнать ДО запуска: что потеряется
-- ---------------------------------------------------------------------------
-- Шаг 2 удаляет колонки, а вместе с ними и то, что в них записано. Запрос
-- показывает, сколько строк реально заполнено. Ожидаются нули; если нет —
-- сперва перенесите значения, а потом запускайте миграцию.
--
--   select 'lifestyle.audience' as col, count(*) from public.brands_lifestyle where audience <> ''
--   union all select 'lifestyle.tags',       count(*) from public.brands_lifestyle where tags <> ''
--   union all select 'beauty.audience',      count(*) from public.brands_beauty    where audience <> ''
--   union all select 'beauty.tags',          count(*) from public.brands_beauty    where tags <> ''
--   union all select 'beauty.cruelty_free',  count(*) from public.brands_beauty    where cruelty_free <> '';

-- ---------------------------------------------------------------------------
-- 1. Новые колонки
-- ---------------------------------------------------------------------------
-- Все text и not null default '' — строковый контракт клиента: мультизначные
-- поля лежат через запятую, галочки словом «да».
--
-- Три блока — «Маркетплейс», «ЖП» и «Контакт» — редакция просила во все три
-- раздела. Одинаковое имя колонки важно не только для порядка: в режиме «Все»
-- сайт ищет и фильтрует по полям, которые есть во всех трёх таблицах.

alter table public.brands_fashion
  add column if not exists marketplace   text not null default '',
  add column if not exists multibrand    text not null default '',
  add column if not exists zhp           text not null default '',
  add column if not exists contact       text not null default '';

alter table public.brands_lifestyle
  add column if not exists purpose       text not null default '',
  add column if not exists zones         text not null default '',
  -- Та же колонка, что «Характеристика» в моде, но справочник свой: строка
  -- field_defs с конкретной таблицей перебивает общую.
  add column if not exists style_role    text not null default '',
  add column if not exists marketplace   text not null default '',
  add column if not exists multibrand    text not null default '',
  add column if not exists vintage       text not null default '',
  add column if not exists private_label text not null default '',
  add column if not exists zhp           text not null default '',
  add column if not exists contact       text not null default '',
  add column if not exists notes         text not null default '';

alter table public.brands_beauty
  add column if not exists marketplace   text not null default '',
  add column if not exists zhp           text not null default '',
  add column if not exists contact       text not null default '',
  add column if not exists notes         text not null default '',
  add column if not exists marks         text not null default '';

-- ---------------------------------------------------------------------------
-- 2. Колонки, которых в итоговых таблицах нет
-- ---------------------------------------------------------------------------
-- «Для кого» и «Теги» остаются только в моде: в лайфстайле и красоте редакция
-- их не собирала. «Не тестируют на животных» было нашей заглушкой, в итоговой
-- таблице красоты такого критерия нет.
--
-- Страна, город и год основания при этом остаются во всех трёх, хотя в
-- таблицах лайфстайла и красоты их тоже нет: это не критерии, а паспорт
-- бренда, и без них из режима «Все» пропали бы фильтры по стране и городу.

alter table public.brands_lifestyle
  drop column if exists audience,
  drop column if exists tags;

alter table public.brands_beauty
  drop column if exists audience,
  drop column if exists tags,
  drop column if exists cruelty_free;

delete from public.field_defs
 where (table_name, column_name) in (
   ('brands_beauty', 'cruelty_free'),
   -- Общее правило для тегов осталось без хозяина: колонка есть только в моде,
   -- а у моды и так своя строка со списком.
   ('*', 'tags')
 );

-- ---------------------------------------------------------------------------
-- 3. Описания полей
-- ---------------------------------------------------------------------------
-- Порядок задаёт сразу две вещи: как поля идут в форме и в карточке и какие
-- фильтры видно на экране поиска без раскрывашки (всё до 5-го включительно).
-- Отсюда «Маркетплейс» под номером 6 — редакция просила его первым среди
-- дополнительных фильтров во всех трёх разделах.
--
--   1 Бренд                6 Маркетплейс        11 Страна            16 Контакт
--   2 Сайт                 7 Теги / Зоны        12 Своё производство 17 Винтаж
--   3 Категория/Критерии   8 Характеристика     13 Ручная работа     18 СТМ
--   4 Для кого / Назначение 9 Мультибренд       14 ЖП                19 Примечания
--   5 Ценовой сегмент     10 Город              15 Год основания     20 Пометки
--
-- Видимые фильтры получаются ровно те, что просила редакция: в моде —
-- категория, «Для кого» и сегмент; в лайфстайле — категория, предназначение и
-- сегмент; в красоте — критерии и сегмент.

insert into public.field_defs
  (table_name, column_name, label, type, options, required, searchable, show_in_card, sort_order)
values
  -- общее ядро
  ('*', 'name',           'Бренд',                  'text',        '{}',                                                      true,  true,  true,  1),
  ('*', 'url',            'Сайт',                   'url',         '{}',                                                      true,  true,  true,  2),
  ('*', 'audience',       'Для кого',               'multiselect', '{"Для женщин","Для мужчин"}',                             false, true,  true,  4),
  ('*', 'price_tier',     'Ценовой сегмент',        'select',      '{"$","$$","$$$"}',                                        false, false, true,  5),
  ('*', 'marketplace',    'Маркетплейс',            'bool',        '{да}',                                                    false, false, true,  6),
  ('*', 'multibrand',     'Мультибренд',            'bool',        '{да}',                                                    false, false, true,  9),
  ('*', 'city',           'Город',                  'openselect',  '{"Москва","Петербург","Екатеринбург","Нижний Новгород"}', false, true,  true,  10),
  ('*', 'country',        'Страна',                 'openselect',  '{"Россия"}',                                              false, true,  true,  11),
  ('*', 'own_production', 'Есть своё производство', 'bool',        '{да}',                                                    false, false, true,  12),
  ('*', 'handmade',       'Ручная работа',          'bool',        '{да}',                                                    false, false, true,  13),
  -- Сокращение редакции, расшифровывать не просили: правится одной строкой
  -- здесь и на сайте меняется без пересборки.
  ('*', 'zhp',            'ЖП',                     'bool',        '{да}',                                                    false, false, true,  14),
  ('*', 'founded_year',   'Год основания',          'number',      '{}',                                                      false, false, true,  15),
  ('*', 'contact',        'Контакт',                'text',        '{}',                                                      false, true,  true,  16),
  ('*', 'notes',          'Примечания',             'longtext',    '{}',                                                      false, true,  true,  19),
  ('*', 'marks',          'Пометки',                'text',        '{}',                                                      false, true,  true,  20),

  -- мода
  ('brands_fashion',   'fashion_kind',   'Категория',      'multiselect', '{"Одежда","Верхняя одежда","Обувь","Сумки","Аксессуары","Нижнее белье","Украшения"}', true,  true, true, 3),
  ('brands_fashion',   'tags',           'Теги',           'multiselect', '{"Кэжуал","Деловой стиль","Ледилайк","Аутдор","Ворквир","Авангард"}',                 false, true, true, 7),
  ('brands_fashion',   'style_role',     'Характеристика', 'select',      '{"Базовое","Акцентное"}',                                                             false, true, true, 8),

  -- лайфстайл
  ('brands_lifestyle', 'lifestyle_kind', 'Категория',      'multiselect', '{"посуда","декор","мебель","хобби","уборка","текстиль","освещение","хранение","растения"}', true,  true, true, 3),
  ('brands_lifestyle', 'purpose',        'Предназначение', 'multiselect', '{"для работы","для учебы","для путешествий","для дома"}',                                  false, true, true, 4),
  ('brands_lifestyle', 'zones',          'Зоны',           'multiselect', '{"кухня","ванная","гостиная","спальня","дача","сад"}',                                     false, true, true, 7),
  ('brands_lifestyle', 'style_role',     'Характеристика', 'select',      '{"попроще","дизайнерское"}',                                                               false, true, true, 8),
  ('brands_lifestyle', 'vintage',        'Винтаж',         'bool',        '{да}',                                                                                     false, false, true, 17),
  ('brands_lifestyle', 'private_label',  'СТМ',            'bool',        '{да}',                                                                                     false, false, true, 18),

  -- красота
  ('brands_beauty',    'beauty_kind',    'Критерии',       'multiselect', '{"Уход","Макияж","Для волос","Для лица","Для тела","Мужское","Парфюм","Бытовая химия","Для детей","Для подростков","Личная гигиена","Тревел"}', true, true, true, 3)
on conflict (table_name, column_name) do update set
  label        = excluded.label,
  type         = excluded.type,
  options      = excluded.options,
  required     = excluded.required,
  searchable   = excluded.searchable,
  show_in_card = excluded.show_in_card,
  sort_order   = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Проверки
-- ---------------------------------------------------------------------------
-- Состав и порядок полей по разделам. «Маркетплейс» должен быть шестым в
-- каждом из трёх наборов, номера внутри раздела — не повторяться.
--
--   select table_name, sort_order, column_name, label, type
--     from public.brand_fields order by table_name, sort_order;
--
-- Что видно на экране поиска сразу (всё остальное — под раскрывашкой).
--
--   select table_name, string_agg(label, ', ' order by sort_order) as primary_filters
--     from public.brand_fields
--    where sort_order <= 5 and type in ('select','multiselect','openselect','bool')
--    group by table_name;
--
-- Общее ядро режима «Все» — колонки, которые есть во всех трёх таблицах.
-- Ожидаются 11 строк, включая marketplace, zhp и contact.
--
--   select column_name from public.brand_fields
--    group by column_name having count(*) = 3 order by min(sort_order);
