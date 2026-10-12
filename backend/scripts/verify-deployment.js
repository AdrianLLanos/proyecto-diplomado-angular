import fs from 'node:fs';
const base=process.env.E3_TEST_URL||'https://proyecto-diplomado-angular-frontend.vercel.app';
const results=[];
async function probe(method,path,data,token){
 const start=performance.now();
 try{
  const r=await fetch(base+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
  const body=await r.json().catch(()=>null);
  results.push({method,path,status:r.status,milliseconds:Math.round(performance.now()-start)});return{status:r.status,body};
 }catch(error){results.push({method,path,status:null,error:error.name,milliseconds:Math.round(performance.now()-start)});return{status:null};}
}
await probe('GET','/api/v1/salud');await probe('GET','/api/records/pacientes');await probe('GET','/api/v1/pacientes');
if(process.env.E3_TEST_EMAIL&&process.env.E3_TEST_PASSWORD){
 const login=await probe('POST','/api/login',{correo:process.env.E3_TEST_EMAIL,contrasena:process.env.E3_TEST_PASSWORD});
 if(login.status===200&&login.body?.token){
  const token=login.body.token;
  await probe('GET','/api/radiographs',undefined,token);
  for(let i=0;i<10;i++)await probe('GET','/api/records/pacientes?size=15',undefined,token);
 }
}
const evidence={executedAt:new Date().toISOString(),environment:base,scope:'Comprobaciones de lectura; no crea pacientes, solicitudes ni archivos; no acredita entrega completa RF-03/RF-04',results};
fs.mkdirSync(new URL('../../evidencia/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../../evidencia/verificacion-despliegue.json',import.meta.url),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
