import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import {fixture} from './fixture.js';

test('seguridad: contrato v1, cuentas, sesiones y pacientes',async t=>{
 const f=await fixture();
 const {createApp}=await import('../src/app.js');const app=createApp();
 const results=[];
 const check=(id,scenario,expected,response)=>{
  results.push({id,scenario,expected,obtained:response.status,method:response.req.method,path:response.req.path,status:response.status===expected?'Aprobado':'Fallido'});
  assert.equal(response.status,expected,JSON.stringify(response.body));return response;
 };
 try{
  let admin,doctor,patient,doctorId;
  await t.test('RF-01: credenciales válidas e incorrectas',async()=>{
   const r=check('SEG-01','Inicio de sesión válido',200,await request(app).post('/api/v1/login').send({correo:'admin@example.test',contrasena:'Testing-only-123!'}));admin=r.body.token;
   check('SEG-02','Contraseña incorrecta',401,await request(app).post('/api/v1/login').send({correo:'admin@example.test',contrasena:'incorrecta'}));
   check('SEG-03','Credenciales omitidas',400,await request(app).post('/api/v1/login').send({}));
  });
  const auth=(method,path,token=admin)=>request(app)[method](path).set('Authorization','Bearer '+token);
  await t.test('RF-02: CRUD y validación de paciente',async()=>{
   patient=check('SEG-04','Crear paciente',201,await auth('post','/api/v1/pacientes').send({nombre:'Paciente sintético seguridad',correo:'security-patient@example.test',contrasena:'Testing-only-123!',estado:'1'})).body.id;
   check('SEG-05','Consultar paciente creado',200,await auth('get','/api/v1/pacientes/'+patient));
   check('SEG-06','Actualizar paciente',200,await auth('put','/api/v1/pacientes/'+patient).send({telefono:'+59170000000'}));
   check('SEG-07','Paciente sin nombre ni correo',422,await auth('post','/api/v1/pacientes').send({}));
   check('SEG-08','Ruta genérica ausente del contrato v1',404,await auth('get','/api/v1/records/pacientes'));
  });
  await t.test('odontólogo: acceso denegado a administración y paciente ajeno',async()=>{
   doctorId=(await auth('post','/api/v1/odontologos').send({nombre:'Doctor seguridad',correo:'security-doctor@example.test',contrasena:'Testing-only-123!',estado:'1'})).body.id;
   const r=await request(app).post('/api/v1/login').send({correo:'security-doctor@example.test',contrasena:'Testing-only-123!'});assert.equal(r.status,200);doctor=r.body.token;
   check('SEG-09','Odontólogo consulta cuentas',403,await auth('get','/api/v1/cuentas',doctor));
   check('SEG-10','Odontólogo consulta roles',403,await auth('get','/api/v1/roles',doctor));
   check('SEG-11','Odontólogo consulta paciente no asignado',404,await auth('get','/api/v1/pacientes/'+patient,doctor));
   check('SEG-12','Petición sin JWT',401,await request(app).get('/api/v1/pacientes'));
   check('SEG-13','JWT alterado',401,await auth('get','/api/v1/session','invalid.jwt.value'));
   check('SEG-14','Clínica no autorizada',403,await auth('get','/api/v1/pacientes',doctor).set('X-Company-ID','999'));
   await f.query("INSERT INTO permisos_modelos(permiso_id,tipo_modelo,modelo_id) SELECT id,'User',$1 FROM permisos WHERE nombre='usuarios.read'",[doctorId]);
   check('SEG-15','Permiso directo no habilita administrar cuentas',403,await auth('get','/api/records/usuarios',doctor));
  });
  await t.test('paciente sin acceso incluso con contraseña o JWT anterior',async()=>{
   const r=check('SEG-16','Paciente con contraseña válida',401,await request(app).post('/api/v1/login').send({correo:'security-patient@example.test',contrasena:'Testing-only-123!'}));assert.equal(r.body.token,undefined);
   const user=(await f.query('SELECT version_sesion FROM usuarios WHERE id=$1',[patient])).rows[0];
   const old=jwt.sign({version:user.version_sesion},process.env.JWT_SECRET,{subject:String(patient),expiresIn:'8h'});
   check('SEG-17','JWT anterior de un paciente',401,await auth('get','/api/v1/session',old));
  });
  await t.test('expiración, cierre de sesión e invalidación',async()=>{
   const user=(await f.query('SELECT version_sesion FROM usuarios WHERE id=$1',[doctorId])).rows[0];
   const expired=jwt.sign({version:user.version_sesion},process.env.JWT_SECRET,{subject:String(doctorId),expiresIn:-1});
   check('SEG-18','JWT vencido',401,await auth('get','/api/v1/session',expired));
   check('SEG-19','Cerrar sesión',200,await auth('post','/api/v1/logout',doctor).send({}));
   check('SEG-20','Reutilizar JWT después del cierre',401,await auth('get','/api/v1/session',doctor));
   check('SEG-21','Eliminar paciente sintético',200,await auth('delete','/api/v1/pacientes/'+patient));
   check('SEG-22','Consultar paciente eliminado',404,await auth('get','/api/v1/pacientes/'+patient));
  });
 }finally{
  fs.mkdirSync(new URL('../../evidencia/',import.meta.url),{recursive:true});
  fs.writeFileSync(new URL('../../evidencia/seguridad-http.json',import.meta.url),JSON.stringify({executedAt:new Date().toISOString(),environment:'Express local + PostgreSQL embebido PGlite; datos sintéticos; sin Supabase ni Vercel',results},null,2));
  await f.pool.end();
 }
});
