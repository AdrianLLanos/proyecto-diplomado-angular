import {processCampaigns} from './messaging.js';
import {pool} from './db.js';
if(process.env.MESSAGING_ENABLED!=='true')throw new Error('Para enviar campañas configura MESSAGING_ENABLED=true y un proveedor activo.');
let stopping=false;process.on('SIGINT',()=>stopping=true);process.on('SIGTERM',()=>stopping=true);
console.log('Procesador de campañas iniciado.');
while(!stopping){try{await processCampaigns();}catch(e){console.error('No se pudo procesar el lote:',e.code||e.name);}if(!stopping)await new Promise(resolve=>setTimeout(resolve,15000));}
await pool.end();
