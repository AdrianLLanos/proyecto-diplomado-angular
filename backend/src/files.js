import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {root} from './config.js';
import {pool} from './db.js';
import {fail} from './validation.js';
import {can,authenticate} from './auth.js';
import {get} from './repository.js';
const dir=path.join(root,'uploads');
export function detectType(b){if(b.subarray(0,5).toString()==='%PDF-')return'application/pdf';if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';if(b[0]===255&&b[1]===216&&b[2]===255)return'image/jpeg';if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return'image/webp';return null;}
export function registerFiles(app){
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1}});
 app.post('/api/files',upload.single('file'),async(req,res)=>{
  if(!req.file)fail('Selecciona un archivo');const type=detectType(req.file.buffer);if(!type)fail('Solo se admiten PDF e imágenes PNG, JPEG o WebP');
  const isPublic=req.body.publico==='true';if(isPublic&&!can(req.user,'paginas','update')&&!can(req.user,'aplicacion','update'))fail('No puedes publicar imágenes',403);
  const id=crypto.randomUUID();await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,id),req.file.buffer,{flag:'wx'});
  try{await pool.query('INSERT INTO archivos(id,empresa_id,usuario_id,nombre,tipo,tamano,publico) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,req.companyId,req.user.id,path.basename(req.file.originalname).slice(0,255),type,req.file.size,isPublic]);}catch(e){await fs.unlink(path.join(dir,id));throw e;}
  res.status(201).json({id,url:'/api/files/'+id,nombre:req.file.originalname,tipo:type});
 });
 app.get('/api/files/:id',async(req,res)=>{
  if(!/^[a-f0-9-]{36}$/.test(req.params.id))fail('Archivo no encontrado',404);
  const row=(await pool.query('SELECT * FROM archivos WHERE id=$1 AND empresa_id=$2',[req.params.id,req.companyId])).rows[0];if(!row)fail('Archivo no encontrado',404);
  let allowed=String(row.usuario_id)===String(req.user.id)||req.user.bypass||req.user.roles.includes('Super Admin');
  if(!allowed&&req.query.module&&req.query.record&&can(req.user,String(req.query.module),'read')){const record=await get(String(req.query.module),req.query.record,req.companyId);allowed=JSON.stringify(record).includes(row.id);}
  if(!allowed)fail('No tienes acceso a este archivo',403);res.type(row.tipo);res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.nombre)}`);res.sendFile(path.join(dir,row.id));
 });
}
export function registerPublicFiles(app){app.get('/api/public/files/:id',async(req,res)=>{if(!/^[a-f0-9-]{36}$/.test(req.params.id))fail('Archivo no encontrado',404);const row=(await pool.query('SELECT * FROM archivos WHERE id=$1 AND publico=true',[req.params.id])).rows[0];if(!row||!row.tipo.startsWith('image/'))fail('Imagen no encontrada',404);res.type(row.tipo);res.sendFile(path.join(dir,row.id));});}
