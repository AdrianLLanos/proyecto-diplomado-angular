import crypto from 'node:crypto';
import multer from 'multer';
import QRCode from 'qrcode';
import {rateLimit} from 'express-rate-limit';
import {pool,transaction} from './db.js';
import {config} from './config.js';
import {requireAdmin,requirePermission} from './auth.js';
import {fail,validId} from './validation.js';
import {get} from './repository.js';
import {detectType} from './files.js';
import {dateOnly} from './clinical.js';

const admin=req=>req.user.bypass||req.user.roles.includes('Super Admin');
const hash=token=>crypto.createHash('sha256').update(token).digest('hex');
function tokenHash(token){if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))fail('Enlace inválido o no disponible',410);return hash(token);}
function text(value,name,max){if(typeof value!=='string'||!value.trim()||value.length>max)fail(`${name}: completa un valor de hasta ${max} caracteres`);return value.trim();}
async function audit(client,s,user,event){await client.query('INSERT INTO eventos_radiografias(empresa_id,solicitud_id,paciente_id,usuario_id,actor,evento) VALUES($1,$2,$3,$4,$5,$6)',[s.empresa_id,s.id||null,s.paciente_id,user?.id||null,user?'Usuario interno':'CERPAX (enlace temporal)',event]);}
async function authorized(req,id,client=pool,lock=false){
 const {rows}=await client.query(`SELECT s.* FROM solicitudes_radiografias s WHERE s.id=$1 AND s.empresa_id=$2 AND ($3::boolean OR EXISTS(SELECT 1 FROM pacientes_odontologos po WHERE po.empresa_id=s.empresa_id AND po.paciente_id=s.paciente_id AND po.odontologo_id=$4)) ${lock?'FOR UPDATE':''}`,[validId(id),req.companyId,!!admin(req),req.user.id]);
 if(!rows[0])fail('Solicitud no encontrada o no autorizada',404);return rows[0];
}
async function access(client,token,lock=false){
 const {rows}=await client.query(`SELECT a.id AS acceso_id,s.*,a.vence_en FROM accesos_radiografias a JOIN solicitudes_radiografias s ON s.id=a.solicitud_id WHERE a.token_hash=$1 AND a.vence_en>now() AND a.revocado_en IS NULL AND a.usado_en IS NULL AND s.estado='Pendiente' ${lock?'FOR UPDATE OF s,a':''}`,[tokenHash(token)]);
 if(!rows[0])fail('El enlace venció, fue revocado o ya fue utilizado',410);return rows[0];
}
export function registerExternalRadiography(app){
 const limit=rateLimit({windowMs:60000,limit:30,message:{message:'Demasiados intentos. Espera un minuto.'}});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10485760,files:1,fields:1,fieldSize:256}});
 app.post('/api/external/radiographs/access',limit,async(req,res)=>{
  const s=await access(pool,req.body?.token);
  res.json({id:s.id,tipo:s.tipo,vence_en:s.vence_en}); // No se exponen datos del paciente.
 });
 app.post('/api/external/radiographs/upload',limit,upload.single('file'),async(req,res)=>{
  if(!req.file?.size)fail('Selecciona un archivo PDF, PNG, JPEG o WebP');
  const type=detectType(req.file.buffer);if(!type)fail('Formato no permitido: utiliza PDF, PNG, JPEG o WebP');
  const extensions={'application/pdf':/\.pdf$/i,'image/png':/\.png$/i,'image/jpeg':/\.jpe?g$/i,'image/webp':/\.webp$/i};
  if(!extensions[type].test(req.file.originalname))fail('La extensión no coincide con el contenido del archivo');
  await transaction(async client=>{
   const s=await access(client,req.body.token,true);
   await client.query('INSERT INTO radiografias(solicitud_id,nombre,tipo,tamano,contenido,sha256) VALUES($1,$2,$3,$4,$5,$6)',[s.id,req.file.originalname.replace(/[\\/\r\n]/g,'_').slice(0,255),type,req.file.size,req.file.buffer,hash(req.file.buffer)]);
   await client.query("UPDATE solicitudes_radiografias SET estado='Completada',completado_en=now() WHERE id=$1",[s.id]);
   await client.query('UPDATE accesos_radiografias SET usado_en=now() WHERE id=$1',[s.acceso_id]);
   await audit(client,s,null,'Radiografía cargada');
   await client.query('SAVEPOINT notificacion');
   try {await client.query('INSERT INTO notificaciones_radiografias(solicitud_id,usuario_id) VALUES($1,$2)',[s.id,s.odontologo_id]);await client.query('RELEASE SAVEPOINT notificacion');}
   catch {await client.query('ROLLBACK TO SAVEPOINT notificacion');await audit(client,s,null,'Falló la notificación; archivo conservado');}
  });
  res.status(201).json({ok:true,message:'Radiografía recibida. La solicitud quedó completada.'});
 });
}
export function registerRadiography(app){
 const read=requirePermission('radiografias','read'),create=requirePermission('radiografias','create'),update=requirePermission('radiografias','update');
 app.get('/api/radiographs',read,async(req,res)=>{
  const patient=req.query.paciente?validId(req.query.paciente):null;
  const state=req.query.estado||null;if(state&&!['Pendiente','Completada','Cancelada'].includes(state))fail('Estado inválido');
  const page=Math.max(0,parseInt(req.query.page)||0);
  const {rows}=await pool.query(`SELECT s.*,p.nombre AS paciente,o.nombre AS odontologo,r.id AS archivo_id,r.nombre AS archivo_nombre,count(*) OVER()::int AS total FROM solicitudes_radiografias s JOIN usuarios p ON p.id=s.paciente_id JOIN usuarios o ON o.id=s.odontologo_id LEFT JOIN radiografias r ON r.solicitud_id=s.id WHERE s.empresa_id=$1 AND ($2::bigint IS NULL OR s.paciente_id=$2) AND ($3::text IS NULL OR s.estado=$3) AND ($4::boolean OR EXISTS(SELECT 1 FROM pacientes_odontologos po WHERE po.empresa_id=s.empresa_id AND po.paciente_id=s.paciente_id AND po.odontologo_id=$5)) ORDER BY s.id DESC LIMIT 25 OFFSET $6`,[req.companyId,patient,state,!!admin(req),req.user.id,page*25]);
  res.json({rows,total:rows[0]?.total||0});
 });
 app.post('/api/radiographs',create,async(req,res)=>{
  const patient=validId(req.body.paciente_id),type=text(req.body.tipo,'Tipo de estudio',150),notes=req.body.indicaciones||'';
  if(typeof notes!=='string'||notes.length>2000)fail('Las indicaciones no pueden superar 2000 caracteres');
  const doctor=admin(req)?validId(req.body.odontologo_id):req.user.id;
  const row=await transaction(async client=>{
   await get('pacientes',patient,req.companyId,client);
   await get('medicos',doctor,req.companyId,client);
   const assigned=await client.query('SELECT 1 FROM pacientes_odontologos WHERE empresa_id=$1 AND paciente_id=$2 AND odontologo_id=$3',[req.companyId,patient,doctor]);
   if(!assigned.rowCount)fail('Asigna primero el paciente a este odontólogo',403);
   const {rows}=await client.query('INSERT INTO solicitudes_radiografias(empresa_id,paciente_id,odontologo_id,tipo,indicaciones) VALUES($1,$2,$3,$4,$5) RETURNING *',[req.companyId,patient,doctor,type,notes]);
   await audit(client,rows[0],req.user,'Solicitud creada');return rows[0];
  });res.status(201).json(row);
 });
 app.post('/api/radiographs/:id/access',update,async(req,res)=>{
  const hours=Number(req.body.horas??24);if(!Number.isInteger(hours)||hours<1||hours>72)fail('La vigencia debe ser de 1 a 72 horas');
  const token=crypto.randomBytes(32).toString('hex');
  const link=new URL('/carga-radiografia',config.appUrl);link.hash=token;
  const qr=await QRCode.toDataURL(link.href,{width:280,margin:2});
  const expires=await transaction(async client=>{
   const s=await authorized(req,req.params.id,client,true);if(s.estado!=='Pendiente')fail('Solo se genera acceso para solicitudes pendientes',409);
   await client.query('UPDATE accesos_radiografias SET revocado_en=now() WHERE solicitud_id=$1 AND revocado_en IS NULL AND usado_en IS NULL',[s.id]);
   const {rows}=await client.query("INSERT INTO accesos_radiografias(solicitud_id,token_hash,vence_en) VALUES($1,$2,now()+($3::int * interval '1 hour')) RETURNING vence_en",[s.id,hash(token),hours]);
   await audit(client,s,req.user,'Acceso temporal generado; accesos anteriores revocados');return rows[0].vence_en;
  });res.status(201).json({url:link.href,qr,vence_en:expires});
 });
 app.post('/api/radiographs/:id/revoke',update,async(req,res)=>{
  await transaction(async client=>{const s=await authorized(req,req.params.id,client,true);await client.query('UPDATE accesos_radiografias SET revocado_en=now() WHERE solicitud_id=$1 AND usado_en IS NULL AND revocado_en IS NULL',[s.id]);await audit(client,s,req.user,'Accesos revocados');});res.json({ok:true});
 });
 app.post('/api/radiographs/:id/cancel',update,async(req,res)=>{
  await transaction(async client=>{const s=await authorized(req,req.params.id,client,true);if(s.estado!=='Pendiente')fail('Solo se cancelan solicitudes pendientes',409);await client.query("UPDATE solicitudes_radiografias SET estado='Cancelada' WHERE id=$1",[s.id]);await client.query('UPDATE accesos_radiografias SET revocado_en=now() WHERE solicitud_id=$1 AND usado_en IS NULL',[s.id]);await audit(client,s,req.user,'Solicitud cancelada');});res.json({ok:true});
 });
 app.get('/api/radiographs/:id/file',read,async(req,res)=>{
  const file=await transaction(async client=>{const s=await authorized(req,req.params.id,client,true);const {rows}=await client.query('SELECT * FROM radiografias WHERE solicitud_id=$1',[s.id]);if(!rows[0])fail('La solicitud todavía no tiene archivo',404);await audit(client,s,req.user,req.query.download==='1'?'Archivo descargado':'Archivo consultado');return rows[0];});
  res.type(file.tipo).set('Content-Disposition',`${req.query.download==='1'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.nombre)}`).set('Cache-Control','no-store').send(Buffer.from(file.contenido));
 });
 app.get('/api/radiography-audit',requirePermission('radiografias','audit'),async(req,res)=>{
  const patient=req.query.paciente?validId(req.query.paciente):null;
  const from=req.query.desde?dateOnly(req.query.desde):'1900-01-01',to=req.query.hasta?dateOnly(req.query.hasta):'2999-12-31';if(from>to)fail('El inicio no puede ser posterior al final');
  const page=Math.max(0,parseInt(req.query.page)||0);
  const {rows}=await pool.query("SELECT e.*,u.nombre AS usuario,p.nombre AS paciente FROM eventos_radiografias e LEFT JOIN usuarios u ON u.id=e.usuario_id JOIN usuarios p ON p.id=e.paciente_id WHERE e.empresa_id=$1 AND ($2::bigint IS NULL OR e.paciente_id=$2) AND e.creado_en >= $3::date AND e.creado_en < $4::date + interval '1 day' ORDER BY e.id DESC LIMIT 50 OFFSET $5",[req.companyId,patient,from,to,page*50]);res.json(rows);
 });
 app.get('/api/radiography-notifications',read,async(req,res)=>{
  const {rows}=await pool.query('SELECT n.*,s.tipo,p.nombre AS paciente FROM notificaciones_radiografias n JOIN solicitudes_radiografias s ON s.id=n.solicitud_id JOIN usuarios p ON p.id=s.paciente_id WHERE n.usuario_id=$1 AND s.empresa_id=$2 AND ($3::boolean OR EXISTS(SELECT 1 FROM pacientes_odontologos po WHERE po.empresa_id=s.empresa_id AND po.paciente_id=s.paciente_id AND po.odontologo_id=$1)) ORDER BY n.id DESC LIMIT 50',[req.user.id,req.companyId,!!admin(req)]);res.json(rows);
 });
 app.post('/api/radiography-notifications/:id/read',read,async(req,res)=>{const result=await pool.query('UPDATE notificaciones_radiografias n SET leido_en=now() FROM solicitudes_radiografias s WHERE n.id=$1 AND n.usuario_id=$2 AND s.id=n.solicitud_id AND s.empresa_id=$3 RETURNING n.id',[validId(req.params.id),req.user.id,req.companyId]);if(!result.rowCount)fail('Notificación no encontrada',404);res.json({ok:true});});
 app.get('/api/patient-assignments',requireAdmin,async(req,res)=>{const {rows}=await pool.query('SELECT a.*,p.nombre AS paciente,o.nombre AS odontologo FROM pacientes_odontologos a JOIN usuarios p ON p.id=a.paciente_id JOIN usuarios o ON o.id=a.odontologo_id WHERE a.empresa_id=$1 ORDER BY p.nombre LIMIT 500',[req.companyId]);res.json(rows);});
 app.post('/api/patient-assignments',requireAdmin,async(req,res)=>{
  const patient=validId(req.body.paciente_id),doctor=validId(req.body.odontologo_id);
  await transaction(async client=>{await get('pacientes',patient,req.companyId,client);await get('medicos',doctor,req.companyId,client);await client.query('INSERT INTO pacientes_odontologos(empresa_id,paciente_id,odontologo_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[req.companyId,patient,doctor]);await audit(client,{empresa_id:req.companyId,paciente_id:patient},req.user,`Paciente asignado al odontólogo #${doctor}`);});res.status(201).json({ok:true});
 });
 app.delete('/api/patient-assignments/:patient/:doctor',requireAdmin,async(req,res)=>{await transaction(async client=>{const patient=validId(req.params.patient),doctor=validId(req.params.doctor);await get('pacientes',patient,req.companyId,client);await client.query('DELETE FROM pacientes_odontologos WHERE empresa_id=$1 AND paciente_id=$2 AND odontologo_id=$3',[req.companyId,patient,doctor]);await audit(client,{empresa_id:req.companyId,paciente_id:patient},req.user,`Asignación revocada al odontólogo #${doctor}`);});res.json({ok:true});});
}
