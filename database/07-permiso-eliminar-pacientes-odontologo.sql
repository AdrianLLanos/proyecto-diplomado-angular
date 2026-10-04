-- Agrega el permiso de baja de pacientes al rol Odontólogo.
-- Se mantiene separado para no cambiar la migración 05 ya aplicada.
INSERT INTO permisos_roles(rol_id,permiso_id)
SELECT r.id,p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre='Doctor'
  AND p.nombre='pacientes.delete'
ON CONFLICT DO NOTHING;
