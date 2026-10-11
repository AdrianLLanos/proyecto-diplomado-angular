import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {fixture} from './fixture.js';

test('recepción asigna pacientes sin permisos de administración ni radiografías',async()=>{
 const f=await fixture();
 try{
  const {createApp}=await import('../src/app.js');const app=createApp();
  const login=async correo=>{const r=await request(app).post('/api/login').send({correo,contrasena:'Testing-only-123!'});assert.equal(r.status,200);return r.body.token;};
  const admin=await login('admin@example.test');
  const create=async(key,correo)=>{const r=await request(app).post('/api/records/'+key).set('Authorization','Bearer '+admin).send({nombre:'Prueba recepción',correo,contrasena:'Testing-only-123!',estado:'1'});assert.equal(r.status,201,JSON.stringify(r.body));return r.body.id;};
  const user=await create('usuarios','recepcion@example.test');
  await f.query("INSERT INTO roles_modelos(rol_id,tipo_modelo,modelo_id) SELECT id,'User',$1 FROM roles WHERE nombre='Receptionist'",[user]);
  const doctor=await create('medicos','doctor.recepcion@example.test');
  const patient=await create('pacientes','paciente.recepcion@example.test');
  const token=await login('recepcion@example.test');const auth=r=>r.set('Authorization','Bearer '+token);
  assert.equal((await auth(request(app).get('/api/lookups/pacientes'))).status,200);
  assert.equal((await auth(request(app).get('/api/lookups/medicos'))).status,200);
  assert.equal((await auth(request(app).post('/api/patient-assignments')).send({paciente_id:patient,odontologo_id:doctor})).status,201);
  const assignments=await auth(request(app).get('/api/patient-assignments'));assert.equal(assignments.status,200);assert(assignments.body.some(a=>String(a.paciente_id)===String(patient)));
  assert.equal((await auth(request(app).post('/api/patient-assignments')).set('X-Company-ID','999').send({paciente_id:patient,odontologo_id:doctor})).status,403);
  assert.equal((await auth(request(app).get('/api/roles'))).status,403);
  assert.equal((await auth(request(app).get('/api/radiographs'))).status,403);
  assert.equal((await auth(request(app).get('/api/radiography-audit'))).status,403);
  assert.equal((await auth(request(app).delete('/api/patient-assignments/'+patient+'/'+doctor))).status,403);
  assert.equal((await request(app).delete('/api/patient-assignments/'+patient+'/'+doctor).set('Authorization','Bearer '+admin)).status,200);
  for(const key of ['antecedentes','recetas','usuarios','ajustes','smtp','aplicacion']){
   assert.equal((await auth(request(app).get('/api/records/'+key))).status,403,key);
  }
  for(const key of ['horarios','medicos'])assert.equal((await auth(request(app).post('/api/records/'+key)).send({})).status,403,key);
  assert.equal((await auth(request(app).delete('/api/records/pacientes/'+patient))).status,403);
  await f.query("UPDATE usuarios SET grupo_sanguineo='AB+' WHERE id=$1",[patient]);
  const detail=await auth(request(app).get('/api/records/pacientes/'+patient));
  assert.equal(detail.status,200);assert.equal(detail.body.grupo_sanguineo,undefined);
  const listing=await auth(request(app).get('/api/records/pacientes'));
  assert.equal(listing.status,200);assert(listing.body.rows.every(p=>!('grupo_sanguineo' in p)));
  const catalog=await auth(request(app).get('/api/catalog'));
  assert.equal(catalog.status,200);
  assert(!catalog.body.find(m=>m.key==='pacientes').fields.some(f=>['contrasena','grupo_sanguineo'].includes(f.name)));
  for(const body of [{grupo_sanguineo:'O+'},{contrasena:'Not-allowed-123!'}])assert.equal((await auth(request(app).put('/api/records/pacientes/'+patient)).send(body)).status,403);
  assert.equal((await auth(request(app).put('/api/records/pacientes/'+patient)).send({telefono:'70000000'})).status,200);
  const created=await auth(request(app).post('/api/records/pacientes')).send({nombre:'Paciente de recepción',correo:'nuevo.recepcion@example.test',estado:'1'});
  assert.equal(created.status,201,JSON.stringify(created.body));
  const schedule=await request(app).post('/api/records/horarios').set('Authorization','Bearer '+admin).send({usuario_id:doctor,dia_semana:'Monday',hora_inicio:'09:00',hora_fin:'12:00',duracion_media_cita:30,tipo_turno:'Timestamp',estado:'1'});
  assert.equal(schedule.status,201,JSON.stringify(schedule.body));
  const appointment=await auth(request(app).post('/api/records/citas')).send({usuario_id:patient,medico_id:doctor,fecha_cita:'2030-01-07',hora_inicio:'09:00',hora_fin:'09:30'});
  assert.equal(appointment.status,201,JSON.stringify(appointment.body));
  const rescheduled=await auth(request(app).put('/api/records/citas/'+appointment.body.id)).send({usuario_id:patient,medico_id:doctor,fecha_cita:'2030-01-07',hora_inicio:'10:00',hora_fin:'10:30'});
  assert.equal(rescheduled.status,200,JSON.stringify(rescheduled.body));
  assert.equal((await auth(request(app).delete('/api/records/citas/'+appointment.body.id))).status,200);
 }finally{await f.pool.end();}
});
