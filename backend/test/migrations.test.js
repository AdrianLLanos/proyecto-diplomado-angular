import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {loadMigrations,migrate} from '../src/migrations.js';
test('migraciones: instalación, repetición, checksum y rollback',async()=>{
 const db=new PGlite();
 const query=async(sql,params)=>params?db.query(sql,params):(await db.exec(sql)).at(-1);
 const pool={connect:async()=>({query,release(){}})};
 const options={log(){}};
 try {
  const migrations=await loadMigrations(new URL('../../database/',import.meta.url));
  assert.equal(migrations.length,3);
  await migrate(pool,migrations,{...options,status:true});
  assert.equal((await db.query("SELECT to_regclass('usuarios') AS name")).rows[0].name,null);
  assert.equal(await migrate(pool,migrations,options),3);
  assert.equal(await migrate(pool,migrations,options),0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM empresas')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM roles')).rows[0].n,6);
  await assert.rejects(migrate(pool,[{...migrations[0],checksum:'alterado'}],options),/cambió/);
  await assert.rejects(migrate(pool,[{name:'04-fallo.sql',checksum:'test',sql:'CREATE TABLE temporal_prueba(id INT); SELECT * FROM no_existe;'}],options));
  assert.equal((await db.query("SELECT to_regclass('temporal_prueba') AS name")).rows[0].name,null);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM migraciones_node')).rows[0].n,3);
 } finally {await db.close();}
});
