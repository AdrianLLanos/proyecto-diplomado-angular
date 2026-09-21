import { pool,quote as q,transaction } from './db.js';
import { schema,fieldsFor } from './schema.js';
import { moduleFor,isSecret } from './catalog.js';
import { validate,validId,fail,invoiceTotals } from './validation.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {actor} from './context.js';
import {validateClinical,validateSlot} from './clinical.js';

const clean=row=>Object.fromEntries(Object.entries(row).filter(([k])=>!isSecret(k)&&!['token_recordatorio','eliminado_en'].includes(k)));
export async function scope(m,companyId,alias='t'){
  const all=await schema(),cols=all[m.table].map(c=>c.column_name);const clauses=[],params=[];
  const bind=v=>{params.push(v);return '$'+params.length;};
  if(cols.includes('eliminado_en'))clauses.push(`${alias}.eliminado_en IS NULL`);
  if(cols.includes('empresa_id')) {
    if(m.table==='usuarios')clauses.push(`(${alias}.empresa_id=${bind(companyId)} OR EXISTS(SELECT 1 FROM usuarios_empresas ue WHERE ue.usuario_id=${alias}.id AND ue.empresa_id=$1 AND ue.tipo_usuario='User'))`);
    else clauses.push(`${alias}.empresa_id=${bind(companyId)}`);
  } else if(m.table==='empresas')clauses.push(`${alias}.id=${bind(companyId)}`);
  else if(cols.includes('usuario_id')||cols.includes('paciente_id')){
    const ref=cols.includes('usuario_id')?'usuario_id':'paciente_id';
    clauses.push(`EXISTS(SELECT 1 FROM usuarios u WHERE u.id=${alias}.${q(ref)} AND u.empresa_id=${bind(companyId)} AND u.eliminado_en IS NULL)`);
  }
  if(m.role)clauses.push(`EXISTS(SELECT 1 FROM roles_modelos mr JOIN roles r ON r.id=mr.rol_id WHERE mr.modelo_id=${alias}.id AND mr.tipo_modelo='User' AND r.nombre=${bind(m.role)})`);
  const user=actor()?.user;
  if(user&&!user.bypass&&!user.roles.includes('Super Admin')){
    if(user.roles.includes('Patient')){
      if(m.table==='usuarios'&&m.role!=='Doctor')clauses.push(`${alias}.id=${bind(user.id)}`);
      else if(cols.includes('paciente_id'))clauses.push(`${alias}.paciente_id=${bind(user.id)}`);
      else if(cols.includes('usuario_id')&&m.key!=='horarios')clauses.push(`${alias}.usuario_id=${bind(user.id)}`);
    }else if(user.roles.includes('Doctor')){
      let patientColumn=m.table==='usuarios'&&m.role!=='Doctor'?`${alias}.id`:cols.includes('paciente_id')?`${alias}.paciente_id`:cols.includes('usuario_id')&&m.key!=='horarios'?`${alias}.usuario_id`:null;
      if(patientColumn)clauses.push(`EXISTS(SELECT 1 FROM pacientes_odontologos po WHERE po.empresa_id=${bind(companyId)} AND po.paciente_id=${patientColumn} AND po.odontologo_id=${bind(user.id)})`);
      if(['citas','recetas'].includes(m.key))clauses.push(`${alias}.medico_id=${bind(user.id)}`);
      if(m.key==='horarios')clauses.push(`${alias}.usuario_id=${bind(user.id)}`);
    }
  }
  return {where:clauses.length?clauses.join(' AND '):'TRUE',params};
}
export async function list(key,companyId,{page=0,size=15,search=''}={}){
  const m=moduleFor(key),all=await schema(),{where,params}=await scope(m,companyId);
  page=Math.max(0,Number(page)||0);size=Math.min(100,Math.max(1,Number(size)||15));
  let filter=where;
  const searchable=all[m.table].filter(c=>/text|character/.test(c.data_type)&&!isSecret(c.column_name));
  if(search&&searchable.length){params.push('%'+String(search).slice(0,150)+'%');filter+=` AND (${searchable.map(c=>`t.${q(c.column_name)} ILIKE $${params.length}`).join(' OR ')})`;}
  const columns=all[m.table].filter(c=>!isSecret(c.column_name)&&!['token_recordatorio','eliminado_en'].includes(c.column_name)).map(c=>'t.'+q(c.column_name)).join(',');
  // Count and rows share one trip to the remote database, including empty pages.
  const sql=`WITH matching AS (SELECT ${columns} FROM ${q(m.table)} t WHERE ${filter}) SELECT (SELECT count(*)::int FROM matching) AS total, COALESCE((SELECT json_agg(p) FROM (SELECT * FROM matching ORDER BY id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}) p),'[]'::json) AS rows`;
  const {rows}=await pool.query(sql,[...params,size,page*size]);return rows[0];
}
export async function get(key,id,companyId,client=pool){
  const m=moduleFor(key),s=await scope(m,companyId);s.params.push(validId(id));
  const {rows}=await client.query(`SELECT t.* FROM ${q(m.table)} t WHERE ${s.where} AND t.id=$${s.params.length}`,s.params);
  if(!rows[0])fail('Registro no encontrado',404);const row=clean(rows[0]);
  if(key==='medicos'){const d=await client.query('SELECT * FROM detalles_medicos WHERE usuario_id=$1',[id]);if(d.rows[0]){const {id:detailId,usuario_id,...detail}=d.rows[0];Object.assign(row,detail);}}
  if(key==='facturas')row.items=(await client.query('SELECT * FROM detalles_facturas WHERE factura_id=$1 AND empresa_id=$2 ORDER BY id',[id,companyId])).rows;
  return row;
}
export async function insert(client,table,values){
  const columns=Object.keys(values);const {rows}=await client.query(`INSERT INTO ${q(table)} (${columns.map(q).join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(values).map(v=>typeof v==='object'&&v!==null?JSON.stringify(v):v));return rows[0];
}
export async function update(client,table,id,values){const entries=Object.entries(values);if(!entries.length)return;await client.query(`UPDATE ${q(table)} SET ${entries.map(([k],i)=>`${q(k)}=$${i+1}`).join(',')} WHERE id=$${entries.length+1}`,[...entries.map(([,v])=>typeof v==='object'&&v!==null?JSON.stringify(v):v),id]);}
async function validateReferences(client,m,data,companyId){
  const fields=await fieldsFor(m);
  for(const f of fields.filter(f=>f.reference&&data[f.name]!=null))await get(f.reference,validId(data[f.name]),companyId,client);
}
async function preserveAdministrator(client,id){
  await client.query('SELECT pg_advisory_xact_lock(789456123)');
  const admins=await client.query("SELECT u.id FROM usuarios u JOIN roles_modelos rm ON rm.modelo_id=u.id AND rm.tipo_modelo='User' JOIN roles r ON r.id=rm.rol_id WHERE r.nombre='Super Admin' AND u.estado='1' AND u.eliminado_en IS NULL");
  if(admins.rows.length===1&&String(admins.rows[0].id)===String(id))fail('Debe quedar al menos un administrador activo',409);
}
export async function save(key,id,input,companyId){
  const m=moduleFor(key),all=await schema(),fields=await fieldsFor(m);
  return transaction(async client=>{
    const creating=!id;
    const existing=id?await get(key,id,companyId,client):{};
    const data=validate(fields,input,!id);
    validateClinical(key,{...existing,...data});
    if(['campanas-correo','campanas-sms'].includes(key)){
      if(id&&existing.estado==='Processing')fail('No puedes editar una campaña en proceso',409);
      delete data.estado;
    }
    await validateReferences(client,m,data,companyId);
    if(m.table==='usuarios'){
      if(id&&data.estado==='0')await preserveAdministrator(client,id);
      if(data.contrasena)data.contrasena=await bcrypt.hash(data.contrasena,12);
      else if(!id)data.contrasena=await bcrypt.hash(crypto.randomBytes(40).toString('hex'),12);
    }
    if(key==='citas'){
      const c={...existing,...data};
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[c.medico_id]);
      if(!id){const n=await client.query('SELECT COALESCE(max(numero_turno),0)+1 AS next FROM citas_pacientes WHERE medico_id=$1 AND fecha_cita=$2',[c.medico_id,c.fecha_cita]);data.numero_turno=n.rows[0].next;}
      await validateSlot(client,c,id);
      const conflict=await client.query('SELECT id FROM citas_pacientes WHERE medico_id=$1 AND fecha_cita=$2 AND hora_inicio<$3 AND hora_fin>$4 AND id<>$5 LIMIT 1',[c.medico_id,c.fecha_cita,c.hora_fin,c.hora_inicio,id||0]);
      if(conflict.rowCount)fail('El médico ya tiene una cita en ese horario',409);
    }
    let lines;
    if(key==='facturas'){
      const amounts=invoiceTotals(input.items,data.porcentaje_iva??existing.porcentaje_iva??0,data.porcentaje_descuento??existing.porcentaje_descuento??0,data.pagado??existing.pagado??0);
      ({lines}=amounts);delete amounts.lines;Object.assign(data,amounts);
    }
    const cols=all[m.table].map(c=>c.column_name);const values=Object.fromEntries(Object.entries(data).filter(([k])=>cols.includes(k)));
    if(cols.includes('empresa_id'))values.empresa_id=companyId;
    if(cols.includes('actualizado_en'))values.actualizado_en=new Date().toISOString();
    if(id&&m.table==='usuarios'&&data.contrasena)values.version_sesion=Number(existing.version_sesion||0)+1;
    if(id)await update(client,m.table,id,values);
    else {if(cols.includes('creado_en'))values.creado_en=new Date().toISOString();const created=await insert(client,m.table,values);id=created.id;}
    if(m.table==='usuarios'){
      await client.query("INSERT INTO usuarios_empresas (empresa_id,usuario_id,tipo_usuario) SELECT $1,$2,'User' WHERE NOT EXISTS(SELECT 1 FROM usuarios_empresas WHERE empresa_id=$1 AND usuario_id=$2 AND tipo_usuario='User')",[companyId,id]);
      if(m.role)await client.query("INSERT INTO roles_modelos (rol_id,tipo_modelo,modelo_id) SELECT id,'User',$1 FROM roles WHERE nombre=$2 ON CONFLICT DO NOTHING",[id,m.role]);
      const viewer=actor()?.user;
      if(creating&&key==='pacientes'&&viewer?.roles.includes('Doctor')&&!viewer.bypass&&!viewer.roles.includes('Super Admin'))await client.query('INSERT INTO pacientes_odontologos(empresa_id,paciente_id,odontologo_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[companyId,id,viewer.id]);
    }
    if(key==='medicos'){
      const detailFields=all.detalles_medicos.map(c=>c.column_name);
      const detail=Object.fromEntries(Object.entries(data).filter(([k])=>detailFields.includes(k)&&!['id','usuario_id'].includes(k)));
      const current=await client.query('SELECT id FROM detalles_medicos WHERE usuario_id=$1',[id]);
      if(current.rowCount)await update(client,'detalles_medicos',current.rows[0].id,detail);
      else await insert(client,'detalles_medicos',{...detail,usuario_id:id,creado_en:new Date().toISOString()});
    }
    if(lines){await client.query('DELETE FROM detalles_facturas WHERE factura_id=$1 AND empresa_id=$2',[id,companyId]);for(const line of lines)await insert(client,'detalles_facturas',{...line,factura_id:id,empresa_id:companyId});}
    if(m.table==='empresas'&&actor()?.user){await client.query("INSERT INTO usuarios_empresas(empresa_id,usuario_id,tipo_usuario) VALUES($1,$2,'User') ON CONFLICT DO NOTHING",[id,actor().user.id]);}
    return {id};
  });
}
export async function remove(key,id,companyId){
  const m=moduleFor(key);if(['aplicacion','empresas'].includes(key))fail('Este registro de configuración no se puede eliminar');
  const all=await schema();return transaction(async client=>{
    const existing=await get(key,id,companyId,client);
    if(key.startsWith('campanas-')&&existing.estado==='Processing')fail('No puedes eliminar una campaña en proceso',409);
    if(m.table==='usuarios'){
      await preserveAdministrator(client,id);
      const dependencies=await client.query('SELECT (SELECT count(*) FROM citas_pacientes WHERE usuario_id=$1 OR medico_id=$1)+(SELECT count(*) FROM facturas WHERE usuario_id=$1)+(SELECT count(*) FROM recetas WHERE usuario_id=$1 OR medico_id=$1) AS n',[id]);
      if(Number(dependencies.rows[0].n))fail('El usuario tiene registros clínicos o facturas. Desactívalo en lugar de eliminarlo.',409);
    }
    if(key==='facturas')await client.query('DELETE FROM detalles_facturas WHERE factura_id=$1 AND empresa_id=$2',[id,companyId]);
    if(all[m.table].some(c=>c.column_name==='eliminado_en'))await update(client,m.table,id,{eliminado_en:new Date().toISOString()});
    else await client.query(`DELETE FROM ${q(m.table)} WHERE id=$1`,[id]);
    return {ok:true};
  });
}
export async function dashboard(companyId){
  const metrics=[['pacientes','Pacientes'],['medicos','Médicos'],['citas','Citas'],['facturas','Facturas'],['recetas','Recetas'],['informes','Informes']];
  const parts=[],params=[];
  for(const [key,label] of metrics){const m=moduleFor(key),s=await scope(m,companyId);const where=s.where.replace(/\$(\d+)/g,(_,n)=>'$'+(Number(n)+params.length));params.push(...s.params);parts.push(`SELECT '${key}' AS key,'${label}' AS label,count(*)::int AS value FROM ${q(m.table)} t WHERE ${where}`);}
  const result=await pool.query(parts.join(' UNION ALL '),params);
  const viewer=actor()?.user; const restricted=viewer&&!viewer.bypass&&!viewer.roles.includes('Super Admin'); const patient=restricted&&viewer.roles.includes('Patient'); const doctor=restricted&&viewer.roles.includes('Doctor');
  const upcoming=await pool.query('SELECT c.id,c.fecha_cita,c.hora_inicio,c.hora_fin,u.nombre AS paciente,d.nombre AS medico FROM citas_pacientes c JOIN usuarios u ON u.id=c.usuario_id JOIN usuarios d ON d.id=c.medico_id WHERE c.empresa_id=$1 AND c.fecha_cita>=CURRENT_DATE AND ($2::bigint IS NULL OR c.usuario_id=$2) AND ($3::bigint IS NULL OR c.medico_id=$3) ORDER BY c.fecha_cita,c.hora_inicio LIMIT 8',[companyId,patient?viewer.id:null,doctor?viewer.id:null]);
  return {metrics:result.rows,upcoming:upcoming.rows};
}
