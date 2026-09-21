import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {pool} from './db.js';
import {config} from './config.js';
import {fail} from './validation.js';
import {requestContext} from './context.js';
export async function userById(id){
 const {rows}=await pool.query(`SELECT u.id,u.nombre,u.correo,u.estado,u.version_sesion,u.foto,
 ARRAY(SELECT r.nombre FROM roles_modelos rm JOIN roles r ON r.id=rm.rol_id WHERE rm.modelo_id=u.id AND rm.tipo_modelo='User') AS roles,
 ARRAY(SELECT DISTINCT p.nombre FROM permisos p WHERE p.id IN (SELECT pr.permiso_id FROM permisos_roles pr JOIN roles_modelos rm ON rm.rol_id=pr.rol_id WHERE rm.modelo_id=u.id AND rm.tipo_modelo='User') OR p.id IN (SELECT pm.permiso_id FROM permisos_modelos pm WHERE pm.modelo_id=u.id AND pm.tipo_modelo='User')) AS permissions,
 ARRAY(SELECT empresa_id::text FROM usuarios_empresas WHERE usuario_id=u.id AND tipo_usuario='User') AS companies
 FROM usuarios u WHERE u.id=$1 AND u.eliminado_en IS NULL`,[id]);return rows[0];
}
export const can=(user,key,action)=>!!user&&(user.bypass||user.roles.includes('Super Admin')||user.permissions.includes(`${key}.${action}`));
export function requirePermission(key,action){return(req,res,next)=>{try{if(!can(req.user,key,action))fail('No tienes permiso para realizar esta acción',403);next();}catch(e){next(e);}};}
export function requireAdmin(req,res,next){if(!req.user?.bypass&&!req.user?.roles.includes('Super Admin'))return next(Object.assign(new Error('Esta acción requiere administrador'),{status:403}));next();}
export async function authenticate(req,res,next){
 try{
  const local=config.localAccess&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if(local){
   let id=config.localUserId;
   if(!id){const {rows}=await pool.query("SELECT u.id FROM usuarios u JOIN roles_modelos rm ON rm.modelo_id=u.id JOIN roles r ON r.id=rm.rol_id WHERE r.nombre='Super Admin' AND u.estado='1' AND u.eliminado_en IS NULL LIMIT 1");id=rows[0]?.id;}
   if(!id)fail('Crea primero el administrador con el paso 03 de la instalación.',503);
   req.user=await userById(id);req.localAccess=true;
  }else{
   const token=req.headers.authorization?.replace(/^Bearer /,'');if(!token)fail('Inicia sesión para continuar',401);
   let payload;try{payload=jwt.verify(token,config.jwtSecret,{algorithms:['HS256']});}catch{fail('La sesión expiró. Inicia sesión de nuevo.',401);}
   req.user=await userById(payload.sub);
   if(!req.user||req.user.version_sesion!==payload.version)fail('La sesión ya no es válida',401);
  }
  if(!req.user||req.user.estado!=='1')fail('Usuario inactivo o no encontrado',401);
  req.user.bypass=!!req.localAccess&&!config.enforceRoles;
  req.companyId=String(req.headers['x-company-id']||req.user.companies[0]||config.companyId);
  if(!req.user.companies.includes(req.companyId))fail('No tienes acceso a esta empresa',403);
  requestContext.run({user:req.user,companyId:req.companyId},()=>next());
 }catch(e){next(e);}
}
export async function login(req,res){
 const {correo,contrasena}=req.body||{};if(typeof correo!=='string'||typeof contrasena!=='string')fail('Escribe correo y contraseña',400);
 const {rows}=await pool.query("SELECT id,contrasena FROM usuarios WHERE lower(correo)=lower($1) AND estado='1' AND eliminado_en IS NULL LIMIT 1",[correo]);
 const hash=rows[0]?.contrasena?.replace(/^\$2y\$/,'$2b$');
 if(!hash||!await bcrypt.compare(contrasena,hash))fail('Correo o contraseña incorrectos',401);
 const user=await userById(rows[0].id);
 res.json({token:jwt.sign({version:user.version_sesion},config.jwtSecret,{subject:String(user.id),expiresIn:'8h',algorithm:'HS256'}),user});
}
