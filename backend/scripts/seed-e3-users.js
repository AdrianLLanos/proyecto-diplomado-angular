import bcrypt from 'bcryptjs';
import {pool} from '../src/db.js';

const users=[
  {nombre:'Administrador E3',correo:'admin.e3@proyecto.test',contrasena:'Admin-E3-2026!',rol:'Super Admin'},
  {nombre:'Odontologa E3',correo:'odontologa.e3@proyecto.test',contrasena:'Odonto-E3-2026!',rol:'Doctor'},
];

const client=await pool.connect();
try{
  await client.query('BEGIN');
  for(const user of users){
    const hash=await bcrypt.hash(user.contrasena,12);
    const existing=await client.query('SELECT id FROM usuarios WHERE lower(correo)=lower($1) LIMIT 1',[user.correo]);
    const id=existing.rowCount
      ? existing.rows[0].id
      : (await client.query("INSERT INTO usuarios(empresa_id,nombre,correo,contrasena,estado,creado_en) VALUES(1,$1,$2,$3,'1',now()) RETURNING id",[user.nombre,user.correo,hash])).rows[0].id;
    if(existing.rowCount)await client.query("UPDATE usuarios SET nombre=$1,contrasena=$2,estado='1',eliminado_en=NULL,version_sesion=version_sesion+1 WHERE id=$3",[user.nombre,hash,id]);
    await client.query("INSERT INTO usuarios_empresas(usuario_id,empresa_id,tipo_usuario) VALUES($1,1,'User') ON CONFLICT DO NOTHING",[id]);
    await client.query("INSERT INTO roles_modelos(rol_id,tipo_modelo,modelo_id) SELECT id,'User',$1 FROM roles WHERE nombre=$2 ON CONFLICT DO NOTHING",[id,user.rol]);
  }
  await client.query('COMMIT');
  console.log('Cuentas E3 creadas o actualizadas: Super Admin y Doctor.');
}catch(error){await client.query('ROLLBACK');console.error(`No se crearon las cuentas E3: ${error.code||error.message}`);process.exitCode=1;}
finally{client.release();await pool.end();}
