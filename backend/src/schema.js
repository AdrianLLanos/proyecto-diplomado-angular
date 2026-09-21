import fs from 'node:fs';
import { pool } from './db.js';
import { config } from './config.js';
import { modules,internal,isSecret,humanize,references,invoiceComputed } from './catalog.js';
const hints = JSON.parse(fs.readFileSync(new URL('./schema-hints.json',import.meta.url),'utf8'));
let cached;
export async function schema() {
  if (!cached) cached = pool.query(`SELECT table_name,column_name,data_type,is_nullable,column_default,character_maximum_length FROM information_schema.columns WHERE table_schema=$1 ORDER BY ordinal_position`,[config.schema])
    .then(({rows})=>Object.groupBy(rows,r=>r.table_name)).catch(e=>{cached=null;throw e;});
  return cached;
}
export function clearSchemaCache(){cached=null;}
export async function fieldsFor(m) {
  const all=await schema();
  const columns=all[m.table]; if(!columns) throw Object.assign(new Error(`No existe la tabla ${m.table}. Ejecuta los SQL de la carpeta database en la base nueva.`),{status:503});
  const convert=c=>({name:c.column_name,label:humanize(c.column_name),
    type:isSecret(c.column_name)?'password':/json/.test(c.data_type)?'json':c.data_type==='boolean'?'boolean':c.data_type==='date'?'date':c.data_type.startsWith('timestamp')?'datetime-local':c.data_type.startsWith('time')?'time':/integer|numeric|double|real|decimal/.test(c.data_type)?'number':c.data_type==='text'?'textarea':'text',
    required:c.is_nullable==='NO' && c.column_default===null, hasDefault:c.column_default!==null, maxLength:c.character_maximum_length,
    options:hints[m.table]?.[c.column_name]?.options,
    reference:references[c.column_name], secret:isSecret(c.column_name),
    readOnly: (m.key==='facturas' && invoiceComputed.includes(c.column_name)) || (m.key==='citas'&&c.column_name==='numero_turno') || (m.key.startsWith('campanas-')&&c.column_name==='estado'),
  });
  let fields=columns.filter(c=>!internal.has(c.column_name)).map(convert);
  if(m.table==='usuarios') fields=fields.filter(f=>f.name!=='configuracion_regional');
  if(m.key==='medicos') fields.push(...all.detalles_medicos.filter(c=>!internal.has(c.column_name)&&c.column_name!=='usuario_id').map(convert));
  if(m.key==='horarios') fields=fields.map(f=>f.name==='usuario_id'?{...f,label:'Médico',reference:'medicos'}:f);
  if(m.key.startsWith('campanas-')){
    const roles=await pool.query('SELECT nombre FROM roles ORDER BY nombre');
    fields=fields.map(f=>f.name==='tipo_contacto'?{...f,label:'Rol de los destinatarios',options:roles.rows.map(r=>r.nombre)}:f);
  }
  return fields;
}
export async function catalog() {return Promise.all(modules.map(async m=>({...m,fields:await fieldsFor(m)})));}
