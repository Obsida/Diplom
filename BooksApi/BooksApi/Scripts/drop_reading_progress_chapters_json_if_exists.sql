-- Если успели добавить chapters_progress_json — можно удалить колонку.
ALTER TABLE reading_progress DROP COLUMN IF EXISTS chapters_progress_json;
