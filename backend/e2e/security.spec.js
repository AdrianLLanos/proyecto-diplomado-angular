import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const folder=new URL('../../evidencia/',import.meta.url);
test('evidencias de seguridad HTTP y acceso desde navegador',async({page,request})=>{
 const cases=[];
 const observe=async(id,scenario,method,path,data,expected,token)=>{
  const r=await request[method](path,{data,headers:token?{Authorization:'Bearer '+token}:{}});
  const body=await r.json();
  const safe=structuredClone(body);if(safe.token)safe.token='[JWT omitido]';if(safe.user)safe.user={roles:safe.user.roles};if(safe.qr)safe.qr='[QR generado]';if(safe.url)safe.url='[enlace temporal omitido]';
  cases.push({id,scenario,method:method.toUpperCase(),path,expected,obtained:r.status(),response:safe});
  expect(r.status(),JSON.stringify(safe)).toBe(expected);return body;
 };
 const session=await observe('EV-01','RF-01: inicio de sesión válido','post','/api/v1/login',{correo:'admin@example.test',contrasena:'Testing-only-123!'},200);
 const token=session.token;
 await observe('EV-02','RF-01: contraseña incorrecta','post','/api/v1/login',{correo:'admin@example.test',contrasena:'incorrecta'},401);
 await observe('EV-03','Sin autenticación','get','/api/v1/pacientes',undefined,401);
 await observe('EV-04','RF-02: campos obligatorios ausentes','post','/api/v1/pacientes',{},422,token);
 const patient=await observe('EV-05','RF-02: crear paciente','post','/api/v1/pacientes',{nombre:'Paciente evidencia',correo:'proof-patient@example.test',estado:'1'},201,token);
 const doctor=await observe('EV-06','Crear odontólogo sintético','post','/api/v1/odontologos',{nombre:'Doctor evidencia',correo:'proof-doctor@example.test',contrasena:'Testing-only-123!',estado:'1'},201,token);
 const doctorSession=await observe('EV-07','Inicio de sesión odontólogo','post','/api/v1/login',{correo:'proof-doctor@example.test',contrasena:'Testing-only-123!'},200);
 await observe('EV-08','Odontólogo no administra cuentas','get','/api/v1/cuentas',undefined,403,doctorSession.token);
 await observe('EV-09','RF-03: solicitud sin asignación','post','/api/v1/radiographs',{paciente_id:patient.id,tipo:'Panorámica'},404,doctorSession.token);
 await observe('EV-10','Asignar paciente al odontólogo','post','/api/v1/patient-assignments',{paciente_id:patient.id,odontologo_id:doctor.id},201,token);
 const radiograph=await observe('EV-11','RF-03: crear solicitud asignada','post','/api/v1/radiographs',{paciente_id:patient.id,tipo:'Panorámica'},201,doctorSession.token);
 const first=await observe('EV-12','RF-04: generar enlace y QR','post',`/api/v1/radiographs/${radiograph.id}/access`,{horas:1},201,doctorSession.token);
 const second=await observe('EV-13','RF-04: regenerar acceso','post',`/api/v1/radiographs/${radiograph.id}/access`,{horas:1},201,doctorSession.token);
 await observe('EV-14','RF-04: enlace anterior revocado','post','/api/v1/external/radiographs/access',{token:new URL(first.url).hash.slice(1)},410);
 await observe('EV-15','RF-04: acceso vigente CERPAX','post','/api/v1/external/radiographs/access',{token:new URL(second.url).hash.slice(1)},200);
 await page.goto('/carga-radiografia'+new URL(second.url).hash);await expect(page.getByRole('heading',{name:'Entrega de radiografía'})).toBeVisible();
 fs.mkdirSync(folder,{recursive:true});
 await page.screenshot({path:new URL('portal-cerpax-prueba.png',folder).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await page.goto('/login');
 await page.screenshot({path:new URL('login-prueba.png',folder).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await page.getByLabel('Correo electrónico').fill('admin@example.test');await page.getByLabel('Contraseña',{exact:true}).fill('Testing-only-123!');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page).toHaveURL(/dashboard/);
 await page.screenshot({path:new URL('acceso-administrador-prueba.png',folder).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await page.goto('/modulos/pacientes');await expect(page.locator('h1').first()).toBeVisible();await expect(page.locator('body')).toContainText('Paciente evidencia');
 await page.screenshot({path:new URL('pacientes-prueba.png',folder).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await page.goto('/radiografias');await expect(page.locator('body')).toContainText('Paciente evidencia');
 await page.screenshot({path:new URL('solicitudes-prueba.png',folder).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 const escape=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
 const date=new Date().toISOString();
 const html=`<!doctype html><meta charset="utf-8"><title>Evidencias de pruebas HTTP</title><style>body{font:16px Arial;color:#17324d;background:#f1f5f9;padding:40px;max-width:1100px;margin:auto}h1{color:#006d77}article{background:white;border-left:5px solid #008b78;border-radius:10px;padding:22px;margin:20px 0;break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf4f8;padding:16px}b{color:#006d77}@media print{body{padding:0;background:white}article{border:1px solid #ccd8df}}</style><h1>Resultados reales de pruebas HTTP</h1><p>Fecha UTC: ${date}. Entorno local: Express + PGlite, datos sintéticos. No corresponde a producción en Vercel. Contraseñas y tokens omitidos.</p>${cases.map(c=>`<article><h2>${escape(c.id+' — '+c.scenario)}</h2><p>${escape(c.method+' '+c.path)}</p><p>Esperado: HTTP ${c.expected}. Obtenido: <b>HTTP ${c.obtained} · APROBADO</b></p><pre>${escape(JSON.stringify(c.response,null,2))}</pre></article>`).join('')}`;
 fs.writeFileSync(new URL('evidencias-seguridad.html',folder),html);fs.writeFileSync(new URL('evidencias-navegador.json',folder),JSON.stringify({executedAt:date,environment:'Local Express + PGlite',cases},null,2));
 await page.setViewportSize({width:1920,height:1080});await page.setContent(html);
 await page.pdf({path:new URL('evidencias-seguridad.pdf',folder).pathname.replace(/^\/([A-Za-z]:)/,'$1'),format:'A4',printBackground:true,margin:{top:'15mm',bottom:'15mm',left:'15mm',right:'15mm'}});
 for(const [code,id]of [[200,'EV-01'],[401,'EV-03'],[403,'EV-08'],[422,'EV-04']]){
  await page.locator('article').filter({hasText:id+' —'}).screenshot({path:new URL(`http-${code}.png`,folder).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 }
});
