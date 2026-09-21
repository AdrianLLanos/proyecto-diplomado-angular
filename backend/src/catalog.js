export const modules = [
  ['medicos','usuarios','Médicos','medical_services','Clínica','Doctor'],
  ['pacientes','usuarios','Pacientes','groups','Clínica','Patient'],
  ['departamentos','departamentos_hospitalarios','Departamentos','domain','Clínica'],
  ['horarios','horarios_medicos','Horarios médicos','schedule','Clínica'],
  ['citas','citas_pacientes','Citas','event','Clínica'],
  ['antecedentes','antecedentes_pacientes','Antecedentes clínicos','assignment','Clínica'],
  ['recetas','recetas','Recetas','medication','Clínica'],
  ['informes','informes_laboratorio','Informes de laboratorio','science','Laboratorio'],
  ['plantillas-laboratorio','plantillas_informes_laboratorio','Plantillas de informes','description','Laboratorio'],
  ['seguros','seguros','Seguros','verified_user','Finanzas'],
  ['facturas','facturas','Facturas','receipt_long','Finanzas'],
  ['pagos','pagos','Pagos','payments','Finanzas'],
  ['cuentas','cuentas_contables','Cuentas contables','account_balance','Finanzas'],
  ['monedas','monedas','Monedas','currency_exchange','Finanzas'],
  ['impuestos','impuestos','Impuestos','percent','Finanzas'],
  ['smtp','configuraciones_smtp','Servidor de correo','outgoing_mail','Configuración'],
  ['usuarios','usuarios','Usuarios','manage_accounts','Configuración'],
  ['ajustes','configuraciones','Ajustes de empresa','tune','Configuración'],
  ['aplicacion','configuracion_aplicacion','Aplicación','settings','Configuración'],
].map(([key,table,label,icon,group,role])=>({key,table,label,icon,group,role}));
export const moduleMap = Object.fromEntries(modules.map(m=>[m.key,m]));
export const labels = {
  usuario_id:'Paciente',medico_id:'Médico',departamento_hospitalario_id:'Departamento',
  plantilla_informe_laboratorio_id:'Plantilla de informe',plantilla_correo_id:'Plantilla de correo',plantilla_sms_id:'Plantilla SMS',
  nombre:'Nombre',correo:'Correo electrónico',contrasena:'Contraseña',estado:'Estado',fecha_cita:'Fecha de la cita',
  fecha_nacimiento:'Fecha de nacimiento',hora_inicio:'Hora de inicio',hora_fin:'Hora de fin',
  duracion_media_cita:'Minutos por cita',numero_turno:'Número de turno',seguro_id:'Seguro',
  informacion_medicamentos:'Medicamentos (JSON)',informacion_diagnosticos:'Diagnósticos (JSON)',
};
export const references = {usuario_id:'pacientes',medico_id:'medicos',paciente_id:'pacientes',departamento_hospitalario_id:'departamentos',seguro_id:'seguros',plantilla_informe_laboratorio_id:'plantillas-laboratorio',plantilla_correo_id:'plantillas-correo',plantilla_sms_id:'plantillas-sms'};
export const internal = new Set(['id','empresa_id','creado_en','actualizado_en','eliminado_en','token_recordatorio','correo_verificado_en','version_sesion','iniciado_en']);
export const isSecret = name => /contrasena|token|clave_secreta|auth_|autenticacion_id|api_id|usuario_smtp/.test(name);
export const humanize = name => labels[name] || name.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase());
export const invoiceComputed = ['total','total_iva','total_descuento','total_general','saldo_pendiente'];
export function moduleFor(key) { const m=moduleMap[key]; if(!m) throw Object.assign(new Error('Módulo no encontrado'),{status:404}); return m; }
