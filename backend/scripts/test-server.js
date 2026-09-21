import {fixture} from '../test/fixture.js';
const db=await fixture();
const {createApp}=await import('../src/app.js');
const server=createApp().listen(3002,'127.0.0.1',()=>console.log('Servidor de prueba listo'));
async function stop(){server.close();await db.pool.end();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
