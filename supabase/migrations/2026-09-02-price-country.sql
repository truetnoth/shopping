-- Ценовой сегмент цифрами → знаками доллара, «Российский бренд» → «Россия».
--
-- Разовая правка боевой базы: вставить целиком в SQL Editor проекта → Run.
-- Скрипт идемпотентен — повторный запуск ничего не портит, потому что все
-- апдейты идут с условием по старому значению: '$' уже не совпадёт с '1'.
-- В свежей базе делать ничего не нужно: schema.sql уже содержит новые варианты.

-- ---------------------------------------------------------------------------
-- 1. Варианты в справочнике полей
-- ---------------------------------------------------------------------------

update public.field_defs set options = '{"$","$$","$$$"}' where column_name = 'price_tier';
update public.field_defs set options = '{"Россия"}'       where column_name = 'country';

-- ---------------------------------------------------------------------------
-- 2. Сами данные во всех трёх таблицах
-- ---------------------------------------------------------------------------
-- В базе редакции проставлялись только 1, 3 и 5 — это и есть три уровня.
-- Случайные 2 и 4 округляем к ближайшему, чтобы после миграции в колонке не
-- осталось цифр.
--
-- Условие where по старому значению нужно не только ради идемпотентности: без
-- него апдейт задел бы строки, которых правка не касается. Таблицы перечислены
-- руками, а не циклом: в динамическом коде знаки доллара пришлось бы экранировать,
-- и разовая миграция стала бы менее читаемой, чем она есть.

update public.brands_fashion   set price_tier = '$'   where price_tier in ('1', '2');
update public.brands_fashion   set price_tier = '$$'  where price_tier =  '3';
update public.brands_fashion   set price_tier = '$$$' where price_tier in ('4', '5');
update public.brands_fashion   set country = 'Россия' where country = 'Российский бренд';

update public.brands_lifestyle set price_tier = '$'   where price_tier in ('1', '2');
update public.brands_lifestyle set price_tier = '$$'  where price_tier =  '3';
update public.brands_lifestyle set price_tier = '$$$' where price_tier in ('4', '5');
update public.brands_lifestyle set country = 'Россия' where country = 'Российский бренд';

update public.brands_beauty    set price_tier = '$'   where price_tier in ('1', '2');
update public.brands_beauty    set price_tier = '$$'  where price_tier =  '3';
update public.brands_beauty    set price_tier = '$$$' where price_tier in ('4', '5');
update public.brands_beauty    set country = 'Россия' where country = 'Российский бренд';

-- Проверка: обе выборки должны вернуть ноль.
--
--   select count(*) from public.brands_fashion where price_tier ~ '^[0-9]';
--   select count(*) from public.brands_fashion where country = 'Российский бренд';
