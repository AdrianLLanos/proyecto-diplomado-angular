export function fail(message,status=422){throw Object.assign(new Error(message),{status});}
export function validId(value){if(!/^[1-9]\d*$/.test(String(value)))fail('Identificador inválido');return String(value);}
export function validate(fields,input,creating=true){
  const result={};
  for(const f of fields){
    if(f.readOnly)continue;
    let value=input[f.name];
    if(f.secret && (value===''||value===undefined)) {if(creating&&f.required&&f.name!=='contrasena')fail(`${f.label} es obligatorio`);continue;}
    if(value===undefined){if(creating&&f.required)fail(`${f.label} es obligatorio`);continue;}
    if(value==='')value=null;
    if(value===null){if(f.required)fail(`${f.label} es obligatorio`);if(!f.hasDefault)result[f.name]=null;continue;}
    if(f.type==='number'){value=Number(value);if(!Number.isFinite(value))fail(`${f.label} debe ser un número`);}
    if(f.options&&!f.options.map(String).includes(String(value)))fail(`${f.label}: opción inválida`);
    if(f.maxLength&&String(value).length>f.maxLength)fail(`${f.label} supera ${f.maxLength} caracteres`);
    if(f.name==='correo'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))fail('Correo electrónico inválido');
    if(f.name==='contrasena'&&String(value).length<8)fail('La contraseña debe tener al menos 8 caracteres');
    if(f.type==='json'&&typeof value==='string'){try{value=JSON.parse(value);}catch{fail(`${f.label}: JSON inválido`);}}
    result[f.name]=value;
  }
  if(result.hora_inicio&&result.hora_fin&&result.hora_inicio>=result.hora_fin)fail('La hora final debe ser posterior a la inicial');
  if(result.duracion_media_cita!==undefined&&result.duracion_media_cita<=0)fail('La duración debe ser mayor a cero');
  return result;
}
const money=n=>Math.round((n+Number.EPSILON)*100)/100;
export function invoiceTotals(items,iva=0,discount=0,paid=0){
  if(!Array.isArray(items)||!items.length)fail('Agrega al menos un concepto a la factura');
  if(![iva,discount,paid].every(v=>Number.isFinite(Number(v))&&Number(v)>=0)||iva>100||discount>100)fail('Impuestos, descuento o pago inválidos');
  const lines=items.map(i=>{const cantidad=Number(i.cantidad),precio=Number(i.precio);if(!i.nombre_cuenta||!Number.isInteger(cantidad)||cantidad<=0||!Number.isFinite(precio)||precio<0)fail('Concepto, cantidad o precio inválidos');return {nombre_cuenta:String(i.nombre_cuenta),descripcion:i.descripcion||null,tipo_cuenta:'Debit',cantidad,precio,total:money(cantidad*precio)};});
  const total=money(lines.reduce((s,i)=>s+i.total,0));const total_descuento=money(total*Number(discount)/100);const total_iva=money((total-total_descuento)*Number(iva)/100);const total_general=money(total+total_iva-total_descuento);
  if(Number(paid)>total_general)fail('El pago no puede superar el total');
  return {lines,total,total_iva,total_descuento,total_general,pagado:money(Number(paid)),saldo_pendiente:money(total_general-Number(paid))};
}
