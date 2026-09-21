import {pool} from '../src/db.js';
import {loadMigrations,migrate} from '../src/migrations.js';
try {
  if(!process.env.DATABASE_URL)throw new Error('Completa DATABASE_URL en backend/.env');
  const args=process.argv.slice(2);
  if(args.some(a=>a!=='--status'))throw new Error('Uso: npm run db:migrate [-- --status]');
  const migrations=await loadMigrations(new URL('../../database/',import.meta.url));
  await migrate(pool,migrations,{status:args.includes('--status')});
} catch(error) {
  const message=error.code==='42P07'?'Ya existen tablas sin historial de migraciones Node. No se modificaron: revisa si ejecutaste antes el SQL manualmente.':error.code?`No se pudo migrar la base (código ${error.code}). Se revirtieron los cambios de esta ejecución.`:error.message;
  console.error(message);
  process.exitCode=1;
} finally {await pool.end();}
