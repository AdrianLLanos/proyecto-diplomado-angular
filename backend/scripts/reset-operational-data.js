import {pool} from '../src/db.js';

const apply=process.argv.includes('--apply');
const tables=[
  'usuarios','detalles_medicos','departamentos_hospitalarios','antecedentes_pacientes',
  'horarios_medicos','citas_pacientes','informes_laboratorio','recetas','facturas','pagos',
  'solicitudes_radiografias','radiografias','archivos'
];

async function counts(client){
  const result={};
  for(const table of tables){
    const {rows}=await client.query(`SELECT count(*)::int AS total FROM ${table}`);
    result[table]=rows[0].total;
  }
  return result;
}

const client=await pool.connect();
try{
  const before=await counts(client);
  const admins=await client.query(`SELECT count(*)::int AS total FROM usuarios u WHERE u.correo<>'admin.demo@example.test' AND EXISTS(
    SELECT 1 FROM roles_modelos rm JOIN roles r ON r.id=rm.rol_id
    WHERE rm.modelo_id=u.id AND rm.tipo_modelo='User' AND r.nombre='Super Admin'
  )`);
  console.log('Registros actuales:',before);
  console.log(`Administradores que se conservarán: ${admins.rows[0].total}`);
  if(!apply){console.log('Vista previa. Ejecuta npm run db:reset:operational -- --apply para borrar los datos operativos.');process.exitCode=1;}
  else if(!admins.rows[0].total)throw new Error('No hay una cuenta Super Admin para conservar. El reinicio fue cancelado.');
  else{
    await client.query('BEGIN');
    try{
      await client.query(`TRUNCATE TABLE
        radiografias, accesos_radiografias, eventos_radiografias, notificaciones_radiografias,
        solicitudes_radiografias, pacientes_odontologos,
        antecedentes_pacientes, horarios_medicos, citas_pacientes, informes_laboratorio, recetas,
        detalles_facturas, facturas, pagos,
        registros_campanas_sms, registros_campanas_correo, entregas_campanas,
        campanas_sms, campanas_correo, mensajes_contacto, archivos,
        restablecimientos_contrasena, sesiones_revocadas
        RESTART IDENTITY`);
      await client.query(`DELETE FROM detalles_medicos WHERE usuario_id IN (
        SELECT u.id FROM usuarios u WHERE u.correo='admin.demo@example.test' OR NOT EXISTS(
          SELECT 1 FROM roles_modelos rm JOIN roles r ON r.id=rm.rol_id
          WHERE rm.modelo_id=u.id AND rm.tipo_modelo='User' AND r.nombre='Super Admin'
        )
      )`);
      await client.query(`DELETE FROM usuarios_empresas WHERE usuario_id IN (
        SELECT u.id FROM usuarios u WHERE u.correo='admin.demo@example.test' OR NOT EXISTS(
          SELECT 1 FROM roles_modelos rm JOIN roles r ON r.id=rm.rol_id
          WHERE rm.modelo_id=u.id AND rm.tipo_modelo='User' AND r.nombre='Super Admin'
        )
      )`);
      await client.query(`DELETE FROM usuarios u WHERE u.correo='admin.demo@example.test' OR NOT EXISTS(
        SELECT 1 FROM roles_modelos rm JOIN roles r ON r.id=rm.rol_id
        WHERE rm.modelo_id=u.id AND rm.tipo_modelo='User' AND r.nombre='Super Admin'
      )`);
      await client.query(`DELETE FROM departamentos_hospitalarios WHERE empresa_id=1`);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}
    console.log('Reinicio terminado. Registros restantes:',await counts(client));
  }
}catch(error){console.error(`No se completó el reinicio: ${error.code||error.message}`);process.exitCode=1;}
finally{client.release();await pool.end();}
