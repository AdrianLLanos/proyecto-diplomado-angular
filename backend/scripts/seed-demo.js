import bcrypt from 'bcryptjs';
import {pool} from '../src/db.js';

const companyId=1;
const patients=[
 ['María Fernanda Rojas','maria.rojas.demo@example.test','76510001','1994-05-12','female'],
 ['José Luis Vargas','jose.vargas.demo@example.test','76510002','1987-11-03','male'],
 ['Carla Mendoza Flores','carla.mendoza.demo@example.test','76510003','2001-02-18','female'],
 ['Diego Ramírez Soto','diego.ramirez.demo@example.test','76510004','1979-07-25','male'],
 ['Lucía Herrera Paz','lucia.herrera.demo@example.test','76510005','1998-09-14','female'],
];
const doctors=[
 ['Dra. Valeria Quiroga','valeria.quiroga.demo@example.test','Ortodoncia'],
 ['Dr. Marco Salinas','marco.salinas.demo@example.test','Odontología general'],
];
const monday=()=>{const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+((8-d.getUTCDay())%7||7));return d.toISOString().slice(0,10);};
async function user(client,[nombre,correo,telefono,fecha_nacimiento,genero],role){
 const found=await client.query('SELECT id FROM usuarios WHERE correo=$1',[correo]);
 if(found.rowCount)return found.rows[0].id;
 const password=await bcrypt.hash('Demo-only-2026!',12);
 const {rows}=await client.query("INSERT INTO usuarios(empresa_id,nombre,correo,contrasena,telefono,fecha_nacimiento,genero,estado,creado_en) VALUES($1,$2,$3,$4,$5,$6,$7,'1',now()) RETURNING id",[companyId,nombre,correo,password,telefono,fecha_nacimiento,genero]);
 const id=rows[0].id;
 await client.query("INSERT INTO usuarios_empresas(usuario_id,empresa_id,tipo_usuario) VALUES($1,$2,'User') ON CONFLICT DO NOTHING",[id,companyId]);
 await client.query("INSERT INTO roles_modelos(rol_id,tipo_modelo,modelo_id) SELECT id,'User',$1 FROM roles WHERE nombre=$2 ON CONFLICT DO NOTHING",[id,role]);
 return id;
}
try {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(551026)');
  const dept=await client.query("SELECT id FROM departamentos_hospitalarios WHERE empresa_id=$1 AND nombre='Odontología Demo' AND eliminado_en IS NULL",[companyId]);
  const departmentId=dept.rowCount?dept.rows[0].id:(await client.query("INSERT INTO departamentos_hospitalarios(empresa_id,nombre,descripcion,estado,creado_en) VALUES($1,'Odontología Demo','Datos de demostración','1',now()) RETURNING id",[companyId])).rows[0].id;
  const doctorIds=[];
  for(const [nombre,correo,especialidad] of doctors){
   const id=await user(client,[nombre,correo,'76520000',null,null],'Doctor');doctorIds.push(id);
   await client.query("INSERT INTO detalles_medicos(departamento_hospitalario_id,usuario_id,especialidad,cargo,biografia,creado_en) SELECT $1,$2,$3,'Odontólogo','Perfil de demostración',now() WHERE NOT EXISTS(SELECT 1 FROM detalles_medicos WHERE usuario_id=$2)",[departmentId,id,especialidad]);
   const schedule=await client.query("SELECT 1 FROM horarios_medicos WHERE usuario_id=$1 AND dia_semana='Monday' AND hora_inicio='09:00'",[id]);
   if(!schedule.rowCount)await client.query("INSERT INTO horarios_medicos(usuario_id,dia_semana,hora_inicio,hora_fin,duracion_media_cita,tipo_turno,estado,creado_en) VALUES($1,'Monday','09:00','12:00',30,'Timestamp','1',now())",[id]);
  }
  const date=monday();let turn=1;
  for(const [index,patient] of patients.entries()){
   const patientId=await user(client,patient,'Patient');const doctorId=doctorIds[index%doctorIds.length];
   await client.query('INSERT INTO pacientes_odontologos(empresa_id,paciente_id,odontologo_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[companyId,patientId,doctorId]);
   const hour=9+Math.floor(index/2);const start=`${String(hour).padStart(2,'0')}:00`,end=`${String(hour+1).padStart(2,'0')}:00`;
   const appointment=await client.query('SELECT id FROM citas_pacientes WHERE usuario_id=$1 AND medico_id=$2 AND fecha_cita=$3',[patientId,doctorId,date]);
   if(!appointment.rowCount)await client.query('INSERT INTO citas_pacientes(usuario_id,medico_id,numero_turno,hora_inicio,hora_fin,fecha_cita,motivo_consulta,empresa_id,creado_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())',[patientId,doctorId,turn,start,end,date,'Consulta odontológica de demostración',companyId]);
   const request=await client.query("SELECT id FROM solicitudes_radiografias WHERE paciente_id=$1 AND odontologo_id=$2 AND tipo='Radiografía panorámica demo'",[patientId,doctorId]);
   if(!request.rowCount){const {rows}=await client.query("INSERT INTO solicitudes_radiografias(empresa_id,paciente_id,odontologo_id,tipo,indicaciones) VALUES($1,$2,$3,'Radiografía panorámica demo','Evaluación inicial de demostración') RETURNING id",[companyId,patientId,doctorId]);await client.query("INSERT INTO eventos_radiografias(empresa_id,solicitud_id,paciente_id,usuario_id,actor,evento) VALUES($1,$2,$3,$4,'Datos de demostración','Solicitud de radiografía creada por datos demo')",[companyId,rows[0].id,patientId,doctorId]);}
   turn++;
  }
  await client.query('COMMIT');
  console.log(`Datos demo disponibles: ${patients.length} pacientes, ${doctors.length} odontólogos, citas y solicitudes de radiografía.`);
 } catch(error){await client.query('ROLLBACK');throw error;} finally {client.release();}
} catch(error){console.error(`No se cargaron los datos demo: ${error.code||error.message}`);process.exitCode=1;} finally {await pool.end();}
