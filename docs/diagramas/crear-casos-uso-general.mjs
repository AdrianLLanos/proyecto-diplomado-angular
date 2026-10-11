import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

// Fuente editable del diagrama UML; este formato no es un esquema nativo de Archify.
const dir=path.dirname(fileURLToPath(import.meta.url));
const colors={admin:'#2563eb',doctor:'#087f73',external:'#7c3aed',shared:'#475569'};
const cases=[
 ['CU-01','Iniciar sesión',960,260,'shared'],
 ['CU-02','Administrar cuentas',660,430,'admin'],
 ['CU-03','Gestionar roles y permisos',660,620,'admin'],
 ['CU-04','Supervisar pacientes y registros',660,810,'admin'],
 ['CU-05','Gestionar información clínica',1260,350,'doctor'],
 ['CU-06','Solicitar radiografía',1260,460,'doctor'],
 ['CU-07','Generar enlace temporal / QR',1260,570,'doctor'],
 ['CU-08','Consultar radiografías',1260,680,'doctor'],
 ['CU-09','Cargar radiografía con enlace',1260,900,'external']
];
const relations=[
 ['admin','M110 620 H90 V260 H760'],
 ['doctor','M1810 460 H1840 V260 H1160'],
 ...[430,620,810].map(y=>['admin',`M210 620 L425 ${y}`]),
 ...[350,460,570,680].map(y=>['doctor',`M1710 460 L1495 ${y}`]),
 ['external','M1710 900 H1495']
];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const actor=(x,y,label,role,subtitle)=>`<g stroke="${colors[role]}" stroke-width="4" fill="none"><circle cx="${x}" cy="${y-60}" r="22"/><path d="M${x} ${y-38}v80m-46-52h92m-46 52-35 52m35-52 35 52"/></g><text x="${x}" y="${y+125}" class="actor" fill="${colors[role]}">${label}</text><text x="${x}" y="${y+153}" class="small">${subtitle}</text>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="title desc">
<title id="title">Diagrama general de casos de uso</title><desc id="desc">Administrador y Odontólogo acceden al panel. CERPAX carga radiografías mediante un enlace temporal. Nueve casos de uso muestran las responsabilidades principales.</desc>
<defs>${Object.entries(colors).map(([id,color])=>`<marker id="arrow-${id}" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9" fill="${color}"/></marker>`).join('')}</defs>
<style>text{font-family:Arial,sans-serif;text-anchor:middle;fill:#17334c}.actor{font-size:27px;font-weight:700}.small{font-size:19px;fill:#64748b}.case-name{font-size:22px}.case-id{font-size:15px;font-weight:700;letter-spacing:1px}.association{fill:none;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}</style>
<rect width="1920" height="1080" fill="#f5f8fc"/>
<text x="960" y="65" font-size="40" font-weight="700">Diagrama general de casos de uso</text>
<text x="960" y="105" font-size="22" fill="#64748b">Clínica Odontológica San Martín · Gestión de pacientes</text>
<rect x="350" y="190" width="1220" height="780" rx="20" fill="white" stroke="#b9c8da" stroke-width="2"/>
${relations.map(([role,d])=>`<path class="association" d="${d}" stroke="${colors[role]}" marker-end="url(#arrow-${role})"/>`).join('')}
${cases.map(([id,name,x,y,role])=>`<g class="use-case"><ellipse cx="${x}" cy="${y}" rx="${role==='shared'?200:235}" ry="38" fill="${role==='external'?'#f5f0ff':role==='doctor'?'#effaf7':'#eff5ff'}" stroke="${colors[role]}" stroke-width="2"/><text x="${x}" y="${y-10}" class="case-id" style="fill:${colors[role]}">${id}</text><text x="${x}" y="${y+16}" class="case-name">${esc(name)}</text></g>`).join('')}
${actor(160,620,'Administrador','admin','Acceso interno')}
${actor(1760,460,'Odontólogo','doctor','Pacientes asignados')}
${actor(1760,900,'CERPAX','external','Acceso temporal')}
</svg>`;
const base='casos_de_uso';
fs.writeFileSync(path.join(dir,base+'.svg'),svg);
fs.writeFileSync(path.join(dir,base+'.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Casos de uso generales</title><style>body{margin:0;background:#f5f8fc;font-family:Arial}nav{padding:12px;text-align:center}nav a{margin:0 12px}main svg{display:block;width:100%;height:auto}@media print{nav{display:none}body{margin:0}main svg{width:1920px;height:1080px}}</style></head><body><nav><a href="${base}.pdf" download>Descargar PDF</a><a href="${base}.svg" download>Descargar SVG</a><a href="${base}.png" download>Descargar PNG</a></nav><main>${svg}</main></body></html>`);
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 await page.goto(pathToFileURL(path.join(dir,base+'.svg')).href);
 const overflow=await page.locator('.use-case').evaluateAll(nodes=>nodes.filter(g=>{
  const e=g.querySelector('ellipse').getBBox();
  return [...g.querySelectorAll('text')].some(t=>{const b=t.getBBox();return b.x<e.x||b.x+b.width>e.x+e.width||b.y<e.y||b.y+b.height>e.y+e.height;});
 }).length);
 if(overflow)throw Error('Etiquetas fuera de los óvalos: '+overflow);
 await page.screenshot({path:path.join(dir,base+'.png')});
 await page.pdf({path:path.join(dir,base+'.pdf'),width:'1920px',height:'1080px',printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});
 console.log(`Diagrama general: ${cases.length} casos, SVG/HTML/PNG/PDF, etiquetas verificadas.`);
}finally{await browser.close();}
