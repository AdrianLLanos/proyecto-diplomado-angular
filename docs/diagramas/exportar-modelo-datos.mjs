import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const schema=JSON.parse(fs.readFileSync(path.join(dir,'modelo-datos-esquema.json'),'utf8'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logical={usuarios:{empresa_id:'empresas.id'},detalles_medicos:{usuario_id:'usuarios.id',departamento_hospitalario_id:'Referencia heredada; módulo retirado'},horarios_medicos:{usuario_id:'usuarios.id'},antecedentes_pacientes:{usuario_id:'usuarios.id'},citas_pacientes:{usuario_id:'usuarios.id (paciente)',medico_id:'usuarios.id (odontólogo)',empresa_id:'empresas.id'},recetas:{usuario_id:'usuarios.id (paciente)',medico_id:'usuarios.id (odontólogo)'},usuarios_empresas:{usuario_id:'usuarios.id',empresa_id:'empresas.id'}};
const groups=[
 {name:'modelo-clinico',title:'Núcleo clínico',kicker:'01 / PACIENTES Y ATENCIÓN',tables:['usuarios','detalles_medicos','horarios_medicos','antecedentes_pacientes','citas_pacientes','recetas','pacientes_odontologos'],notes:['Pacientes y odontólogos comparten usuarios. La existencia de un registro clínico no significa que el paciente acceda al panel.','Las líneas discontinuas indican relaciones lógicas sin FK declarada. Las cardinalidades 0..1 se apoyan en índices únicos de usuario_id.','Citas y recetas referencian usuarios dos veces: paciente y odontólogo. pacientes_odontologos materializa la asignación N:M por empresa.']},
 {name:'modelo-radiografias',title:'Solicitudes y radiografías',kicker:'02 / ENTREGA Y SEGUIMIENTO',tables:['solicitudes_radiografias','accesos_radiografias','radiografias','eventos_radiografias','notificaciones_radiografias'],notes:['Cada solicitud puede tener varios accesos temporales y como máximo una radiografía: solicitud_id es único en radiografias.','CER PAX accede mediante enlace temporal. token_hash es único; vence_en, revocado_en y usado_en registran su vigencia y utilización.','storage_path identifica el objeto en Supabase Storage. contenido y sha256 son campos opcionales heredados; el archivo no es una entidad SQL adicional.','Restricciones: estado = Pendiente, Completada o Cancelada; archivo de 1 a 52 428 800 bytes; MIME PDF, PNG, JPEG o WebP. Una notificación por solicitud y usuario.']},
 {name:'modelo-permisos',title:'Cuentas, permisos y pertenencia',kicker:'03 / CONTROL DE ACCESO',tables:['roles','permisos','roles_modelos','permisos_roles','permisos_modelos','empresas','usuarios_empresas'],notes:['roles_modelos asocia usuarios y roles; permisos_roles asocia roles y permisos; permisos_modelos asigna permisos directamente al usuario.','Las FK de las tres tablas de permisos aplican ON DELETE CASCADE. Las claves primarias compuestas evitan asociaciones duplicadas.','Pertenencia: empresas (1) → usuarios_empresas (0..N) ← usuarios (1). Son relaciones lógicas; no hay FK declaradas en usuarios_empresas.','usuarios.empresa_id, citas_pacientes.empresa_id, solicitudes_radiografias.empresa_id, pacientes_odontologos.empresa_id y eventos_radiografias.empresa_id identifican la clínica. Solo las tres últimas tienen FK declarada.']}
];
const type=c=>({ 'character varying':`varchar${c.character_maximum_length?'('+c.character_maximum_length+')':''}`,'timestamp with time zone':'timestamptz','time without time zone':'time','double precision':'float8'}[c.data_type]||c.data_type);
function table(t){
 const cs=schema.constraints.filter(c=>c.table_name===t),idx=schema.indexes.filter(c=>c.table_name===t);
 const keyColumns=kind=>cs.filter(c=>c.type===kind).flatMap(c=>c.definition.match(/\(([^)]+)\)/)?.[1].split(',').map(x=>x.trim())||[]);
 const pk=keyColumns('p'),uq=cs.filter(c=>c.type==='u'&&!c.definition.match(/\(([^)]+)\)/)?.[1].includes(',')).flatMap(c=>c.definition.match(/\(([^)]+)\)/)?.[1].split(',').map(x=>x.trim())||[]);
 for(const i of idx)if(i.indexdef.includes('UNIQUE INDEX')&&!i.indexdef.includes('WHERE')){const m=i.indexdef.match(/btree \(([^)]+)\)/);if(m&&m[1].split(',').length===1)uq.push(m[1]);}
 const references=[];
 const rows=schema.columns.filter(c=>c.table_name===t).map(c=>{
  const fk=cs.find(k=>k.type==='f'&&k.definition.startsWith(`FOREIGN KEY (${c.column_name})`));
  const rel=logical[t]?.[c.column_name];
  if(fk){const target=fk.definition.match(/REFERENCES ([^ ]+)/)?.[1];references.push(`${c.column_name} → ${target}`);}
  if(rel)references.push(`${c.column_name} → ${rel} [REL]`);
  const badges=[...(pk.includes(c.column_name)?['PK']:[]),...(fk?['FK']:[]),...(uq.includes(c.column_name)&&!pk.includes(c.column_name)?['UQ']:[]),...(rel?['REL']:[])];
  return `<tr><td>${esc(c.column_name)} ${badges.map(b=>`<b class="badge ${b}">${b}</b>`).join('')}</td><td>${esc(type(c))}</td><td>${c.is_nullable==='YES'?'Sí':'No'}</td></tr>`;
 }).join('');
 const composite=cs.filter(c=>['p','u'].includes(c.type)&&c.definition.includes(',')).map(c=>c.definition);
 if(t==='radiografias')composite.push('UQ storage_path cuando no es NULL');
 return `<article><h3>${esc(t)}</h3><table><thead><tr><th>Campo / clave</th><th>Tipo</th><th>NULL</th></tr></thead><tbody>${rows}</tbody></table>${references.length?`<div class="refs">${references.map(esc).join('<br>')}</div>`:''}${composite.length?`<div class="constraint">${composite.map(esc).join('<br>')}</div>`:''}</article>`;
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1390,height:1800},acceptDownloads:true,colorScheme:'light'});
 for(const g of groups){
  await page.goto(pathToFileURL(path.join(dir,g.name+'.html')).href+'?theme=light');
  await page.getByRole('button',{name:/^Export/}).click();
  const download=page.waitForEvent('download');
  await page.locator('button[data-format="svg"]').click();
  await (await download).saveAs(path.join(dir,g.name+'.svg'));
 }
 const sections=groups.map((g,i)=>{
  const svg=fs.readFileSync(path.join(dir,g.name+'.svg'),'utf8').replace(/<\?xml[^>]+>/,'');
  const columns=[[],[],[]],heights=[0,0,0];
  const weight=t=>schema.columns.filter(c=>c.table_name===t).length+5+Object.keys(logical[t]||{}).length*1.3+schema.constraints.filter(c=>c.table_name===t&&c.type==='f').length*1.3;
  for(const t of [...g.tables].sort((a,b)=>weight(b)-weight(a))){const shortest=heights.indexOf(Math.min(...heights));columns[shortest].push(table(t));heights[shortest]+=weight(t);}
  return `<section class="sheet"><header><div class="kicker">2.4.2 · MODELO DE DATOS / ${g.kicker}</div><h1>${g.title}</h1><p>Clínica Odontológica San Martín · Modelo relacional equivalente · Supabase</p></header><div class="diagram">${svg}</div><div class="legend"><span><b class="badge PK">PK</b> Clave primaria</span><span><b class="badge FK">FK</b> Clave foránea declarada</span><span><b class="badge UQ">UQ</b> Unicidad, individual o compuesta</span><span><b class="badge REL">REL</b> Referencia lógica, sin FK</span><span>0..1: opcional único · 0..N: cero o muchos</span></div><div class="dictionary">${columns.map(c=>`<div>${c.join('')}</div>`).join('')}</div><aside>${g.notes.map(n=>`<p>${esc(n.replace('CER PAX','CERPAX'))}</p>`).join('')}</aside><footer><span>Fuente: elaboración propia a partir del esquema real. Alcance: 19 tablas principales; no incluye módulos heredados retirados.</span><span>${i+1} / 3</span></footer></section>`;
 }).join('');
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><title>Modelo de datos de la solución</title><style>@page{size:1390px 1800px;margin:0}*{box-sizing:border-box}body{margin:0;color:#22324b;background:#edf2f8;font-family:Arial,sans-serif}.sheet{width:1390px;height:1800px;padding:34px 42px;background:white;break-after:page;position:relative}.sheet:last-child{break-after:auto}header{border-bottom:2px solid #e3eaf4;padding-bottom:13px}.kicker{color:#6d4add;font-size:13px;font-weight:700;letter-spacing:1.5px}h1{font-size:31px;margin:7px 0}header p{font-size:14px;color:#687b94;margin:0}.diagram{height:705px;margin-top:8px;border:1px solid #e8edf6;border-radius:16px;background:#f8faff}.diagram svg{width:100%;height:100%;display:block}.legend{display:flex;flex-wrap:wrap;gap:13px;font-size:12px;padding:13px 0 17px}.dictionary{display:grid;grid-template-columns:repeat(3,1fr);gap:17px;align-items:start}article{border:1px solid #dce5f0;border-radius:9px;margin-bottom:14px;overflow:hidden}h3{margin:0;background:#ede9fb;color:#553e9d;padding:10px 12px;font-size:16px}table{border-collapse:collapse;width:100%;font-size:12px}th{background:#f7f9fc;color:#5b6a80;text-align:left;font-size:10px;padding:6px}td{border-top:1px solid #edf1f6;padding:5px 6px;overflow-wrap:anywhere}td:first-child{width:59%;font-family:Consolas,monospace;font-size:11px}td:nth-child(2){width:31%}td:last-child{width:10%;text-align:center}.badge{font:700 9px Arial;display:inline-block;border-radius:3px;padding:2px 3px;vertical-align:middle}.PK{background:#ece4ff;color:#6f3bb0}.FK{background:#dcf5eb;color:#12745d}.UQ{background:#fff1cf;color:#8e650b}.REL{background:#e4edff;color:#365eaa}.refs,.constraint{font:10px/1.45 Consolas,monospace;padding:7px 9px;border-top:1px solid #e7edf5;color:#50657d;overflow-wrap:anywhere}.constraint{background:#faf8ff}aside{border-left:3px solid #8b67df;padding:3px 12px;margin-top:10px;font-size:12px;line-height:1.4;color:#556982}aside p{margin:6px 0}footer{position:absolute;bottom:23px;left:42px;right:42px;display:flex;justify-content:space-between;border-top:1px solid #dfe7f1;padding-top:10px;font-size:10px;color:#67778d}@media print{body{background:white}}</style>${sections}</html>`;
 fs.writeFileSync(path.join(dir,'modelo_datos.html'),html);
 await page.goto(pathToFileURL(path.join(dir,'modelo_datos.html')).href);
 await page.addStyleTag({content:'td{padding:3px 6px}@page clinical{size:1390px 2100px;margin:0}.sheet:first-of-type{height:2100px;page:clinical}'});
 // Materializar los estilos del SVG para impresión vectorial con fuentes del sistema.
 // Los SVG canónicos y los HTML entregados por Archify se conservan intactos.
 await page.evaluate(()=>{
  const snapshots=[...document.querySelectorAll('.diagram svg *')].filter(e=>!['style','title','desc'].includes(e.tagName.toLowerCase())).map(e=>{const c=getComputedStyle(e);return {e,values:Object.fromEntries(['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','font-size','font-weight','text-anchor','dominant-baseline','display','visibility'].map(k=>[k,c.getPropertyValue(k)]))};});
  for(const {e,values} of snapshots){for(const [k,v]of Object.entries(values))e.style.setProperty(k,v);if(e.tagName.toLowerCase()==='text')e.style.fontFamily='Consolas, monospace';}
  for(const s of document.querySelectorAll('.diagram svg style'))s.remove();
  for(const svg of document.querySelectorAll('.diagram svg')){for(const e of svg.querySelectorAll('*')){if(e.getAttribute('fill')==='url(#grid)')e.remove();for(const k of ['fill','stroke']){const m=e.style[k]?.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/);if(m){const a=Number(m[4]);e.style[k]='rgb('+m.slice(1,4).map(v=>Math.round(Number(v)*a+255*(1-a))).join(',')+')';}}}}
 });
 await page.evaluate(()=>{for(const dictionary of document.querySelectorAll('.dictionary')){const columns=[...dictionary.children],cards=[...dictionary.querySelectorAll('article')].map(e=>({e,h:e.getBoundingClientRect().height+14})).sort((a,b)=>b.h-a.h),heights=[0,0,0];for(const card of cards){const i=heights.indexOf(Math.min(...heights));columns[i].append(card.e);heights[i]+=card.h;}}});
 fs.writeFileSync(path.join(dir,'modelo_datos.html'),'<!doctype html>'+await page.content());
 await page.emulateMedia({media:'screen',colorScheme:'light'});
 const layout=await page.locator('.sheet').evaluateAll(pages=>pages.map(p=>({height:p.clientHeight,contentBottom:p.querySelector('aside').getBoundingClientRect().bottom-p.getBoundingClientRect().top,footerTop:p.querySelector('footer').getBoundingClientRect().top-p.getBoundingClientRect().top})));
 if(layout.some(p=>p.contentBottom>p.footerTop-10))throw Error('Contenido se superpone al pie: '+JSON.stringify(layout));
 await page.pdf({path:path.join(dir,'modelo_datos.pdf'),preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
 for(let i=0;i<groups.length;i++){await page.pdf({path:path.join(dir,groups[i].name+'.pdf'),preferCSSPageSize:true,pageRanges:String(i+1),printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});await page.locator('.sheet').nth(i).screenshot({path:path.join(dir,groups[i].name+'-revision.png')});}
 console.log(JSON.stringify({pdf:'modelo_datos.pdf',pages:3,tables:schema.tables.length,fields:schema.columns.length,layout}));
}finally{await browser.close();}
