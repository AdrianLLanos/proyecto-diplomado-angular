import ExcelJS from 'exceljs';
import {pool} from './db.js';
import {requirePermission} from './auth.js';
import {get,list} from './repository.js';
import {moduleFor} from './catalog.js';
import {fieldsFor} from './schema.js';
export async function xlsx(res,rows,fields,name){const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Registros');sheet.columns=fields.map(f=>({header:f.label,key:f.name,width:24}));for(const row of rows)sheet.addRow(Object.fromEntries(fields.map(f=>[f.name,typeof row[f.name]==='object'?JSON.stringify(row[f.name]):row[f.name]])));sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="${name}.xlsx"`);await book.xlsx.write(res);res.end();}
export function registerReports(app){
 app.get('/api/export/:key',async(req,res,next)=>{requirePermission(req.params.key,'read')(req,res,next);},async(req,res)=>{const m=moduleFor(req.params.key);const rows=[];let page=0;while(true){const data=await list(m.key,req.companyId,{page:page++,size:100,search:req.query.search});rows.push(...data.rows);if(rows.length>=data.total||!data.rows.length)break;}await xlsx(res,rows,[{name:'id',label:'ID'},...(await fieldsFor(m)).filter(f=>!f.secret)],m.key);});
 app.get('/api/documents/:key/:id',async(req,res,next)=>requirePermission(req.params.key,'read')(req,res,next),async(req,res)=>{
  const row=await get(req.params.key,req.params.id,req.companyId);
  const ids=[row.usuario_id,row.paciente_id,row.medico_id].filter(Boolean);const people=ids.length?(await pool.query('SELECT id,nombre,correo,telefono,direccion FROM usuarios WHERE id=ANY($1::bigint[])',[ids])).rows:[];
  const settings=(await pool.query('SELECT clave,valor FROM configuraciones WHERE empresa_id=$1',[req.companyId])).rows;
  res.json({row,people,settings:Object.fromEntries(settings.map(r=>[r.clave,r.valor]))});
 });
}
