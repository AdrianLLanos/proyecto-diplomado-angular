import nodemailer from 'nodemailer';
import {pool,transaction} from './db.js';
import {fail} from './validation.js';
export const channels={correo:{table:'campanas_correo',log:'registros_campanas_correo',column:'campana_correo_id',config:'configuraciones_smtp'},sms:{table:'campanas_sms',log:'registros_campanas_sms',column:'campana_sms_id',config:'proveedores_sms'}};
export function channelFor(channel){const c=channels[channel];if(!c)fail('Canal no válido',404);return c;}
export const personalize=(text,user)=>String(text).replaceAll('#NAME#',user.nombre||'').replaceAll('#PHONE#',user.telefono||'').replaceAll('#Email_ADDRESS#',user.correo||'');
export async function sendEmail(settings,to,subject,text){
 const transport=nodemailer.createTransport({host:settings.servidor_smtp,port:Number(settings.puerto_smtp),secure:settings.tipo_smtp==='ssl',requireTLS:settings.tipo_smtp==='tls',auth:{user:settings.usuario_smtp,pass:settings.contrasena_smtp},connectionTimeout:15000,socketTimeout:30000});
 try{const result=await transport.sendMail({from:{name:settings.nombre_remitente,address:settings.correo_remitente},to,subject,text});if(!result.accepted?.length)throw new Error('El servidor no aceptó al destinatario');return result.messageId;}finally{transport.close();}
}
export async function sendSms(settings,to,text,fetcher=fetch){
 const basic='Basic '+Buffer.from(`${settings.autenticacion_id}:${settings.token_autenticacion}`).toString('base64');
 let url,body,headers={};const sender=settings.numero_remitente;
 if(settings.pasarela==='twilio'){url=`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(settings.autenticacion_id)}/Messages.json`;headers={Authorization:basic,'Content-Type':'application/x-www-form-urlencoded'};body=new URLSearchParams({To:to,From:sender,Body:text});}
 else if(settings.pasarela==='plivo'){url=`https://api.plivo.com/v1/Account/${encodeURIComponent(settings.autenticacion_id)}/Message/`;headers={Authorization:basic,'Content-Type':'application/json'};body=JSON.stringify({src:sender,dst:to,text});}
 else if(settings.pasarela==='nexmo'){url='https://rest.nexmo.com/sms/json';headers={'Content-Type':'application/x-www-form-urlencoded'};body=new URLSearchParams({api_key:settings.autenticacion_id,api_secret:settings.token_autenticacion,from:sender,to,text,type:'unicode'});}
 else if(settings.pasarela==='clickatell'){url='https://platform.clickatell.com/messages';headers={Authorization:settings.api_id,'Content-Type':'application/json'};body=JSON.stringify({content:text,to:[to]});}
 else throw new Error('Proveedor SMS no reconocido');
 const response=await fetcher(url,{method:'POST',headers,body,signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('El proveedor rechazó el envío');const data=await response.json();
 if(settings.pasarela==='nexmo'&&String(data.messages?.[0]?.status)!=='0')throw new Error('El proveedor rechazó el envío');
 const id=data.sid||data.message_uuid?.[0]||data.messages?.[0]?.['message-id']||data.messages?.[0]?.apiMessageId;
 if(!id)throw new Error('El proveedor no confirmó la recepción');return String(id);
}
export async function processCampaigns({mail=sendEmail,sms=sendSms,limit=50}={}){
 for(const [channel,c]of Object.entries(channels)){
  await transaction(async client=>{
   const campaigns=await client.query(`SELECT * FROM ${c.table} WHERE estado='Pending' AND fecha_programada<=now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 5`);
   for(const campaign of campaigns.rows){
    await client.query(`UPDATE ${c.table} SET estado='Processing',iniciado_en=now() WHERE id=$1`,[campaign.id]);
    await client.query(`INSERT INTO entregas_campanas(canal,campana_id,usuario_id,empresa_id)
     SELECT $1,$2,u.id,$3 FROM usuarios u JOIN roles_modelos rm ON rm.modelo_id=u.id JOIN roles r ON r.id=rm.rol_id
     WHERE r.nombre=$4 AND u.empresa_id=$3 AND u.estado='1' AND u.eliminado_en IS NULL
     ON CONFLICT(canal,campana_id,usuario_id) DO NOTHING`,[channel,campaign.id,campaign.empresa_id,campaign.tipo_contacto]);
   }
  });
  await pool.query("UPDATE entregas_campanas SET estado='Unknown',error='El proceso se interrumpió durante el envío; comprueba con el proveedor antes de reintentar' WHERE estado='Sending' AND actualizado_en<now()-interval '10 minutes'");
  for(let i=0;i<limit;i++){
   const delivery=await transaction(async client=>{const {rows}=await client.query("SELECT * FROM entregas_campanas WHERE canal=$1 AND estado='Pending' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1",[channel]);if(!rows[0])return null;await client.query("UPDATE entregas_campanas SET estado='Sending',intentos=intentos+1,actualizado_en=now() WHERE id=$1",[rows[0].id]);return rows[0];});
   if(!delivery)break;
   let providerId=null,externalId=null,status='Sent',error=null;
   try{
    const campaign=(await pool.query(`SELECT * FROM ${c.table} WHERE id=$1 AND empresa_id=$2`,[delivery.campana_id,delivery.empresa_id])).rows[0];
    const user=(await pool.query("SELECT nombre,correo,telefono FROM usuarios WHERE id=$1 AND empresa_id=$2 AND estado='1' AND eliminado_en IS NULL",[delivery.usuario_id,delivery.empresa_id])).rows[0];
    if(!campaign||!user)throw new Error('Destinatario o campaña no disponible');
    const settings=(await pool.query(`SELECT * FROM ${c.config} WHERE empresa_id=$1 AND estado='1' ORDER BY id DESC LIMIT 1`,[delivery.empresa_id])).rows[0];
    if(!settings)throw new Error('Falta configurar un proveedor activo');providerId=settings.id;
    if(channel==='correo')externalId=await mail(settings,user.correo,campaign.nombre_campana,personalize(campaign.mensaje,user));
    else{if(!user.telefono)throw new Error('El destinatario no tiene teléfono');externalId=await sms(settings,user.telefono,personalize(campaign.mensaje,user));}
   }catch(e){status=['TimeoutError','AbortError'].includes(e.name)?'Unknown':'Failed';error=status==='Unknown'?'Respuesta incierta: comprueba el proveedor antes de reintentar':(!providerId?'Falta un proveedor o destinatario válido':'El proveedor no confirmó el envío');}
   await transaction(async client=>{
    await client.query('UPDATE entregas_campanas SET estado=$1,proveedor_id=$2,entrega_id=$3,error=$4,actualizado_en=now() WHERE id=$5',[status,providerId,externalId,error,delivery.id]);
    if(providerId){const column=channel==='correo'?'configuracion_smtp_id':'proveedor_sms_id';const extra=channel==='sms'?',entrega_id':'';const vals=channel==='sms'?', $6':'';await client.query(`INSERT INTO ${c.log}(usuario_id,${c.column},${column},estado,creado_en${extra}) VALUES($1,$2,$3,$4,$5${vals})`,[delivery.usuario_id,delivery.campana_id,providerId,status==='Sent'?'1':'0',new Date(),...(channel==='sms'?[externalId]:[])]);}
   });
  }
  await pool.query(`UPDATE ${c.table} c SET estado=CASE WHEN EXISTS(SELECT 1 FROM entregas_campanas e WHERE e.canal=$1 AND e.campana_id=c.id AND e.estado IN ('Failed','Unknown')) THEN 'Failed' ELSE 'Completed' END WHERE c.estado='Processing' AND NOT EXISTS(SELECT 1 FROM entregas_campanas e WHERE e.canal=$1 AND e.campana_id=c.id AND e.estado IN ('Pending','Sending'))`,[channel]);
 }
}
