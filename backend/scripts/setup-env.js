import fs from 'node:fs';
import crypto from 'node:crypto';
const file=new URL('../.env',import.meta.url);
if(fs.existsSync(file)){console.log('backend/.env ya existe. No se sobrescribió. Completa DATABASE_URL con tu nueva base.');}
else{const example=fs.readFileSync(new URL('../.env.example',import.meta.url),'utf8').replace('JWT_SECRET=','JWT_SECRET='+crypto.randomBytes(48).toString('hex'));fs.writeFileSync(file,example,{flag:'wx'});console.log('backend/.env creado. Completa DATABASE_URL con tu nueva base de Supabase.');}
