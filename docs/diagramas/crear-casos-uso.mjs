import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const cases = [
 ['cuentas', ['Gestionar cuentas', 'autorizadas'], 200],
 ['trazabilidad', ['Consultar trazabilidad'], 295],
 ['sesion', ['Iniciar sesión'], 390],
 ['pacientes', ['Registrar y consultar', 'pacientes'], 485],
 ['solicitud', ['Crear solicitud', 'de radiografía'], 580],
 ['acceso', ['Generar enlace temporal', 'o código QR'], 675],
 ['consulta', ['Consultar radiografía'], 770],
 ['estado', ['Consultar estado', 'de solicitud'], 865],
 ['carga', ['Cargar radiografía', 'mediante acceso temporal'], 960],
];
const relations = [
 ...['cuentas','trazabilidad','sesion'].map(to => ({from:'administrador',to})),
 ...['sesion','pacientes','solicitud','acceso','consulta','estado'].map(to => ({from:'odontologo',to})),
 {from:'cerpax',to:'carga'},
];
const text = (x,y,lines,cls='label') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="middle">${lines.map((s,i)=>`<tspan x="${x}" dy="${i?23:0}">${s}</tspan>`).join('')}</text>`;
const actor = (id,x,y,name,role) => `<g id="${id}" class="actor"><circle cx="${x}" cy="${y-47}" r="14"/><path d="M ${x} ${y-33} V ${y+15} M ${x-27} ${y-13} H ${x+27} M ${x} ${y+15} L ${x-24} ${y+52} M ${x} ${y+15} L ${x+24} ${y+52}"/>${text(x,y+80,[name],'actor-name')}${text(x,y+103,[role],'role')}</g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8.5in" height="11in" viewBox="0 0 850 1100" role="img" aria-labelledby="title desc">
<title id="title">Casos de uso: gestión de pacientes y radiografías dentales</title>
<desc id="desc">Sistema exclusivamente web. Tres actores y nueve casos de uso, alineados con RF-01 a RF-08 del perfil y las recomendaciones de tutoría. Administrador: iniciar sesión, gestionar cuentas autorizadas y consultar trazabilidad. Odontólogo: iniciar sesión, registrar y consultar pacientes, crear solicitud de radiografía, generar enlace temporal o código QR, consultar radiografía y consultar estado de solicitud. CERPAX: cargar radiografía mediante acceso temporal. Todos los actores se encuentran fuera del límite del sistema.</desc>
<style>text{font-family:Arial,Helvetica,sans-serif;fill:#172b45}.label{font-size:18px}.actor-name{font-size:18px;font-weight:700}.role{font-size:14px;fill:#526176}.actor{color:#235d9a}.actor circle{fill:white;stroke:currentColor;stroke-width:2.2}.actor path{fill:none;stroke:currentColor;stroke-width:2.2}.actor .actor-name{fill:currentColor}#odontologo{color:#08766c}#cerpax{color:#75519b}.association{stroke:#526176;stroke-width:1.5;fill:none}.association[data-from="administrador"]{stroke:#235d9a}.association[data-from="odontologo"]{stroke:#08766c}.association[data-from="cerpax"]{stroke:#75519b}.use-case ellipse{fill:#eff9f6;stroke:#08766c;stroke-width:1.7}#cuentas ellipse,#trazabilidad ellipse{fill:#edf4fc;stroke:#235d9a}#sesion ellipse{fill:#f1f4f8;stroke:#526176}#carga ellipse{fill:#f6f0fb;stroke:#75519b}</style>
<rect width="850" height="1100" fill="white"/>
${text(425,57,['Diagrama de casos de uso'],'heading')}
<style>.heading{font-size:24px;font-weight:700}.system{font-size:18px;font-weight:700}.access-note{font-size:14px}</style>
<rect id="system-boundary" x="232" y="96" width="401" height="926" fill="white" stroke="#233e60" stroke-width="1.8"/>
<path d="M 233 97 H 632 V 154 H 233 Z" fill="#edf2f8"/>
${text(432.5,119,['Sistema web de gestión de pacientes','y radiografías dentales'],'system')}
<g id="associations">${relations.map(({from,to})=>{const y=cases.find(c=>c[0]===to)[2]; const left=from==='odontologo'; const x1=left?142:718; const y1=left?597:from==='administrador'?295:960; return `<line class="association" data-from="${from}" data-to="${to}" x1="${x1}" y1="${y1}" x2="${left?260:605}" y2="${y}"/>`;}).join('')}</g>
${cases.map(([id,lines,y])=>`<g class="use-case" id="${id}"><ellipse cx="432.5" cy="${y}" rx="172.5" ry="34"/>${text(432.5,y+(lines.length===1?6:-6),lines)}</g>`).join('')}
${actor('administrador',745,308,'Administrador','Actor interno')}
${actor('odontologo',115,610,'Odontólogo','Actor interno')}
${actor('cerpax',745,973,'CERPAX','Actor externo')}
</svg>`;
fs.writeFileSync(path.join(dir,'casos-de-uso.svg'),svg);
const requirements={cuentas:'RF-01',pacientes:'RF-02',solicitud:'RF-03',acceso:'RF-04',carga:'RF-05',consulta:'RF-06',trazabilidad:'RF-07',estado:'RF-08'};
fs.writeFileSync(path.join(dir,'casos-de-uso.json'),JSON.stringify({diagram_type:'uml-use-case',system:'Sistema web de gestión de pacientes y radiografías dentales',actors:[{id:'administrador',name:'Administrador',role:'interno'},{id:'odontologo',name:'Odontólogo',role:'interno'},{id:'cerpax',name:'CERPAX',role:'externo'}],use_cases:cases.map(([id,label])=>({id,label:label.join(' '),requirement:requirements[id]??'Autenticación: precondición de los casos de uso internos y entrega E2'})),associations:relations,access_constraint:'CERPAX carga la radiografía mediante acceso temporal.',sources:['Recomendaciones_E1_T2.txt, apartados 1 y 6','Perfil-Diplomado.tex, RF-01 a RF-08 y actores/perfiles']},null,2));
fs.writeFileSync(path.join(dir,'casos-de-uso.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Casos de uso UML · Gestión dental</title><style>*{box-sizing:border-box}body{margin:0;background:#f0f0f0;color:#171717;font-family:Arial,sans-serif}nav{min-height:56px;padding:10px 20px;display:flex;align-items:center;justify-content:center;gap:12px}button,a{font:14px Arial;color:#171717;background:white;border:1px solid #aaa;border-radius:4px;padding:8px 14px;text-decoration:none;cursor:pointer}main{display:flex;justify-content:center;padding:0 14px 14px}svg{display:block;width:auto;height:calc(100dvh - 70px);max-width:100%;background:white;box-shadow:0 1px 8px #0002}@page{size:letter portrait;margin:0}@media print{body{background:white}nav{display:none}main{display:block;padding:0}svg{width:8.5in;height:11in;max-width:none;box-shadow:none}}@media(max-width:600px){svg{width:100%;height:auto}nav{flex-wrap:wrap}}</style><nav aria-label="Opciones del diagrama"><button onclick="window.print()">Imprimir / guardar PDF</button><a href="casos-de-uso.svg" download>Descargar SVG</a></nav><main>${svg}</main></html>`);
console.log('Created SVG, HTML and semantic JSON.');
