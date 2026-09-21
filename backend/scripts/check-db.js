import {pool} from '../src/db.js';
import {catalog} from '../src/schema.js';
import {dashboard,list} from '../src/repository.js';
import {config} from '../src/config.js';
try{const start=Date.now();await pool.query('SELECT 1');console.log(`Conexión correcta (${Date.now()-start} ms)`);const modules=await catalog();console.log(`${modules.length} módulos disponibles`);const d=await dashboard(config.companyId);console.log(`${d.metrics.length} indicadores disponibles`);const doctors=await list('medicos',config.companyId);console.log(`Listado de médicos correcto (${doctors.total} registros)`);}catch(e){console.error('Verificación fallida:',e.code||e.message);process.exitCode=1;}finally{await pool.end();}
