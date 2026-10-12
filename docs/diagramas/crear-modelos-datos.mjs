import fs from 'node:fs';
import path from 'node:path';
const dir=path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
const node=(id,label,sub,x,y,w=300)=>({id,type:'database',label,sublabel:sub,pos:[x,y],size:[w,100]});
const edge=(id,from,to,label,extra={})=>({id,from,to,label,...extra});
const write=(name,title,components,connections,items)=>fs.writeFileSync(path.join(dir,name+'.archify.json'),JSON.stringify({schema_version:1,diagram_type:'architecture',meta:{title,quality_profile:'showcase',viewBox:[1390,850]},components,connections,cards:[{dot:'violet',title:'Lectura del modelo',items}]},null,2));
write('modelo-radiografias','Modelo de datos · Radiografías',[
 node('solicitud','solicitudes_radiografias','PK id · FK empresa / paciente / odontólogo',545,340),
 node('acceso','accesos_radiografias','PK id · FK solicitud_id · UQ token_hash',50,80),
 node('imagen','radiografias','PK id · FK y UQ solicitud_id',1000,80),
 node('evento','eventos_radiografias','PK id · FK solicitud_id opcional',50,650),
 node('aviso','notificaciones_radiografias','PK id · FK solicitud_id / usuario_id',1000,650)
],[
 edge('sol-acceso','solicitud','acceso','1 : 0..N'),
 edge('sol-imagen','solicitud','imagen','1 : 0..1'),
 edge('sol-evento','solicitud','evento','0..1 : 0..N'),
 edge('sol-aviso','solicitud','aviso','1 : 0..N')
],['Las líneas continuas representan claves foráneas declaradas. Las referencias a usuarios y empresas se detallan en el diccionario.','El archivo se identifica mediante storage_path; Supabase Storage almacena el objeto y radiografias conserva sus metadatos.']);
write('modelo-permisos','Modelo de datos · Roles y permisos',[
 node('rol','roles','PK id · UQ nombre',50,80),
 node('vinculo-rol','roles_modelos','PK rol_id + tipo_modelo + modelo_id',545,80),
 node('cuenta','usuarios','PK id · UQ correo',1000,80),
 node('vinculo-permiso','permisos_roles','PK permiso_id + rol_id',50,650),
 node('permiso','permisos','PK id · UQ nombre',545,650),
 node('excepcion','permisos_modelos','PK permiso_id + tipo_modelo + modelo_id',1000,650)
],[
 edge('rol-modelos','rol','vinculo-rol','1 : 0..N'),
 edge('cuenta-roles','cuenta','vinculo-rol','1 : 0..N'),
 edge('rol-permisos','rol','vinculo-permiso','1 : 0..N'),
 edge('permiso-roles','permiso','vinculo-permiso','1 : 0..N'),
 edge('cuenta-excepciones','cuenta','excepcion','1 : 0..N'),
 edge('permiso-excepciones','permiso','excepcion','1 : 0..N')
],['Las tres tablas intermedias materializan asociaciones N:M. modelo_id referencia usuarios.id.','El registro del paciente no implica acceso al panel. CER PAX utiliza un enlace temporal, sin una cuenta interna.']);
