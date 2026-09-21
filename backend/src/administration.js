import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {pool,transaction} from './db.js';
import {requireAdmin,requirePermission,userById,can} from './auth.js';
import {validId,fail} from './validation.js';
import {update,insert,get} from './repository.js';
import {modules} from './catalog.js';

export function registerAdministration(app){
 app.get('/api/profile',async(req,res)=>{
  const {rows}=await pool.query('SELECT id,nombre,correo,telefono,direccion,foto,fecha_nacimiento,genero FROM usuarios WHERE id=$1',[req.user.id]);res.json(rows[0]);
 });
 app.put('/api/profile',async(req,res)=>{
  const {nombre,correo,telefono,direccion,foto}=req.body||{};
  if(!String(nombre||'').trim()||!/^\S+@\S+\.\S+$/.test(correo||''))fail('Escribe tu nombre y un correo válido');
  await update(pool,'usuarios',req.user.id,{nombre,correo:String(correo).toLowerCase(),telefono:telefono||null,direccion:direccion||null,foto:foto||null,actualizado_en:new Date().toISOString()});res.json({ok:true});
 });
 app.post('/api/profile/password',async(req,res)=>{
  const {actual,nueva}=req.body||{};if(typeof nueva!=='string'||nueva.length<12)fail('Usa una contraseña de al menos 12 caracteres');
  const {rows}=await pool.query('SELECT contrasena FROM usuarios WHERE id=$1',[req.user.id]);
  if(!req.localAccess&&!await bcrypt.compare(String(actual||''),rows[0].contrasena.replace(/^\$2y\$/,'$2b$')))fail('La contraseña actual es incorrecta');
  await pool.query('UPDATE usuarios SET contrasena=$1,version_sesion=version_sesion+1 WHERE id=$2',[await bcrypt.hash(nueva,12),req.user.id]);res.json({ok:true});
 });
 app.post('/api/logout',async(req,res)=>{await pool.query('UPDATE usuarios SET version_sesion=version_sesion+1 WHERE id=$1',[req.user.id]);res.json({ok:true});});
 app.get('/api/companies',async(req,res)=>{
  const {rows}=await pool.query("SELECT e.id,e.dominio,COALESCE(s.valor,e.dominio) AS nombre FROM empresas e JOIN usuarios_empresas ue ON ue.empresa_id=e.id LEFT JOIN configuraciones s ON s.empresa_id=e.id AND s.clave='general.company_name' WHERE ue.usuario_id=$1 AND e.eliminado_en IS NULL AND e.habilitado=true ORDER BY e.id",[req.user.id]);res.json(rows);
 });
 app.get('/api/settings',requirePermission('ajustes','read'),async(req,res)=>{const {rows}=await pool.query('SELECT clave,valor FROM configuraciones WHERE empresa_id=$1 ORDER BY clave',[req.companyId]);res.json(Object.fromEntries(rows.map(r=>[r.clave,r.valor])));});
 app.put('/api/settings',requirePermission('ajustes','update'),async(req,res)=>{
  const keys=['company_name','company_email','company_address','company_phone','company_tax_number','company_logo','default_locale','timezone','date_format','financial_start','default_currency','default_payment_method'];
  await transaction(async client=>{for(const [key,value]of Object.entries(req.body||{})){if(!keys.some(k=>key==='general.'+k)&&!['invoice.prefix','invoice.footer','invoice.due_date','default.currency','default.payment_method'].includes(key))fail('Ajuste no permitido');if(String(value).length>5000)fail('Valor demasiado largo');await client.query('INSERT INTO configuraciones(empresa_id,clave,valor) VALUES($1,$2,$3) ON CONFLICT(empresa_id,clave) DO UPDATE SET valor=EXCLUDED.valor',[req.companyId,key,String(value)]);}});res.json({ok:true});
 });
 app.get('/api/roles',requireAdmin,async(req,res)=>{
  const [roles,permissions]=await Promise.all([pool.query('SELECT r.*,ARRAY(SELECT permiso_id::text FROM permisos_roles WHERE rol_id=r.id) AS permisos FROM roles r ORDER BY r.id'),pool.query('SELECT * FROM permisos ORDER BY nombre')]);res.json({roles:roles.rows,permissions:permissions.rows});
 });
 app.post('/api/roles',requireAdmin,async(req,res)=>{
  if(!String(req.body.nombre||'').trim())fail('El nombre del rol es obligatorio');
  const row=await insert(pool,'roles',{nombre:req.body.nombre,nombre_guardia:'web'});res.status(201).json({id:row.id});
 });
 app.put('/api/roles/:id',requireAdmin,async(req,res)=>{
  const id=validId(req.params.id);await transaction(async client=>{
   const role=(await client.query('SELECT * FROM roles WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!role)fail('Rol no encontrado',404);
   if(role.nombre==='Super Admin')fail('El rol de administrador conserva todos los permisos');
   if(role.es_predeterminado!=='1'&&req.body.nombre)await update(client,'roles',id,{nombre:req.body.nombre});
   if(!Array.isArray(req.body.permisos))fail('Lista de permisos inválida');const ids=[...new Set(req.body.permisos.map(validId))];
   await client.query('DELETE FROM permisos_roles WHERE rol_id=$1',[id]);for(const permission of ids)await client.query('INSERT INTO permisos_roles(rol_id,permiso_id) VALUES($1,$2)',[id,permission]);
  });res.json({ok:true});
 });
 app.delete('/api/roles/:id',requireAdmin,async(req,res)=>{
  const id=validId(req.params.id);const role=(await pool.query('SELECT * FROM roles WHERE id=$1',[id])).rows[0];if(!role)fail('Rol no encontrado',404);if(role.es_predeterminado==='1')fail('No puedes eliminar un rol del sistema');
  if((await pool.query('SELECT 1 FROM roles_modelos WHERE rol_id=$1 LIMIT 1',[id])).rowCount)fail('Este rol está asignado a usuarios');await pool.query('DELETE FROM roles WHERE id=$1',[id]);res.json({ok:true});
 });
 app.get('/api/users/:id/access',requireAdmin,async(req,res)=>{
  await get('usuarios',req.params.id,req.companyId);const user=await userById(req.params.id);res.json(user);
 });
 app.put('/api/users/:id/access',requireAdmin,async(req,res)=>{
  await get('usuarios',req.params.id,req.companyId);const id=validId(req.params.id);
  if(!Array.isArray(req.body.roles)||!req.body.roles.length)fail('Selecciona al menos un rol');
  await transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(789456123)');
   const roles=(await client.query('SELECT id,nombre FROM roles WHERE id=ANY($1::bigint[])',[req.body.roles.map(validId)])).rows;
   if(roles.length!==new Set(req.body.roles.map(String)).size)fail('Rol no válido');
   if(!roles.some(r=>r.nombre==='Super Admin')){const admins=await client.query("SELECT u.id FROM usuarios u JOIN roles_modelos rm ON rm.modelo_id=u.id JOIN roles r ON r.id=rm.rol_id WHERE r.nombre='Super Admin' AND u.estado='1' AND u.eliminado_en IS NULL AND u.id<>$1",[id]);if(!admins.rowCount)fail('Debe quedar al menos un administrador activo');}
   await client.query("DELETE FROM roles_modelos WHERE modelo_id=$1 AND tipo_modelo='User'",[id]);for(const r of roles)await client.query("INSERT INTO roles_modelos(rol_id,tipo_modelo,modelo_id) VALUES($1,'User',$2)",[r.id,id]);
  });res.json({ok:true});
 });
 app.get('/api/version',(req,res)=>res.json({version:'2.0.0',runtime:'Node.js',frontend:'Angular + Angular Material'}));
}
