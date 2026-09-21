import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {createApp} from '../src/app.js';
const app=createApp();
test('health responde sin credenciales ni información de conexión',async()=>{
  const response=await request(app).get('/api/health');assert.equal(response.status,200);assert.deepEqual(response.body,{ok:true});assert.equal(response.headers['x-powered-by'],undefined);
});
test('bloquea peticiones desde otros sitios antes de consultar datos',async()=>{
  const response=await request(app).post('/api/records/pacientes').set('Origin','https://another-site.example').send({nombre:'x'});assert.equal(response.status,403);
});
test('no permite login sin credenciales',async()=>{
  const response=await request(app).post('/api/login').send({});assert.equal(response.status,400);assert.match(response.body.message,/correo/);
});
