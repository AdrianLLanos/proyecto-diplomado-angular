import {pool,transaction} from './db.js';
import {config} from './config.js';
import {fail,validId} from './validation.js';
import {slotsFor,dateOnly} from './clinical.js';
import {insert} from './repository.js';
import {sendEmail} from './messaging.js';
import {rateLimit} from 'express-rate-limit';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
export function registerPublic(app){
 const limiter=rateLimit({windowMs:60000,limit:8,standardHeaders:true,legacyHeaders:false});
 app.get('/api/public/pages/:page',async(req,res)=>{
  if(!['home','about','services','contact'].includes(req.params.page))fail('Página no encontrada',404);
  const {rows}=await pool.query("SELECT pagina,contenido FROM paginas_publicas WHERE pagina=$1 AND estado='1' AND empresa_id=$2",[req.params.page,config.publicCompanyId]);if(!rows[0])fail('Página no disponible',404);
  const content=rows[0].contenido;res.json({pagina:rows[0].pagina,contenido:Object.fromEntries(Object.entries(content||{}).filter(([key])=>!key.startsWith('_')))});
 });
 app.get('/api/public/doctors',async(req,res)=>{
  const {rows}=await pool.query("SELECT u.id,u.nombre,d.especialidad,d.biografia,h.nombre AS departamento FROM usuarios u JOIN detalles_medicos d ON d.usuario_id=u.id JOIN departamentos_hospitalarios h ON h.id=d.departamento_hospitalario_id WHERE u.estado='1' AND u.eliminado_en IS NULL AND u.empresa_id=$1 ORDER BY u.nombre",[config.publicCompanyId]);res.json(rows);
 });
 app.get('/api/public/slots',async(req,res)=>{res.json(await slotsFor(pool,validId(req.query.medico),req.query.fecha,config.publicCompanyId));});
 app.post('/api/public/contact',limiter,async(req,res)=>{
  const {nombre,correo,mensaje}=req.body||{};if(!nombre||String(nombre).length>255||!/^\S+@\S+\.\S+$/.test(correo||'')||!mensaje||String(mensaje).length>5000)fail('Completa nombre, correo y mensaje');
  await insert(pool,'mensajes_contacto',{nombre,correo,mensaje,empresa_id:config.publicCompanyId,creado_en:new Date().toISOString()});res.status(201).json({ok:true});
 });
 app.post('/api/public/book',limiter,async(req,res)=>{
  const b=req.body||{};if(!b.nombre||String(b.nombre).length>255||!/^\S+@\S+\.\S+$/.test(b.correo||'')||!/^\+?[\d ()-]{7,25}$/.test(b.telefono||''))fail('Completa nombre, correo y teléfono válidos');
  validId(b.medico_id);const date=dateOnly(b.fecha_cita);if(date<new Date().toISOString().slice(0,10))fail('La fecha no puede estar en el pasado');
  await transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[b.medico_id]);
   const doctor=await client.query("SELECT d.id FROM detalles_medicos d JOIN usuarios u ON u.id=d.usuario_id WHERE u.id=$1 AND u.empresa_id=$2 AND u.estado='1' AND u.eliminado_en IS NULL",[b.medico_id,config.publicCompanyId]);if(!doctor.rowCount)fail('Médico no disponible');
   const slots=await slotsFor(client,b.medico_id,date,config.publicCompanyId);const slot=slots.find(s=>s.inicio===b.hora_inicio);if(!slot)fail('Ese horario ya no está disponible. Elige otro.',409);
   let user=(await client.query('SELECT id FROM usuarios WHERE lower(correo)=lower($1) AND empresa_id=$2 AND eliminado_en IS NULL',[b.correo,config.publicCompanyId])).rows[0];
   if(user){const patient=await client.query("SELECT 1 FROM roles_modelos rm JOIN roles r ON r.id=rm.rol_id WHERE rm.modelo_id=$1 AND r.nombre='Patient'",[user.id]);if(!patient.rowCount)fail('Contacta con la clínica para reservar con ese correo.');}
   else{user=await insert(client,'usuarios',{nombre:b.nombre,correo:String(b.correo).toLowerCase(),telefono:b.telefono,empresa_id:config.publicCompanyId,estado:'1',contrasena:await bcrypt.hash(crypto.randomBytes(32).toString('hex'),12)});await client.query("INSERT INTO roles_modelos(rol_id,tipo_modelo,modelo_id) SELECT id,'User',$1 FROM roles WHERE nombre='Patient'",[user.id]);await client.query("INSERT INTO usuarios_empresas(usuario_id,empresa_id,tipo_usuario) VALUES($1,$2,'User')",[user.id,config.publicCompanyId]);}
   const n=(await client.query('SELECT COALESCE(max(numero_turno),0)+1 AS n FROM citas_pacientes WHERE medico_id=$1 AND fecha_cita=$2',[b.medico_id,date])).rows[0].n;
   await insert(client,'citas_pacientes',{usuario_id:user.id,empresa_id:config.publicCompanyId,medico_id:b.medico_id,fecha_cita:date,hora_inicio:slot.inicio,hora_fin:slot.fin,numero_turno:n,motivo_consulta:String(b.motivo_consulta||'').slice(0,2000),creado_en:new Date().toISOString()});
  });res.status(201).json({ok:true,message:'Tu cita quedó registrada. La clínica podrá contactarte para coordinar la atención.'});
 });
 app.post('/api/forgot-password',limiter,async(req,res)=>{
  const correo=String(req.body?.correo||'').toLowerCase();if(!/^\S+@\S+\.\S+$/.test(correo))fail('Correo no válido');
  const user=(await pool.query("SELECT id FROM usuarios WHERE correo=$1 AND estado='1' AND eliminado_en IS NULL",[correo])).rows[0];
  if(user&&process.env.MESSAGING_ENABLED==='true'){
   const settings=(await pool.query("SELECT * FROM configuraciones_smtp WHERE empresa_id=$1 AND estado='1' ORDER BY id DESC LIMIT 1",[config.publicCompanyId])).rows[0];
   if(settings){const token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHash('sha256').update(token).digest('hex');await pool.query('INSERT INTO restablecimientos_contrasena(correo,token,creado_en) VALUES($1,$2,now()) ON CONFLICT(correo) DO UPDATE SET token=EXCLUDED.token,creado_en=now()',[correo,hash]);try{await sendEmail(settings,correo,'Restablecer contraseña',`${config.appUrl}/restablecer?correo=${encodeURIComponent(correo)}&token=${token}`);}catch{console.error('No se pudo enviar el correo de recuperación');}}
  }res.json({message:'Si el correo está registrado, recibirás un enlace de recuperación cuando el servicio de correo esté configurado.'});
 });
 app.post('/api/reset-password',limiter,async(req,res)=>{
  const {correo,token,nueva}=req.body||{};if(typeof token!=='string'||typeof nueva!=='string'||nueva.length<12)fail('Enlace o contraseña inválidos');
  const hash=crypto.createHash('sha256').update(token).digest('hex');await transaction(async client=>{const result=await client.query("DELETE FROM restablecimientos_contrasena WHERE correo=$1 AND token=$2 AND creado_en>now()-interval '1 hour' RETURNING correo",[correo,hash]);if(!result.rowCount)fail('El enlace expiró o ya fue utilizado');await client.query('UPDATE usuarios SET contrasena=$1,version_sesion=version_sesion+1 WHERE correo=$2',[await bcrypt.hash(nueva,12),correo]);});res.json({ok:true});
 });
}
