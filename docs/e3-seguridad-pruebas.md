# E3: seguridad y pruebas

Este texto corresponde a los apartados 2.7 y 2.8 del documento de E3. Se debe actualizar la columna **Obtenido** con la fecha, URL y figura de las comprobaciones realizadas en producción antes de exportar el PDF.

## 2.7 Seguridad

La API usa autenticación mediante correo y contraseña. Tras un inicio de sesión válido, emite un JWT firmado con `HS256`, asociado al identificador del usuario y a su versión de sesión, con vigencia de ocho horas. La API rechaza con `401` la ausencia de token, un token inválido o vencido, una sesión invalidada y usuarios inactivos.

La autorización se aplica en el servidor, antes de cada ruta protegida. El middleware carga los roles y permisos del usuario y `requirePermission` devuelve `403` cuando el permiso no existe. Además, las operaciones radiográficas restringen a cada odontólogo a los pacientes que tiene asignados; el administrador conserva el acceso administrativo autorizado. Ocultar controles en el cliente no concede acceso a la API.

Las contraseñas se almacenan con hash bcrypt y factor de costo 12. La clave de firma JWT, la URL de PostgreSQL y las demás claves se cargan desde `backend/.env` o desde las variables configuradas en el despliegue. El archivo `.env` está excluido del repositorio; `backend/.env.example` declara solo los nombres de las variables.

La API valida los cuerpos de las solicitudes y devuelve `400` para solicitudes incompletas y `422` para datos que no cumplen el formato o las reglas. Las rutas de API no almacenan respuestas en caché, limitan el tamaño JSON y el inicio de sesión está limitado a diez intentos por minuto. Helmet define cabeceras HTTP de protección y el despliegue se consume por HTTPS.

El flujo radiográfico usa tokens temporales aleatorios de un solo uso, conserva solamente su hash SHA-256 y rechaza accesos vencidos, revocados o usados. La carga acepta PDF, PNG, JPEG y WebP de hasta 10 MB; se verifica tipo, firma y tamaño. Los archivos y las solicitudes siguen necesitando una sesión y una autorización válida para su consulta interna.

## 2.8 Pruebas

Las pruebas unitarias cubren validación de datos, cálculos de facturas y defensa contra identificadores SQL inválidos. Las pruebas de integración ejecutan la API con PostgreSQL en memoria, cubren autenticación, permisos, empresas, pacientes y el flujo radiográfico. La evidencia automatizada se genera con `npm run test:report`; ejecuta cada archivo en serie y guarda el resultado en `evidencia/reporte-pruebas-e3.txt`.

| ID | Escenario | Esperado | Obtenido | Estado |
|---|---|---|---|---|
| CP-01 | Login válido (RF-01) | 200 y JWT vigente | Prueba de integración aprobada; falta figura de producción | Aprobado en automatizada |
| CP-02 | Login sin credenciales (RF-01) | 400 y mensaje controlado | `backend/test/http.test.js`; reporte E3 | Aprobado |
| CP-03 | Ruta protegida sin token | 401 | `backend/test/integration.test.js` y `backend/test/radiography.test.js`; reporte E3 | Aprobado |
| CP-04 | Rol sin permiso para auditoría radiográfica | 403 | `backend/test/radiography.test.js`; reporte E3 | Aprobado |
| CP-05 | Registro válido de paciente (RF-02) | 201 y registro persistido | Prueba de integración aprobada; falta figura de producción | Aprobado en automatizada |
| CP-06 | Archivo radiográfico inválido | 422 | `backend/test/radiography.test.js`; reporte E3 | Aprobado |
| CP-07 | Crear solicitud radiográfica (RF-03) | 201 y solicitud asociada al paciente | Prueba radiográfica aprobada; falta figura de producción | Aprobado en automatizada |
| CP-08 | Generar acceso temporal (RF-04) | 201 con URL, QR y vencimiento | Prueba radiográfica aprobada; falta figura de producción | Aprobado en automatizada |
| CP-09 | Usar enlace temporal vencido | 410 | `backend/test/radiography.test.js`; reporte E3 | Aprobado |
| CP-10 | Salud en producción | 200 solo cuando PostgreSQL responde | `backend/test/http.test.js`; falta comprobación tras desplegar | Aprobado en automatizada |

Para las pruebas funcionales se debe registrar una figura fechada de cada Must en la URL pública. Para rendimiento, medir `GET /api/v1/salud` o una consulta Must en producción y anotar la herramienta, fecha, URL, cantidad de registros y duración observada.

## Datos de prueba para la entrega

El script `npm run db:seed:e3-users` crea o actualiza de forma idempotente estas cuentas ficticias, sin cargar pacientes ni datos demo:

| Rol | Correo | Contraseña |
|---|---|---|
| Super Admin | `admin.e3@proyecto.test` | `Admin-E3-2026!` |
| Doctor | `odontologa.e3@proyecto.test` | `Odonto-E3-2026!` |

No se deben incluir `DATABASE_URL`, `JWT_SECRET` ni el contenido de `.env` en el PDF o Moodle.
