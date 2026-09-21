import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'node:crypto';
import {fixture} from './fixture.js';

test('CERPAX: ciclo completo, autorización, expiración y trazabilidad',async t=>{
 const f=await fixture();
 try {
  const {createApp}=await import('../src/app.js');const app=createApp();
  const login=async correo=>{const r=await request(app).post('/api/login').send({correo,contrasena:'Testing-only-123!'});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.token;};
  const adminToken=await login('admin@example.test');
  const auth=(method,path,token=adminToken)=>request(app)[method]('/api'+path).set('Authorization','Bearer '+token);
  const create=async(key,data)=>{const r=await auth('post','/records/'+key).send(data);assert.equal(r.status,201,JSON.stringify(r.body));return r.body.id;};
  const d=await create('departamentos',{nombre:'Prueba',estado:'1'});
  const doctor=await create('medicos',{nombre:'Odontólogo A',correo:'a@example.test',contrasena:'Testing-only-123!',estado:'1',departamento_hospitalario_id:d});
  const other=await create('medicos',{nombre:'Odontólogo B',correo:'b@example.test',contrasena:'Testing-only-123!',estado:'1',departamento_hospitalario_id:d});
  const patient=await create('pacientes',{nombre:'Paciente sintético',correo:'p@example.test',estado:'1'});
  const tokenA=await login('a@example.test'),tokenB=await login('b@example.test');
  let id,externalToken;
  const generate=async(sid=id)=>{const r=await auth('post','/radiographs/'+sid+'/access',tokenA).send({horas:1});assert.equal(r.status,201,JSON.stringify(r.body));assert.match(r.body.qr,/^data:image\/png;base64,/);return new URL(r.body.url).hash.slice(1);};
  const upload=(token,bytes=Buffer.from('%PDF-1.4\narchivo sintético\n%%EOF'),name='estudio.pdf')=>request(app).post('/api/external/radiographs/upload').field('token',token).attach('file',bytes,name);
  await t.test('pacientes ocultos hasta asignación y control entre empresas',async()=>{
   assert.equal((await auth('get','/records/pacientes',tokenA)).body.total,0);
   assert.equal((await auth('get','/records/pacientes/'+patient,tokenA)).status,404);
   assert.equal((await auth('post','/patient-assignments',tokenB).send({paciente_id:patient,odontologo_id:other})).status,403);
   assert.equal((await auth('post','/patient-assignments').send({paciente_id:patient,odontologo_id:doctor})).status,201);
   assert.equal((await auth('get','/records/pacientes',tokenA)).body.total,1);
   assert.equal((await auth('get','/records/pacientes',tokenB)).body.total,0);
   assert.equal((await auth('get','/radiographs',tokenA).set('X-Company-ID','999')).status,403);
  });
  await t.test('creación de solicitud y bloqueo de acceso por otro odontólogo',async()=>{
   const r=await auth('post','/radiographs',tokenA).send({paciente_id:patient,tipo:'Panorámica',indicaciones:'Prueba'});assert.equal(r.status,201,JSON.stringify(r.body));id=r.body.id;
   assert.equal((await auth('get','/radiographs',tokenB)).body.rows.length,0);
   assert.equal((await auth('post','/radiographs/'+id+'/access',tokenB).send({})).status,404);
   assert.equal((await auth('get','/radiographs/'+id+'/file',tokenB)).status,404);
   assert.equal((await request(app).get('/api/radiographs')).status,401);
  });
  await t.test('enlaces vencidos, revocados y sin exposición de datos del paciente',async()=>{
   const old=await generate();externalToken=await generate();
   assert.equal((await request(app).post('/api/external/radiographs/access').send({token:old})).status,410);
   const access=await request(app).post('/api/external/radiographs/access').send({token:externalToken});assert.equal(access.status,200);assert.deepEqual(Object.keys(access.body).sort(),['id','tipo','vence_en']);
   await f.query("UPDATE accesos_radiografias SET vence_en=now()-interval '1 minute' WHERE token_hash=$1",[crypto.createHash('sha256').update(externalToken).digest('hex')]);
   assert.equal((await upload(externalToken)).status,410);externalToken=await generate();
   assert.equal((await upload(externalToken,Buffer.from('<script>alert(1)</script>'),'malicioso.pdf')).status,422);
   assert.equal((await upload(externalToken,Buffer.from('%PDF-1.4\n%%EOF'),'malicioso.exe')).status,422);
   assert.equal((await upload(externalToken,Buffer.alloc(10485761),'grande.pdf')).status,413);
  });
  await t.test('carga única, confirmación y archivo protegido',async()=>{
   const r=await upload(externalToken);assert.equal(r.status,201,JSON.stringify(r.body));assert.equal((await upload(externalToken)).status,410);
   const row=(await auth('get','/radiographs',tokenA)).body.rows[0];assert.equal(row.estado,'Completada');assert.ok(row.archivo_id);
   assert.equal((await auth('post','/radiographs/'+id+'/access',tokenA).send({})).status,409);
   const file=await auth('get','/radiographs/'+id+'/file',tokenA);assert.equal(file.status,200);assert.match(file.headers['content-type'],/application\/pdf/);
   assert.equal((await request(app).get('/api/radiographs/'+id+'/file')).status,401);
   const notices=await auth('get','/radiography-notifications',tokenA);assert.equal(notices.body.length,1);assert.equal(notices.body[0].leido_en,null);
   assert.equal((await auth('post','/radiography-notifications/'+notices.body[0].id+'/read',tokenB).send({})).status,404);
   assert.equal((await auth('post','/radiography-notifications/'+notices.body[0].id+'/read',tokenA).send({})).status,200);
  });
  await t.test('auditoría inmutable y revocación de acceso al expediente',async()=>{
   const r=await auth('get','/radiography-audit?paciente='+patient);assert.equal(r.status,200);for(const action of ['Solicitud creada','Radiografía cargada','Archivo consultado'])assert.ok(r.body.some(e=>e.evento===action));
   assert.equal((await auth('get','/radiography-audit',tokenA)).status,403);
   assert.equal((await auth('get','/radiography-audit?desde=2030-02-30')).status,422);
   await assert.rejects(f.query('DELETE FROM eventos_radiografias'),/inmutables/);
   assert.equal((await auth('delete','/patient-assignments/'+patient+'/'+doctor)).status,200);
   assert.equal((await auth('get','/radiographs/'+id+'/file',tokenA)).status,404);
   assert.equal((await auth('get','/radiography-notifications',tokenA)).body.length,0);
  });
 } finally {await f.pool.end();}
});
