import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {fixture} from './fixture.js';
test('instalación nueva y funciones completas sin usar Supabase',async t=>{
 const f=await fixture();const {createApp}=await import('../src/app.js');const app=createApp();
 const login=await request(app).post('/api/login').send({correo:'admin@example.test',contrasena:'Testing-only-123!'});assert.equal(login.status,200,JSON.stringify(login.body));const token=login.body.token;
 const auth=r=>r.set('Authorization','Bearer '+token);
 let doctor,patient;
 await t.test('catálogo y CRUD clínico',async()=>{
  const c=await auth(request(app).get('/api/catalog'));assert.equal(c.status,200);assert.equal(c.body.length,10);assert.equal(c.body.find(m=>m.key==='medicos').label,'Odontólogos');assert.equal(c.body.some(m=>['departamentos','facturas','informes'].includes(m.key)),false);
  const m=await auth(request(app).post('/api/records/medicos')).send({nombre:'Doctora Prueba',correo:'doctor@example.test',estado:'1'});assert.equal(m.status,201,JSON.stringify(m.body));doctor=m.body.id;
  const p=await auth(request(app).post('/api/records/pacientes')).send({nombre:'Paciente Prueba',correo:'paciente@example.test',estado:'1'});assert.equal(p.status,201,JSON.stringify(p.body));patient=p.body.id;
 });
 await t.test('horarios, citas y rechazo de superposiciones',async()=>{
  const h=await auth(request(app).post('/api/records/horarios')).send({usuario_id:doctor,dia_semana:'Monday',hora_inicio:'09:00',hora_fin:'12:00',duracion_media_cita:30,tipo_turno:'Timestamp',estado:'1'});assert.equal(h.status,201,JSON.stringify(h.body));
  const body={usuario_id:patient,medico_id:doctor,fecha_cita:'2030-01-07',hora_inicio:'09:00',hora_fin:'09:30'};
  const c=await auth(request(app).post('/api/records/citas')).send(body);assert.equal(c.status,201,JSON.stringify(c.body));const duplicate=await auth(request(app).post('/api/records/citas')).send(body);assert.equal(duplicate.status,409);
 });
 await t.test('recetas y Excel',async()=>{
  const recipe=await auth(request(app).post('/api/records/recetas')).send({usuario_id:patient,medico_id:doctor,fecha_receta:'2030-01-07',informacion_medicamentos:[{medicine_name:'Prueba',medicine_type:'Tableta',instruction:'Indicación de prueba',day:'1'}],informacion_diagnosticos:[{diagnosis:'Prueba',diagnosis_instruction:''}]});assert.equal(recipe.status,201,JSON.stringify(recipe.body));
  const excel=await auth(request(app).get('/api/export/pacientes'));assert.equal(excel.status,200);assert.match(excel.headers['content-type'],/spreadsheetml/);
 });
 await t.test('perfil, empresas, ajustes y roles',async()=>{
  assert.equal((await auth(request(app).get('/api/profile'))).status,200);
  assert.equal((await auth(request(app).get('/api/companies'))).body.length,1);
  assert.equal((await auth(request(app).put('/api/settings')).send({'general.company_name':'Clínica Prueba'})).status,200);
  const roles=await auth(request(app).get('/api/roles'));assert.equal(roles.body.roles.length,4);assert.equal(roles.body.roles.some(r=>['Accountant','Laboratorist'].includes(r.nombre)),false);
  const rejected=await request(app).get('/api/records/pacientes');assert.equal(rejected.status,401);
  const wrongCompany=await auth(request(app).get('/api/records/pacientes')).set('X-Company-ID','999');assert.equal(wrongCompany.status,403);
 });
 await t.test('sitio público, contacto y reserva',async()=>{
  assert.equal((await request(app).get('/api/public/pages/home')).status,200);
  const contact=await request(app).post('/api/public/contact').send({nombre:'Visitante',correo:'visitante@example.test',mensaje:'Consulta'});assert.equal(contact.status,201);
  const booking=await request(app).post('/api/public/book').send({nombre:'Nuevo paciente',correo:'nuevo@example.test',telefono:'+59177777777',medico_id:doctor,fecha_cita:'2030-01-07',hora_inicio:'10:00'});assert.equal(booking.status,201,JSON.stringify(booking.body));
 });
 await t.test('administrador activo y restricciones de pacientes',async()=>{
  assert.equal((await auth(request(app).put('/api/records/usuarios/'+f.id)).send({estado:'0'})).status,409);
  await auth(request(app).put('/api/records/pacientes/'+patient)).send({contrasena:'Patient-test-123!'});
  const login=await request(app).post('/api/login').send({correo:'paciente@example.test',contrasena:'Patient-test-123!'});assert.equal(login.status,401);assert.equal(login.body.token,undefined);
  assert.equal((await auth(request(app).delete('/api/records/pacientes/'+patient))).status,200);
  assert.equal((await auth(request(app).get('/api/records/pacientes/'+patient))).status,404);
 });
 await f.pool.end();
});
