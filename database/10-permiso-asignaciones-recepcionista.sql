-- Asignación de pacientes para administración y recepción, sin acceso radiográfico adicional.
INSERT INTO permisos(nombre,nombre_visible) VALUES
 ('asignaciones.manage','Asignar pacientes a odontólogos')
ON CONFLICT (nombre) DO NOTHING;
DELETE FROM permisos_roles WHERE rol_id IN (SELECT id FROM roles WHERE nombre='Receptionist');
INSERT INTO permisos_roles(rol_id,permiso_id)
 SELECT r.id,p.id FROM roles r CROSS JOIN permisos p
 WHERE r.nombre='Receptionist' AND p.nombre IN (
 'pacientes.read','pacientes.create','pacientes.update','medicos.read','horarios.read',
 'citas.read','citas.create','citas.update','citas.delete','asignaciones.manage')
ON CONFLICT DO NOTHING;
INSERT INTO permisos_roles(rol_id,permiso_id)
 SELECT r.id,p.id FROM roles r CROSS JOIN permisos p
 WHERE r.nombre IN ('Super Admin','Receptionist') AND p.nombre='asignaciones.manage'
ON CONFLICT DO NOTHING;
