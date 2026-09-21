import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export async function loadMigrations(directory) {
  // El administrador requiere datos personales y no se ejecuta automáticamente.
  const names=(await fs.readdir(directory)).filter(n=>/^\d+.*\.sql$/.test(n)&&n!=='03-administrador.sql').sort();
  return Promise.all(names.map(async name=>{
    const source=await fs.readFile(new URL(name,directory),'utf8');
    const sql=source.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gm,'');
    return {name,sql,checksum:crypto.createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex')};
  }));
}

export async function migrate(pool,migrations,{status=false,log=console.log}={}) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    // El bloqueo de transacción también funciona con el transaction pooler.
    await client.query('SELECT pg_advisory_xact_lock(684271905)');
    await client.query('CREATE TABLE IF NOT EXISTS migraciones_node (nombre TEXT PRIMARY KEY, checksum TEXT NOT NULL, aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now())');
    await client.query('ALTER TABLE migraciones_node ENABLE ROW LEVEL SECURITY');
    const {rows}=await client.query('SELECT nombre,checksum FROM migraciones_node');
    const applied=new Map(rows.map(r=>[r.nombre,r.checksum]));
    for(const m of migrations) {
      if(applied.has(m.name)&&applied.get(m.name)!==m.checksum)throw new Error(`El archivo ${m.name} cambió después de aplicarse. Restaura su contenido y crea otro SQL para los cambios nuevos.`);
    }
    let count=0;
    for(const m of migrations) {
      if(applied.has(m.name)){log(`Aplicada: ${m.name}`);continue;}
      if(status){log(`Pendiente: ${m.name}`);continue;}
      await client.query(m.sql);
      await client.query('INSERT INTO migraciones_node(nombre,checksum) VALUES($1,$2)',[m.name,m.checksum]);
      count++;
    }
    await client.query('COMMIT');
    if(!status)log(count?`Migración completada: ${count} archivo(s) aplicado(s).`:'La base ya está actualizada.');
    return count;
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {client.release();}
}
