import ExcelJS from 'exceljs';
import {pool} from './db.js';
import {requirePermission,can} from './auth.js';
import {get,list} from './repository.js';
import {moduleFor} from './catalog.js';
import {fieldsFor} from './schema.js';
import {dateOnly} from './clinical.js';
export async function financial(company,from,to){
 const start=from?dateOnly(from):'1900-01-01',end=to?dateOnly(to):'2999-12-31';
 const {rows}=await pool.query(`SELECT 'Pago' AS origen,id,fecha_pago AS fecha,nombre_cuenta AS concepto,tipo_cuenta AS tipo,importe::float AS importe FROM pagos WHERE empresa_id=$1 AND fecha_pago BETWEEN $2 AND $3
 UNION ALL SELECT 'Factura',i.id,f.fecha_factura,i.nombre_cuenta,i.tipo_cuenta,i.total::float FROM detalles_facturas i JOIN facturas f ON f.id=i.factura_id WHERE i.empresa_id=$1 AND f.fecha_factura BETWEEN $2 AND $3 ORDER BY fecha DESC,id DESC`,[company,start,end]);
 const totals=rows.reduce((a,r)=>{a[r.tipo==='Credit'?'creditos':'debitos']+=r.importe;return a;},{creditos:0,debitos:0});
 return {rows,totals,balance:totals.creditos-totals.debitos};
}
export async function xlsx(res,rows,fields,name){const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Registros');sheet.columns=fields.map(f=>({header:f.label,key:f.name,width:24}));for(const row of rows)sheet.addRow(Object.fromEntries(fields.map(f=>[f.name,typeof row[f.name]==='object'?JSON.stringify(row[f.name]):row[f.name]])));sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="${name}.xlsx"`);await book.xlsx.write(res);res.end();}
export function registerReports(app){
 app.get('/api/reports/financial',requirePermission('reportes','read'),async(req,res)=>res.json(await financial(req.companyId,req.query.from,req.query.to)));
 app.get('/api/reports/financial/export',requirePermission('reportes','read'),async(req,res)=>{const d=await financial(req.companyId,req.query.from,req.query.to);await xlsx(res,d.rows,['origen','fecha','concepto','tipo','importe'].map(name=>({name,label:name})),'reporte-financiero');});
 app.get('/api/export/:key',async(req,res,next)=>{requirePermission(req.params.key,'read')(req,res,next);},async(req,res)=>{const m=moduleFor(req.params.key);const rows=[];let page=0;while(true){const data=await list(m.key,req.companyId,{page:page++,size:100,search:req.query.search});rows.push(...data.rows);if(rows.length>=data.total||!data.rows.length)break;}await xlsx(res,rows,[{name:'id',label:'ID'},...(await fieldsFor(m)).filter(f=>!f.secret)],m.key);});
 app.get('/api/documents/:key/:id',async(req,res,next)=>requirePermission(req.params.key,'read')(req,res,next),async(req,res)=>{
  const row=await get(req.params.key,req.params.id,req.companyId);
  const ids=[row.usuario_id,row.paciente_id,row.medico_id].filter(Boolean);const people=ids.length?(await pool.query('SELECT id,nombre,correo,telefono,direccion FROM usuarios WHERE id=ANY($1::bigint[])',[ids])).rows:[];
  const settings=(await pool.query('SELECT clave,valor FROM configuraciones WHERE empresa_id=$1',[req.companyId])).rows;
  res.json({row,people,settings:Object.fromEntries(settings.map(r=>[r.clave,r.valor]))});
 });
 app.get('/api/charts',requirePermission('reportes','read'),async(req,res)=>{
  const {rows}=await pool.query("SELECT to_char(fecha_pago,'YYYY-MM') AS mes, COALESCE(sum(importe) FILTER(WHERE tipo_cuenta='Credit'),0)::float AS creditos,COALESCE(sum(importe) FILTER(WHERE tipo_cuenta='Debit'),0)::float AS debitos FROM pagos WHERE empresa_id=$1 GROUP BY 1 ORDER BY 1 DESC LIMIT 12",[req.companyId]);res.json(rows.reverse());
 });
}
