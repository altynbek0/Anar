-- =============================================
-- 005: Год поступления ученика в школу
-- Текст (а не int): родители могут вписать произвольный ответ.
-- =============================================

alter table students add column if not exists enrollment_year text;

-- На случай, если колонка уже была создана как int — приводим к тексту.
alter table students alter column enrollment_year type text using enrollment_year::text;
