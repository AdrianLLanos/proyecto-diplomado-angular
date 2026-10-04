-- Aumenta el límite de radiografías a 50 MB.
-- El bucket privado Radiografias en Supabase Storage debe usar el mismo límite.
ALTER TABLE radiografias DROP CONSTRAINT IF EXISTS radiografias_tamano_check;
ALTER TABLE radiografias ADD CONSTRAINT radiografias_tamano_check CHECK(tamano>0 AND tamano<=52428800);
