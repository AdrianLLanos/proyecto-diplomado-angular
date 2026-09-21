## Migración desde la terminal

Con `DATABASE_URL` configurada en `backend/.env`, ejecuta:

```powershell
npm run db:migrate
npm run db:migrate:status
```

`db:migrate` aplica `01-esquema.sql` y `02-datos-iniciales.sql` en una sola transacción y registra su checksum en `migraciones_node`. Puedes repetir el comando: solo ejecuta archivos pendientes. Si un SQL falla, revierte los cambios de esa ejecución. El bloqueo de transacción es compatible con el pooler del puerto 6543.

Esta opción sustituye la ejecución manual de los pasos 01 y 02. No combina automáticamente una instalación SQL manual previa con el historial nuevo: si ya creaste las tablas manualmente, conserva esa instalación y no vuelvas a ejecutar los scripts iniciales. No borra ni reemplaza tablas existentes.

El administrador sigue creándose con `database/03-administrador.sql`: reemplaza tu correo y contraseña antes de ejecutarlo en Supabase. Ese archivo se excluye de las migraciones automáticas. Para futuros cambios agrega archivos `04-descripcion.sql`, `05-descripcion.sql`, etc.; no edites los ya aplicados. Los nuevos archivos no deben contener `BEGIN`/`COMMIT`: el ejecutor administra la transacción.

# Clínica Dental · Angular + Node.js

Aplicación independiente del proyecto PHP. La interfaz usa Angular 21 y Angular Material; la API usa Node.js, Express y PostgreSQL. No requiere Laravel, Artisan, Composer ni una copia de su base de datos.

## Instalación manual en un proyecto NUEVO de Supabase

1. Crea un proyecto nuevo en Supabase.
2. Abre **SQL Editor**. Ejecuta, en este orden, los archivos:
   - `database/01-esquema.sql`: crea las tablas, índices y relaciones de la aplicación. Debe ejecutarse en una base vacía; no borra ni reemplaza tablas existentes.
   - `database/02-datos-iniciales.sql`: crea la empresa inicial, configuración, moneda BOB, seis roles, permisos y páginas públicas. No copia pacientes ni datos de Laravel.
   - `database/03-administrador.sql`: cambia `TU_CORREO` y `TU_CONTRASENA` antes de ejecutarlo. Crea tu administrador con contraseña cifrada. El archivo rechaza los valores de ejemplo.
3. Abre una terminal en esta carpeta:

   ```powershell
   npm install
   npm run setup:env
   ```

4. Edita `backend/.env` y completa `DATABASE_URL` con la URI que entrega **Connect** en el nuevo proyecto. Reemplaza la contraseña y codifica sus caracteres especiales para una URL. La URL y las claves solo pertenecen al backend.
5. Ejecuta `npm run check:db` para verificar la conexión y las tablas.
6. Ejecuta `npm run dev`. Abre **http://127.0.0.1:4200** para el sitio público y **http://127.0.0.1:4200/dashboard** para el panel.

No ejecutes `php artisan migrate` ni `php artisan db:seed` para esta versión. Los datos no se comparten con Laravel.

## Acceso y roles

En desarrollo, `LOCAL_ACCESS=true` habilita el acceso automático **solo desde localhost**, usando un administrador existente. `ENFORCE_ROLES=false` mantiene los permisos desactivados temporalmente, como en el prototipo anterior.

Para probar usuarios y roles:

```dotenv
LOCAL_ACCESS=false
ENFORCE_ROLES=true
```

Reinicia la API y entra con el correo y la contraseña creados en el paso 03. Roles iniciales: Super Admin, Doctor, Patient, Accountant, Laboratorist y Receptionist. La pantalla **Roles y permisos** permite crear roles y asignar permisos; en **Usuarios**, el botón de escudo asigna roles a cada cuenta. En producción los permisos se aplican siempre.

El selector del encabezado cambia entre las empresas vinculadas al usuario. La API comprueba la pertenencia a la empresa y los permisos, además de las restricciones de pacientes y médicos sobre sus registros.

