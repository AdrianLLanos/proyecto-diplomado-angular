-- Permite al odontólogo registrar y actualizar únicamente los pacientes de su ámbito autorizado.
INSERT INTO permisos_roles(rol_id,permiso_id)
SELECT r.id,p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre='Doctor'
  AND p.nombre IN ('pacientes.create','pacientes.update')
ON CONFLICT DO NOTHING;
