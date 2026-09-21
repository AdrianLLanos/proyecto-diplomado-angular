import {pool,transaction} from './db.js';
import {get} from './repository.js';
import {requirePermission} from './auth.js';
import {channelFor} from './messaging.js';
import {fail} from './validation.js';
export function registerCampaigns(app){
 app.use('/api/campaigns/:channel',(req,res,next)=>{try{channelFor(req.params.channel);requirePermission('campanas-'+req.params.channel,req.method==='GET'?'read':'update')(req,res,next);}catch(e){next(e);}});
 app.get('/api/campaigns/:channel/:id',async(req,res)=>{
  await get('campanas-'+req.params.channel,req.params.id,req.companyId);
  const {rows}=await pool.query('SELECT e.id,e.estado,e.intentos,e.entrega_id,e.error,e.actualizado_en,u.nombre,u.correo,u.telefono FROM entregas_campanas e JOIN usuarios u ON u.id=e.usuario_id WHERE e.canal=$1 AND e.campana_id=$2 AND e.empresa_id=$3 ORDER BY e.id',[req.params.channel,req.params.id,req.companyId]);res.json(rows);
 });
 app.post('/api/campaigns/:channel/:id/start',async(req,res)=>{
  const c=channelFor(req.params.channel);const campaign=await get('campanas-'+req.params.channel,req.params.id,req.companyId);if(campaign.estado==='Processing')fail('La campaña ya se está procesando');
  await pool.query(`UPDATE ${c.table} SET fecha_programada=now(),estado='Pending' WHERE id=$1 AND empresa_id=$2`,[req.params.id,req.companyId]);res.json({ok:true,message:'Campaña programada. El procesador realizará el envío.'});
 });
 app.post('/api/campaigns/:channel/:id/retry',async(req,res)=>{
  const c=channelFor(req.params.channel);await get('campanas-'+req.params.channel,req.params.id,req.companyId);
  await transaction(async client=>{await client.query("UPDATE entregas_campanas SET estado='Pending',error=NULL WHERE canal=$1 AND campana_id=$2 AND empresa_id=$3 AND (estado='Failed' OR (estado='Unknown' AND $4::boolean))",[req.params.channel,req.params.id,req.companyId,req.body.includeUnknown===true]);await client.query(`UPDATE ${c.table} SET estado='Pending',fecha_programada=now() WHERE id=$1 AND empresa_id=$2 AND estado<>'Processing'`,[req.params.id,req.companyId]);});res.json({ok:true});
 });
}