## Módulos

- Resumen e indicadores; consultas paginadas, búsqueda, exportación CSV y Excel.
- Médicos, pacientes, departamentos, horarios y citas. La disponibilidad se calcula a partir del horario médico; las reservas se guardan en una transacción y se rechazan cruces de horario.
- Antecedentes, recetas con medicamentos y diagnósticos, informes y plantillas de laboratorio.
- Facturas con conceptos, descuentos, IVA, pagos y saldo. Cuentas, pagos, seguros, monedas, impuestos y reportes por período.
- Configuración general, localización, valores predeterminados, páginas públicas, contacto, usuarios, roles, perfil y contraseñas.
- Plantillas, campañas de correo/SMS, proveedores, programación, seguimiento por destinatario y reintentos.
- Adjuntos PDF, PNG, JPEG y WebP, con límite de 10 MB. Los archivos clínicos se descargan mediante la API autenticada. Solo las imágenes publicadas expresamente se sirven sin sesión.

En los documentos, **Imprimir / guardar PDF** utiliza la impresión del navegador. Las plantillas y el editor de recetas permiten ingresar contenido estructurado sin editar JSON.

## Correo y campañas

1. Configura un servidor de correo en **Servidor de correo**, o un proveedor en **Proveedores SMS**. Se admiten SMTP, Twilio, Vonage/Nexmo, Plivo y Clickatell.
2. Configura `APP_URL` con la URL real de la interfaz, para los enlaces de recuperación de contraseña.
3. Activa `MESSAGING_ENABLED=true` en `backend/.env`.
4. Crea una campaña, selecciona el rol de destinatarios y la fecha/hora.
5. En otra terminal ejecuta:

   ```powershell
   npm run worker
   ```

El procesador consulta las campañas vencidas, crea una entrega por destinatario y registra la aceptación o el error del proveedor. `Sent` significa **aceptado por el proveedor**, no una confirmación de lectura o entrega final al teléfono. Las entregas confirmadas no se vuelven a enviar al reintentar fallidos. `Unknown` identifica un resultado incierto; revisa el proveedor antes de repetirlo.

**Guardar una campaña no inicia el procesador.** No se envían correos ni SMS durante las pruebas automatizadas. Para recuperar una contraseña se necesita SMTP activo y `MESSAGING_ENABLED=true`.

## Producción con Node.js

```powershell
npm install
npm run build
npm start
```

Node sirve la API y el Angular compilado desde el mismo servidor. Configura:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
LOCAL_ACCESS=false
ENFORCE_ROLES=true
APP_URL=https://tu-dominio.example
```

Usa una clave `JWT_SECRET` privada de al menos 32 caracteres, HTTPS mediante tu alojamiento y almacenamiento persistente para `backend/uploads`. La verificación del certificado PostgreSQL está activada por defecto: configura `DB_CA_FILE` si tu conexión necesita una CA específica. Las tablas tienen RLS activado y no exponen acceso directo al navegador; Node se conecta mediante el usuario de servidor propietario de las tablas. Ejecuta el worker como proceso separado si utilizas campañas.

## Pruebas y organización

```powershell
npm test
npm run build
```

Las pruebas de integración ejecutan los SQL de instalación en PostgreSQL en memoria (PGlite), con cuentas ficticias y proveedores simulados. No necesitan Supabase ni modifican bases externas. `npm run test:e2e` valida la interfaz sobre otra base en memoria; necesita Microsoft Edge instalado o Chromium de Playwright.

```text
frontend/       Angular, pantallas y componentes Material
backend/src/    API, autenticación, operaciones clínicas y procesador
backend/test/   Pruebas aisladas de API, reglas y base de datos
database/       Instalación SQL manual e independiente
docs/           Matriz de conversión y comprobaciones
```

La actualización de esta versión se hace con código y despliegue de Node; el instalador y actualizador específicos de PHP no se ejecutan aquí.
