import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {fixture} from './fixture.js';
test('instalación nueva y funciones completas sin usar Supabase',async t=>{
 const f=await fixture();const {createApp}=await import('../src/app.js');const app=createApp();
 const login=await request(app).post('/api/login').send({correo:'admin@example.test',contrasena:'Testing-only-123!'});assert.equal(login.status,200,JSON.stringify(login.body));const token=login.body.token;
 const auth=r=>r.set('Authorization','Bearer '+token);
 let doctor,patient,dept,invoice;
 await t.test('catálogo y CRUD clínico',async()=>{
  const c=await auth(request(app).get('/api/catalog'));assert.equal(c.status,200);assert.equal(c.body.length,27);
  const d=await auth(request(app).post('/api/records/departamentos')).send({nombre:'Odontología',estado:'1'});assert.equal(d.status,201,JSON.stringify(d.body));dept=d.body.id;
  const m=await auth(request(app).post('/api/records/medicos')).send({nombre:'Doctora Prueba',correo:'doctor@example.test',estado:'1',departamento_hospitalario_id:dept});assert.equal(m.status,201,JSON.stringify(m.body));doctor=m.body.id;
  const p=await auth(request(app).post('/api/records/pacientes')).send({nombre:'Paciente Prueba',correo:'paciente@example.test',estado:'1'});assert.equal(p.status,201,JSON.stringify(p.body));patient=p.body.id;
 });
 await t.test('horarios, citas y rechazo de superposiciones',async()=>{
  const h=await auth(request(app).post('/api/records/horarios')).send({usuario_id:doctor,dia_semana:'Monday',hora_inicio:'09:00',hora_fin:'12:00',duracion_media_cita:30,tipo_turno:'Timestamp',estado:'1'});assert.equal(h.status,201,JSON.stringify(h.body));
  const body={usuario_id:patient,medico_id:doctor,fecha_cita:'2030-01-07',hora_inicio:'09:00',hora_fin:'09:30'};
  const c=await auth(request(app).post('/api/records/citas')).send(body);assert.equal(c.status,201,JSON.stringify(c.body));const duplicate=await auth(request(app).post('/api/records/citas')).send(body);assert.equal(duplicate.status,409);
 });
 await t.test('recetas, laboratorio, facturas y Excel',async()=>{
  const recipe=await auth(request(app).post('/api/records/recetas')).send({usuario_id:patient,medico_id:doctor,fecha_receta:'2030-01-07',informacion_medicamentos:[{medicine_name:'Prueba',medicine_type:'Tableta',instruction:'Indicación de prueba',day:'1'}],informacion_diagnosticos:[{diagnosis:'Prueba',diagnosis_instruction:''}]});assert.equal(recipe.status,201,JSON.stringify(recipe.body));
  const report=await auth(request(app).post('/api/records/informes')).send({paciente_id:patient,medico_id:doctor,fecha:'2030-01-07',informe:'Resultado de prueba'});assert.equal(report.status,201,JSON.stringify(report.body));
  const inv=await auth(request(app).post('/api/records/facturas')).send({usuario_id:patient,fecha_factura:'2030-01-07',porcentaje_iva:13,porcentaje_descuento:10,pagado:50,items:[{nombre_cuenta:'Consulta',cantidad:2,precio:100}]});assert.equal(inv.status,201,JSON.stringify(inv.body));invoice=inv.body.id;
  const detail=await auth(request(app).get('/api/documents/facturas/'+invoice));assert.equal(detail.body.row.total_general,203.4);
  const excel=await auth(request(app).get('/api/export/pacientes'));assert.equal(excel.status,200);assert.match(excel.headers['content-type'],/spreadsheetml/);
 });
 await t.test('perfil, empresas, ajustes y roles',async()=>{
  assert.equal((await auth(request(app).get('/api/profile'))).status,200);
  assert.equal((await auth(request(app).get('/api/companies'))).body.length,1);
  assert.equal((await auth(request(app).put('/api/settings')).send({'general.company_name':'Clínica Prueba'})).status,200);
  const roles=await auth(request(app).get('/api/roles'));assert.equal(roles.body.roles.length,6);
  const rejected=await request(app).get('/api/records/pacientes');assert.equal(rejected.status,401);
  const wrongCompany=await auth(request(app).get('/api/records/pacientes')).set('X-Company-ID','999');assert.equal(wrongCompany.status,403);
 });
 await t.test('sitio público, contacto y reserva',async()=>{
  assert.equal((await request(app).get('/api/public/pages/home')).status,200);
  const contact=await request(app).post('/api/public/contact').send({nombre:'Visitante',correo:'visitante@example.test',mensaje:'Consulta'});assert.equal(contact.status,201);
  const booking=await request(app).post('/api/public/book').send({nombre:'Nuevo paciente',correo:'nuevo@example.test',telefono:'+59177777777',medico_id:doctor,fecha_cita:'2030-01-07',hora_inicio:'10:00'});assert.equal(booking.status,201,JSON.stringify(booking.body));
 });
 await t.test('campañas procesadas con transporte simulado y sin duplicados',async()=>{
  await auth(request(app).post('/api/records/smtp')).send({nombre_remitente:'Clínica',correo_remitente:'clinic@example.test',servidor_smtp:'smtp.example.test',puerto_smtp:'587',usuario_smtp:'test',contrasena_smtp:'test',tipo_smtp:'tls',estado:'1'});
  const campaign=await auth(request(app).post('/api/records/campanas-correo')).send({nombre_campana:'Prueba',mensaje:'Hola #NAME#',tipo_contacto:'Patient',fecha_programada:'2020-01-01T10:00:00Z'});assert.equal(campaign.status,201,JSON.stringify(campaign.body));
  const {processCampaigns}=await import('../src/messaging.js');let sent=0;await processCampaigns({mail:async()=>{sent++;return'test-id';}});assert.equal(sent,2);await processCampaigns({mail:async()=>{sent++;return'test-id';}});assert.equal(sent,2);
  const logs=await auth(request(app).get('/api/campaigns/correo/'+campaign.body.id));assert.equal(logs.body.length,2);assert.ok(logs.body.every(r=>r.estado==='Sent'));
 });
 await t.test('administrador activo y restricciones de pacientes',async()=>{
  assert.equal((await auth(request(app).put('/api/records/usuarios/'+f.id)).send({estado:'0'})).status,409);
  await auth(request(app).put('/api/records/pacientes/'+patient)).send({contrasena:'Patient-test-123!'});
  const login=await request(app).post('/api/login').send({correo:'paciente@example.test',contrasena:'Patient-test-123!'});assert.equal(login.status,200);
  const own=await request(app).get('/api/records/pacientes').set('Authorization','Bearer '+login.body.token);assert.equal(own.status,200);assert.equal(own.body.total,1);assert.equal(String(own.body.rows[0].id),String(patient));
  const roles=await request(app).get('/api/roles').set('Authorization','Bearer '+login.body.token);assert.equal(roles.status,403);
 });
 await f.pool.end();
});
