-- Reemplaza los tres valores indicados y ejecuta MANUALMENTE una vez.
-- pgcrypto está disponible en Supabase. No existe una contraseña predeterminada.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $$
DECLARE
  correo_admin TEXT := 'alejandrollanoszenteno@gmail.com';
  clave_admin TEXT := 'alejandro2907*.';
  nombre_admin TEXT := 'Administrador';
  nuevo_id BIGINT;
BEGIN
  IF correo_admin='TU_CORREO' OR clave_admin='TU_CONTRASENA' OR length(clave_admin)<12 THEN
    RAISE EXCEPTION 'Escribe tu correo y una contraseña de al menos 12 caracteres antes de ejecutar';
  END IF;
  INSERT INTO usuarios(empresa_id,nombre,correo,contrasena,estado,creado_en)
  VALUES(1,nombre_admin,lower(correo_admin),extensions.crypt(clave_admin,extensions.gen_salt('bf',12)),'1',now())
  RETURNING id INTO nuevo_id;
  INSERT INTO usuarios_empresas(usuario_id,empresa_id,tipo_usuario) VALUES(nuevo_id,1,'User');
  INSERT INTO roles_modelos(rol_id,tipo_modelo,modelo_id) SELECT id,'User',nuevo_id FROM roles WHERE nombre='Super Admin';
END $$;
