import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url));
const cases=[
 ['cuentas','Gestionar cuentas autorizadas',580,255,'admin'],
 ['asignaciones','Asignar pacientes a odontólogos',580,420,'admin'],
 ['auditoria','Consultar trazabilidad',580,585,'admin'],
 ['login','Iniciar sesión',990,255,'shared'],
 ['pacientes','Registrar y consultar pacientes',990,420,'shared'],
 ['solicitud','Crear solicitud radiográfica',990,585,'shared'],
 ['qr','Generar enlace temporal / QR',1400,255,'shared'],
 ['estado','Consultar estado de solicitud',1400,420,'shared'],
 ['consulta','Consultar radiografía',1400,585,'shared'],
 ['carga','Cargar radiografía con enlace',1400,805,'external']
];
const colors={admin:'#2563eb',shared:'#078778',external:'#8054cf'};
const text=(x,y,s,size=22,fill='#17334c')=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${fill}">${s}</text>`;
const actor=(id,x,y,label,note,color)=>`<g class="actor" id="${id}" stroke="${color}" stroke-width="4" fill="none"><circle cx="${x}" cy="${y-60}" r="22"/><path d="M${x} ${y-38}v75 M${x-42} ${y-12}h84 M${x} ${y+37}l-38 56 M${x} ${y+37}l38 56"/><g stroke="none" font-weight="650">${text(x,y+128,label,27,color)}${text(x,y+160,note,18,'#64748b')}</g></g>`;
const edges=[];
const line=(id,points,color)=>edges.push(`<polyline class="association" data-case="${id}" points="${points}" stroke="${color}" marker-end="url(#arrow)"/>`);
// Each actor has a dedicated outside corridor. Branches terminate at ellipse boundaries.
for(const [id,label,x,y,kind] of cases){
 if(kind==='admin')line(id,`252,370 345,370 345,${y} ${x-180},${y}`,colors.admin);
 if(kind==='shared'){
  line(id,`252,370 315,370 315,${y-65} ${x},${y-65} ${x},${y-52}`,colors.admin);
  line(id,`1690,480 1620,480 1620,${y+65} ${x},${y+65} ${x},${y+52}`,colors.shared);
 }
 if(kind==='external')line(id,`1690,805 ${x+180},805`,colors.external);
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="title desc">
<title id="title">Diagrama de casos de uso · Clínica San Martín / CERPAX</title><desc id="desc">Administrador y odontólogo son actores internos con autenticación. CERPAX solo carga radiografías mediante acceso temporal. El paciente no inicia sesión.</desc>
<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8" fill="#64748b"/></marker><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#f0f7ff"/><stop offset="1" stop-color="#f1faf7"/></linearGradient></defs>
<style>text{font-family:Arial,Helvetica,sans-serif}.association{fill:none;stroke-width:1.7;stroke-linejoin:round;opacity:.65}.uml .association{marker-end:none}.use-case text{font-weight:600}</style>
<rect width="1920" height="1080" fill="url(#bg)"/>
${text(960,70,'Casos de uso principales',40)}${text(960,110,'Clínica Odontológica San Martín · CERPAX',23,'#64748b')}
<rect x="375" y="155" width="1208" height="740" rx="24" fill="white" stroke="#c2d1e0" stroke-width="2"/>
${text(979,180,'Sistema web de gestión de pacientes y radiografías dentales',23)}
<g id="associations">${edges.join('')}</g>
${cases.map(([id,label,x,y,kind])=>`<g class="use-case" id="${id}"><ellipse cx="${x}" cy="${y}" rx="180" ry="52" fill="${kind==='admin'?'#eef4ff':kind==='external'?'#f5efff':'#effaf7'}" stroke="${colors[kind]}" stroke-width="2.3"/>${text(x,y+7,label,20)}</g>`).join('')}
${actor('administrador',210,370,'Administrador','Acceso interno',colors.admin)}
${actor('odontologo',1732,480,'Odontólogo','Pacientes asignados',colors.shared)}
${actor('cerpax',1732,805,'CERPAX','Acceso temporal',colors.external)}
<rect x="375" y="930" width="1208" height="98" rx="18" fill="white" stroke="#d7e2eb"/>
${text(979,968,'El paciente es un registro clínico: no dispone de acceso al panel.',22)}
${text(979,1002,'CERPAX utiliza un enlace o QR temporal; no inicia sesión.',21,'#64748b')}
</svg>`;
fs.writeFileSync(path.join(dir,'casos-de-uso-fullhd.svg'),svg);
fs.writeFileSync(path.join(dir,'casos-de-uso-fullhd.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Casos de uso UML · Full HD</title><style>*{box-sizing:border-box}body{margin:0;background:#edf3f7;font-family:Arial}nav{height:58px;display:flex;align-items:center;justify-content:center;gap:12px}button,a{padding:9px 15px;border:1px solid #cbd5e1;border-radius:9px;background:white;color:#17334c;text-decoration:none;cursor:pointer}main{height:calc(100vh - 58px);display:grid;place-items:center}svg{max-width:100%;max-height:100%;height:auto;width:auto}@media print{nav{display:none}main{height:auto}svg{width:100%}@page{size:landscape;margin:0}}</style><nav><button onclick="document.querySelector('svg').classList.toggle('uml')">Mostrar / ocultar flechas</button><a href="casos-de-uso-fullhd.svg" download>Descargar SVG</a><a href="casos-de-uso-fullhd.png" download>Descargar PNG Full HD</a><button onclick="print()">Imprimir / PDF</button></nav><main>${svg}</main></html>`);
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 await page.goto(pathToFileURL(path.join(dir,'casos-de-uso-fullhd.svg')).href);
 await page.screenshot({path:path.join(dir,'casos-de-uso-fullhd.png')});
 const result=await page.evaluate(()=>({actors:document.querySelectorAll('.actor').length,cases:document.querySelectorAll('.use-case').length,associations:document.querySelectorAll('.association').length,labelsFit:[...document.querySelectorAll('.use-case')].every(g=>{const e=g.querySelector('ellipse').getBBox(),t=g.querySelector('text').getBBox();return t.x>=e.x&&t.x+t.width<=e.x+e.width;})}));
 if(!result.labelsFit)throw new Error('Texto fuera de los óvalos');
 console.log(JSON.stringify(result));
}finally{await browser.close();}
