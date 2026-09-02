-- Право на удаление брендов и «Нижнее бельё» → «Нижнее белье».
--
-- Разовая правка боевой базы: вставить целиком в SQL Editor проекта → Run.
-- Идемпотентен: политики пересоздаются, апдейты идут с условием по старому
-- значению. В свежей базе делать ничего не нужно — schema.sql уже актуален.

-- ---------------------------------------------------------------------------
-- 1. Дубль в справочнике категорий моды
-- ---------------------------------------------------------------------------
-- Раньше сайт подмешивал в варианты фильтра всё, что встречалось в данных,
-- поэтому написание с «ё» жило рядом с написанием без «ё». Теперь справочник
-- закрыт (варианты берутся только отсюда), и лишнее написание надо убрать.

update public.field_defs
   set options = '{"Одежда","Верхняя одежда","Обувь","Сумки","Аксессуары","Нижнее белье"}'
 where table_name = 'brands_fashion'
   and column_name = 'fashion_kind';

-- fashion_kind мультизначный («Одежда, Нижнее бельё»), поэтому правим подстроку.
update public.brands_fashion
   set fashion_kind = replace(fashion_kind, 'Нижнее бельё', 'Нижнее белье')
 where fashion_kind like '%Нижнее бельё%';

-- ---------------------------------------------------------------------------
-- 2. Удаление бренда
-- ---------------------------------------------------------------------------
-- Архив прячет бренд из выдачи, delete убирает строку насовсем. Раньше
-- delete-политики не было намеренно; теперь редакции нужны оба действия.

do $$
declare t text;
begin
  foreach t in array array['brands_fashion', 'brands_lifestyle', 'brands_beauty'] loop
    execute format('drop policy if exists brands_delete on public.%I', t);
    execute format('create policy brands_delete on public.%I for delete to authenticated using (true)', t);
  end loop;
end $$;

grant delete on public.brands_fashion, public.brands_lifestyle, public.brands_beauty
  to authenticated;

-- Проверка: должно вернуться три строки brands_delete.
--
--   select tablename, policyname from pg_policies
--    where policyname = 'brands_delete';
