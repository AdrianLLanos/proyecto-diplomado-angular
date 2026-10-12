import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url));
const txt=(x,y,s,size=26,color='#17334c')=>`<text x="${x}" y="${y}" text-anchor="middle" fill="${color}" font-size="${size}">${s}</text>`;
function actor(x,y,name,color){return `<g stroke="${color}" stroke-width="5" fill="none"><circle cx="${x}" cy="${y-55}" r="24"/><path d="M${x} ${y-31}v83m-48-56h96m-48 56-40 60m40-60 40 60"/></g>${txt(x,y+155,name,32,color)}`;}
function make(name,title,subtitle,items,actors,relations,note){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><style>text{font-family:Arial,sans-serif}.link{fill:none;stroke-width:2.5;opacity:.8}.uml .link{marker-end:none}</style><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9" fill="#64748b"/></marker></defs><rect width="1920" height="1080" fill="#f5f9fc"/>${txt(960,74,title,42)}${txt(960,121,subtitle,24,'#64748b')}<rect x="440" y="178" width="1040" height="735" rx="24" fill="white" stroke="#bdcddd" stroke-width="2"/>${txt(960,220,'Sistema de gestión de pacientes y radiografías',25)}${relations.map(r=>`<path class="link" d="${r[0]}" stroke="${r[1]}" marker-end="url(#arrow)"/>`).join('')}${items.map(([x,y,label,color])=>`<g class="use-case"><ellipse cx="${x}" cy="${y}" rx="230" ry="52" fill="${color==='#2563eb'?'#eff5ff':color==='#8054cf'?'#f5f0ff':'#eef9f6'}" stroke="${color}" stroke-width="2.5"/>${txt(x,y+8,label,25)}</g>`).join('')}${actors.map(a=>actor(...a)).join('')}<rect x="440" y="945" width="1040" height="85" rx="16" fill="white" stroke="#dae3ec"/>${txt(960,995,note,22,'#52667d')}</svg>`;
 fs.writeFileSync(path.join(dir,name+'.svg'),svg.replaceAll('ry="52"','ry="38"'));
 fs.writeFileSync(path.join(dir,name+'.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><title>${title}</title><style>body{margin:0;background:#edf3f7;font-family:Arial}nav{height:50px;display:flex;align-items:center;justify-content:center;gap:20px}main{height:calc(100vh - 50px);display:flex;justify-content:center}svg{max-width:100%;max-height:100%;width:auto;height:auto}a,button{color:#17334c;padding:7px;border:1px solid #cbd5e1;background:white;border-radius:6px}</style><nav><a href="${name}.png" download>PNG Full HD</a><a href="${name}.svg" download>SVG vectorial</a><button onclick="document.querySelector('svg').classList.toggle('uml')">Mostrar / ocultar flechas</button></nav><main>${svg}</main></html>`);
 const htmlPath=path.join(dir,name+'.html');
 fs.writeFileSync(htmlPath,fs.readFileSync(htmlPath,'utf8').replaceAll('ry="52"','ry="38"'));
 return name;
}
const blue='#2563eb',green='#078778',purple='#8054cf';
const names=[];
names.push(make('casos-uso-administracion','Casos de uso · Administración','Figura 1 · Acceso interno y supervisión',[
 [1060,325,'Iniciar sesión',blue],[1060,480,'Administrar cuentas',blue],[1060,635,'Gestionar roles y permisos',blue],[1060,790,'Supervisar pacientes y registros',blue]
],[[225,490,'Administrador',blue]],[[`M275 490L830 325`,blue],[`M275 490L830 480`,blue],[`M275 490L830 635`,blue],[`M275 490L830 790`,blue]],'El administrador gestiona cuentas, roles y permisos, y supervisa pacientes y registros.'));
const rows=[300,400,500,600,700,800];
names.push(make('casos-uso-radiografias','Casos de uso · Atención y radiografías','Figura 2 · Odontólogo y proveedor externo CERPAX',[
 ...['Iniciar sesión','Registrar y consultar pacientes','Crear solicitud radiográfica','Generar enlace temporal / QR','Consultar estado de solicitud','Consultar radiografía'].map((label,i)=>[800,rows[i],label,green]),[1210,850,'Cargar radiografía con enlace',purple]
],[[225,475,'Odontólogo',green],[1700,650,'CERPAX',purple]],[
 ...rows.map(y=>[`M275 475L570 ${y}`,green]),[`M1650 650L1440 850`,purple]
],'Paciente sin inicio de sesión · CERPAX solo utiliza un enlace temporal.'));
names.push(make('casos-uso-recepcion','Casos de uso · Recepción','Recepcionista · Registro y asignación de pacientes',[
 [1060,325,'Iniciar sesión',blue],[1060,480,'Registrar y consultar pacientes',blue],[1060,635,'Asignar pacientes a odontólogos',blue],[1060,790,'Retirar asignación de paciente',blue]
],[[225,490,'Recepcionista',blue]],[[`M275 490L830 325`,blue],[`M275 490L830 480`,blue],[`M275 490L830 635`,blue],[`M275 490L830 790`,blue]],'Recepción gestiona asignaciones; el odontólogo conserva el acceso clínico autorizado.'));
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1920,height:1080}});for(const name of names){await page.goto(pathToFileURL(path.join(dir,name+'.svg')).href);await page.screenshot({path:path.join(dir,name+'.png')});const fit=await page.locator('.use-case').evaluateAll(gs=>gs.every(g=>{const t=g.querySelector('text').getBBox(),e=g.querySelector('ellipse').getBBox();return t.x>=e.x&&t.x+t.width<=e.x+e.width;}));if(!fit)throw Error('Etiqueta desbordada: '+name);console.log(name+': PNG 1920x1080, textos verificados');}}finally{await browser.close();}
