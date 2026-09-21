import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,validId,invoiceTotals} from '../src/validation.js';
import {quote} from '../src/db.js';
test('facturas: descuento antes de IVA y redondeo monetario',()=>{
  const result=invoiceTotals([{nombre_cuenta:'Consulta',cantidad:2,precio:100}],13,10,100);
  assert.equal(result.total,200);assert.equal(result.total_descuento,20);assert.equal(result.total_iva,23.4);assert.equal(result.total_general,203.4);assert.equal(result.saldo_pendiente,103.4);
});
test('rechaza facturas sin conceptos, cantidades inválidas y sobrepagos',()=>{
  for(const items of [[],[{nombre_cuenta:'x',cantidad:-1,precio:20}],[{nombre_cuenta:'x',cantidad:1.5,precio:20}]])assert.throws(()=>invoiceTotals(items));
  assert.throws(()=>invoiceTotals([{nombre_cuenta:'x',cantidad:1,precio:20}],0,0,21));
});
test('rechaza inyección en identificadores y conserva solo campos permitidos',()=>{
  assert.throws(()=>quote('usuarios; DROP TABLE usuarios'));assert.throws(()=>validId('1 OR 1=1'));
  assert.deepEqual(validate([{name:'nombre',label:'Nombre',required:true,type:'text'}],{nombre:'Paciente',empresa_id:999,contrasena:'injected'}),{nombre:'Paciente'});
});
test('secretos vacíos conservan su valor y nulos no sobrescriben defaults',()=>{
  assert.deepEqual(validate([{name:'contrasena',secret:true,required:true},{name:'estado',hasDefault:true}],{contrasena:'',estado:null},false),{});
});
test('valida correo, opciones, horarios y JSON',()=>{
  assert.throws(()=>validate([{name:'correo',label:'Correo'}],{correo:'no-es-correo'}));
  assert.throws(()=>validate([{name:'estado',options:['0','1']}],{estado:'admin'}));
  assert.throws(()=>validate([{name:'hora_inicio'},{name:'hora_fin'}],{hora_inicio:'14:00',hora_fin:'13:00'}));
  assert.throws(()=>validate([{name:'datos',type:'json'}],{datos:'{'}));
  assert.deepEqual(validate([{name:'datos',type:'json'}],{datos:'{"ok":true}'}),{datos:{ok:true}});
});
