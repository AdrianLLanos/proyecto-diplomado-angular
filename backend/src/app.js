import {registerRadiography,registerExternalRadiography} from './radiography.js';
import express from 'express';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import {root,config} from './config.js';
import {authenticate,login,can,requirePermission} from './auth.js';
import {registerPublic} from './public.js';
import {registerFiles,registerPublicFiles} from './files.js';
import {registerAdministration} from './administration.js';
import {registerCampaigns} from './campaign-routes.js';
import {registerReports} from './reports.js';
import {slotsFor} from './clinical.js';
import {catalog} from './schema.js';
import * as repo from './repository.js';
import {pool} from './db.js';
import {fail} from './validation.js';
export function createApp(){
  const app=express();app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:{directives:{'script-src':["'self'"],'style-src':["'self'","'unsafe-inline'"],'img-src':["'self'",'data:'],'font-src':["'self'",'data:'],'connect-src':["'self'"],upgradeInsecureRequests:config.production?[]:null}}}));
  app.use(express.json({limit:'2mb'}));
  app.use('/api',(req,res,next)=>{
    const origin=req.headers.origin;
    if(origin){let allowed=false;try{const u=new URL(origin);allowed=u.host===req.get('host')||config.allowedOrigins.includes(u.origin)||(!config.production&&['http://127.0.0.1:4200','http://localhost:4200'].includes(origin));}catch{}if(!allowed)return res.status(403).json({message:'Origen no permitido'});res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    res.setHeader('Cache-Control','no-store');next();
  });
  app.get('/api/health',(req,res)=>res.json({ok:true}));
  app.post('/api/login',rateLimit({windowMs:60000,limit:10,standardHeaders:true,legacyHeaders:false,message:{message:"Demasiados intentos. Espera un minuto y vuelve a intentar."}}),login);
  registerPublic(app);
  registerExternalRadiography(app);
  registerPublicFiles(app);
  app.use('/api',authenticate);
  registerAdministration(app);
  registerRadiography(app);
  registerCampaigns(app);
  registerReports(app);
  registerFiles(app);
  app.get('/api/session',(req,res)=>res.json({user:req.user,localAccess:!!req.localAccess,companyId:req.companyId}));
  app.get('/api/catalog',async(req,res)=>res.json((await catalog()).filter(m=>can(req.user,m.key,'read')).map(m=>({...m,actions:['read','create','update','delete'].filter(a=>can(req.user,m.key,a))}))));
  app.get('/api/dashboard',async(req,res)=>{const d=await repo.dashboard(req.companyId);d.metrics=d.metrics.filter(m=>can(req.user,m.key,'read'));res.json(d);});
  app.get('/api/slots',requirePermission('citas','read'),async(req,res)=>res.json(await slotsFor(pool,req.query.medico,req.query.fecha,req.companyId,req.query.exclude||0)));
  app.use('/api/lookups/:key',(req,res,next)=>requirePermission(req.params.key,'read')(req,res,next));
  app.get('/api/lookups/:key',async(req,res)=>{
    const data=await repo.list(req.params.key,req.companyId,{size:100,search:req.query.search||''});
    res.json({rows:data.rows.map(r=>({id:r.id,label:r.nombre||r.nombre_campana||r.titulo||r.dominio||r.correo||`Registro ${r.id}`})),total:data.total});
  });
  app.use('/api/records/:key',(req,res,next)=>requirePermission(req.params.key,({GET:'read',POST:'create',PUT:'update',DELETE:'delete'})[req.method]||'read')(req,res,next));
  app.get('/api/records/:key',async(req,res)=>res.json(await repo.list(req.params.key,req.companyId,req.query)));
  app.get('/api/records/:key/:id',async(req,res)=>res.json(await repo.get(req.params.key,req.params.id,req.companyId)));
  app.post('/api/records/:key',async(req,res)=>res.status(201).json(await repo.save(req.params.key,null,req.body,req.companyId)));
  app.put('/api/records/:key/:id',async(req,res)=>res.json(await repo.save(req.params.key,req.params.id,req.body,req.companyId)));
  app.delete('/api/records/:key/:id',async(req,res)=>{
    if(['usuarios','medicos','pacientes'].includes(req.params.key)&&String(req.params.id)===String(req.user.id))fail('No puedes eliminar tu propia cuenta');
    res.json(await repo.remove(req.params.key,req.params.id,req.companyId));
  });
  app.use('/api',(req,res)=>res.status(404).json({message:'Ruta no encontrada'}));
  const dist=path.resolve(root,'../frontend/dist/clinica/browser');
  if(fs.existsSync(dist)){
    app.use(express.static(dist,{index:false,maxAge:'1h'}));
    app.get('/{*path}',(req,res)=>res.sendFile('index.html',{root:dist}));
  }
  app.use((error,req,res,next)=>{
    const messages={23505:'Ya existe un registro con esos datos.',23503:'El registro está relacionado con otros datos.',23502:'Falta un campo obligatorio.','22P02':'El formato de uno de los campos no es válido.',23514:'Un valor no cumple las opciones permitidas.'};
    const status=error.code==='LIMIT_FILE_SIZE'?413:error.status||(messages[error.code]?422:500);
    if(status>=500)console.error('Error de API:',error.code||error.name); // Never log connection strings or patient data.
    res.status(status).json({message:messages[error.code]||(status<500?error.message:'No se pudo completar la consulta. Comprueba la conexión de la API con Supabase.')});
  });return app;
}
