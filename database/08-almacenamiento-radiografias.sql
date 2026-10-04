-- Los archivos nuevos se guardan en Supabase Storage, no en la base de datos.
ALTER TABLE radiografias ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE radiografias ALTER COLUMN contenido DROP NOT NULL;
ALTER TABLE radiografias ALTER COLUMN sha256 DROP NOT NULL;
ALTER TABLE accesos_radiografias ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_radiografias_storage_path
  ON radiografias(storage_path) WHERE storage_path IS NOT NULL;
