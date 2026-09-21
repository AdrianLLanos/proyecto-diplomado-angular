import {createApp} from './app.js';
import {config} from './config.js';
import {pool} from './db.js';
if(!process.env.DATABASE_URL)throw new Error('Completa DATABASE_URL en backend/.env');
if(!config.jwtSecret||config.jwtSecret.length<32)throw new Error('Configura JWT_SECRET con al menos 32 caracteres');
if(config.production&&process.env.LOCAL_ACCESS==='true')throw new Error('Desactiva LOCAL_ACCESS en producción');
const server=createApp().listen(config.port,config.host,()=>console.log(`API de la clínica: http://${config.host}:${config.port}`));
async function stop(){server.close();await pool.end();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
