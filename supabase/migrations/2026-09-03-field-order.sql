-- Порядок полей: «Сайт» сразу под названием бренда.
--
-- Разовая правка боевой базы: вставить целиком в SQL Editor проекта → Run.
-- Идемпотентна по построению: sort_order присваивается, а не сдвигается.
-- В свежей базе делать ничего не нужно — schema.sql уже актуален.
--
-- Порядок задаёт и форму, и карточку бренда, и то, какие фильтры видно сразу:
-- главные фильтры — поля до 5-го включительно (категория, «Для кого», цена).
--
--   1 Бренд              5 Ценовой сегмент     9 Страна
--   2 Сайт               6 Теги               10 Есть своё производство
--   3 Категория / Тип    7 Характеристика     11 Ручная работа
--   4 Для кого           8 Город              12 Год основания

update public.field_defs set sort_order =  2 where column_name = 'url';
update public.field_defs set sort_order =  3 where column_name in ('fashion_kind', 'lifestyle_kind', 'beauty_kind');
update public.field_defs set sort_order =  4 where column_name = 'audience';
update public.field_defs set sort_order =  5 where column_name = 'price_tier';
update public.field_defs set sort_order =  6 where column_name = 'tags';
update public.field_defs set sort_order =  7 where column_name in ('style_role', 'cruelty_free');
update public.field_defs set sort_order =  8 where column_name = 'city';
update public.field_defs set sort_order =  9 where column_name = 'country';
update public.field_defs set sort_order = 10 where column_name = 'own_production';
update public.field_defs set sort_order = 11 where column_name = 'handmade';
update public.field_defs set sort_order = 12 where column_name = 'founded_year';

-- Проверка: колонки должны выстроиться в порядке из шапки.
--
--   select column_name, label, sort_order from public.brand_fields
--    where table_name = 'brands_fashion' order by sort_order;
