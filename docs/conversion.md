# Funciones convertidas

La aplicación utiliza Angular y Angular Material para la interfaz, Express para la API y PostgreSQL para los datos. No carga ni ejecuta Laravel.

| Área | Funciones disponibles |
| --- | --- |
| Clínica | Médicos, pacientes, departamentos, horarios, citas con disponibilidad y control de superposición, antecedentes, recetas con medicamentos y diagnósticos |
| Laboratorio | Plantillas, informes, adjuntos y documentos imprimibles |
| Finanzas | Facturas con conceptos, descuentos e IVA, pagos, cuentas, monedas, impuestos, seguros, informe por fechas y exportación Excel/CSV |
| Comunicación | Plantillas de correo y SMS, SMTP, proveedores SMS, campañas programadas, seguimiento por destinatario y reintento de fallos |
| Administración | Usuarios, empresas, selección de empresa, configuración, perfil, contraseña, roles y permisos |
| Sitio público | Inicio, información, servicios, contacto y reserva de citas con horarios disponibles |
| Archivos | Carga de imágenes/PDF, imágenes públicas autorizadas y descarga privada con autorización |
| Instalación | SQL manual para una base nueva, administrador inicial y configuración por variables de entorno |

Los formularios comparten componentes de catálogo; las recetas, facturas, citas, páginas y archivos tienen editores específicos. Los controladores HTTP y servicios de datos se encuentran en `backend/src`; los componentes y el servicio HTTP de Angular están en `frontend/src/app`.

## Comprobaciones

`npm test` verifica una instalación SQL vacía, reglas de facturación, validación, autenticación, operaciones clínicas, reservas públicas y procesamiento de campañas con proveedores simulados. `npm run build` comprueba las plantillas y compila Angular. `npm run test:e2e` abre la interfaz y verifica acceso, pantallas y creación de un departamento.

Las pruebas usan PostgreSQL en memoria. La conexión al nuevo proyecto de Supabase y los envíos reales de correo/SMS requieren las credenciales del propietario y se comprueban al configurar esos servicios. El instalador y actualizador PHP se sustituyen por los scripts SQL y el despliegue Node.
