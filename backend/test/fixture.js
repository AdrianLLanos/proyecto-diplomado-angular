import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
export async function fixture(){
 process.env.NODE_ENV='test';process.env.JWT_SECRET='test-only-secret-not-for-deployment-123456789';process.env.LOCAL_ACCESS='false';
 const db=new PGlite();await db.exec(fs.readFileSync(new URL('../../database/01-esquema.sql',import.meta.url),'utf8'));await db.exec(fs.readFileSync(new URL('../../database/02-datos-iniciales.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../../database/04-radiografias.sql',import.meta.url),'utf8'));
 let tail=Promise.resolve();
 const query=async(sql,params=[])=>{const r=await db.query(sql,params);return {rows:r.rows,rowCount:Math.max(r.affectedRows||0,r.rows.length)};};
 const pool={query,connect:async()=>{const previous=tail;let release;tail=new Promise(r=>release=r);await previous;return{query,release};},end:()=>db.close()};
 const module=await import('../src/db.js');module.useTestPool(pool);
 const {clearSchemaCache}=await import('../src/schema.js');clearSchemaCache();
 const hash=await bcrypt.hash('Testing-only-123!',4);
 const {rows}=await query("INSERT INTO usuarios(empresa_id,nombre,correo,contrasena,estado) VALUES(1,'Administrador de prueba','admin@example.test',$1,'1') RETURNING id",[hash]);
 const id=rows[0].id;await query("INSERT INTO usuarios_empresas(usuario_id,empresa_id,tipo_usuario) VALUES($1,1,'User')",[id]);await query("INSERT INTO roles_modelos(rol_id,tipo_modelo,modelo_id) SELECT id,'User',$1 FROM roles WHERE nombre='Super Admin'",[id]);
 return{db,pool,id,query};
}
