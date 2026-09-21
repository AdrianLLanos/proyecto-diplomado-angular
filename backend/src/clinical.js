import {fail} from './validation.js';
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function dateOnly(value){const s=String(value||'').slice(0,10);const d=new Date(s+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(+d)||d.toISOString().slice(0,10)!==s)fail('Fecha inválida');return s;}
export const minutes=t=>{const m=/^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(t));if(!m||+m[1]>23||+m[2]>59)fail('Hora inválida');return +m[1]*60+(+m[2]);};
const time=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export function buildSlots(schedules,appointments){
 const slots=[];for(const s of schedules){const duration=Number(s.duracion_media_cita);if(!Number.isInteger(duration)||duration<1)continue;for(let n=minutes(s.hora_inicio);n+duration<=minutes(s.hora_fin);n+=duration){if(!appointments.some(a=>minutes(a.hora_inicio)<n+duration&&minutes(a.hora_fin)>n))slots.push({inicio:time(n),fin:time(n+duration)});}}
 return [...new Map(slots.map(s=>[s.inicio,s])).values()].sort((a,b)=>a.inicio.localeCompare(b.inicio));
}
export async function slotsFor(client,doctor,date,company,id=0){
 date=dateOnly(date);const weekday=days[new Date(date+'T12:00:00Z').getUTCDay()];
 const schedules=await client.query("SELECT h.* FROM horarios_medicos h JOIN usuarios u ON u.id=h.usuario_id WHERE h.usuario_id=$1 AND h.dia_semana=$2 AND h.estado='1' AND u.estado='1' AND u.empresa_id=$3 AND u.eliminado_en IS NULL",[doctor,weekday,company]);
 const appointments=await client.query('SELECT hora_inicio,hora_fin FROM citas_pacientes WHERE medico_id=$1 AND fecha_cita=$2 AND id<>$3',[doctor,date,id]);
 return buildSlots(schedules.rows,appointments.rows);
}
export async function validateSlot(client,c,id=0){
 const d=dateOnly(c.fecha_cita),weekday=days[new Date(d+'T12:00:00Z').getUTCDay()];
 const schedules=await client.query("SELECT * FROM horarios_medicos WHERE usuario_id=$1 AND dia_semana=$2 AND estado='1'",[c.medico_id,weekday]);
 if(!buildSlots(schedules.rows,[]).some(s=>s.inicio===String(c.hora_inicio).slice(0,5)&&s.fin===String(c.hora_fin).slice(0,5)))fail('Elige una hora disponible dentro del horario del médico');
}
export function validateClinical(key,data){
 if(data.hora_inicio&&data.hora_fin&&minutes(data.hora_inicio)>=minutes(data.hora_fin))fail('La hora final debe ser posterior a la inicial');
 for(const [k,v] of Object.entries(data))if(k.startsWith('fecha')&&v)dateOnly(v);
 for(const k of ['peso','estatura','importe'])if(data[k]!=null&&Number(data[k])<0)fail('Los valores clínicos e importes no pueden ser negativos');
 if(key==='recetas'){
  for(const [field,required]of [['informacion_medicamentos','medicine_name'],['informacion_diagnosticos','diagnosis']])if(data[field]!=null){let items=data[field];if(typeof items==='string'){try{items=JSON.parse(items);}catch{fail('Lista clínica inválida');}}if(!Array.isArray(items)||items.some(i=>!i||typeof i!=='object'||!String(i[required]||'').trim()))fail('Completa los nombres de los medicamentos y diagnósticos');data[field]=items;}
 }
}
