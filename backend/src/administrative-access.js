import {actor} from './context.js';

// Reception sees contact and scheduling information, never clinical or account fields.
export function administrativeOnly(){
 const user=actor()?.user;
 return !!user&&!user.bypass&&user.roles.includes('Receptionist')&&!user.roles.some(r=>['Super Admin','Doctor'].includes(r));
}
const contactFields=new Set(['id','nombre','correo','telefono','direccion','fecha_nacimiento','genero','estado']);
const doctorFields=new Set(['id','nombre','correo','telefono','estado','especialidad','cargo']);
export function visibleField(module,name){
 if(!administrativeOnly())return true;
 if(module.key==='pacientes')return contactFields.has(name);
 if(module.key==='medicos')return doctorFields.has(name);
 return true;
}
