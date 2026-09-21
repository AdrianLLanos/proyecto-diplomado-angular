# Flujo de radiografías San Martín / CERPAX

## Instalación y demostración

1. Ejecutar `npm run db:migrate` en `clinica-angular`. Aplica `04-radiografias.sql` sin borrar datos. Si la instalación original se hizo manualmente y no hay historial, ejecutar únicamente `database/04-radiografias.sql` en esa base; no repetir 01/02.
2. Crear el odontólogo desde Médicos y el paciente desde Pacientes. Como administrador, abrir **Radiografías / CERPAX → Asignar pacientes** y vincularlos. Los pacientes creados por un odontólogo quedan asignados a ese profesional automáticamente.
3. En **Solicitudes**, seleccionar paciente, odontólogo responsable (administrador), tipo e indicaciones. Crear la solicitud.
4. Pulsar **Enlace / QR**, elegir vigencia de 1 a 72 horas y generar. Cada enlace nuevo invalida los anteriores. También se puede revocar o cancelar una solicitud pendiente.
5. Abrir el enlace en una ventana privada como CERPAX. Subir un PDF, PNG, JPEG o WebP de hasta 10 MB. El acceso permite una sola carga y no muestra el nombre ni el expediente del paciente.
6. Como odontólogo autorizado, abrir la solicitud completada y visualizar/descargar. Ver la confirmación en **Notificaciones** (actualización cada 30 segundos mientras está abierto el módulo). El administrador puede filtrar **Trazabilidad** por paciente y fecha.

Para probar permisos reales: configurar `LOCAL_ACCESS=false` y `ENFORCE_ROLES=true`, reiniciar Node y utilizar cuentas separadas. El acceso local administrativo permanece habilitado si así estaba configurado; no es una prueba de seguridad por roles. Los odontólogos existentes pierden acceso a pacientes no asignados hasta que el administrador los vincule; no se conceden accesos masivos automáticamente.

## Acceso desde CERPAX

`APP_URL` debe ser la dirección de Angular accesible por el destinatario. `127.0.0.1` solo funciona en el mismo equipo. Para uso fuera de la clínica, desplegar frontend/API con HTTPS y configurar esa URL antes de generar enlaces. Compartir un enlace/QR es una acción manual: el sistema no envía mensajes a CERPAX automáticamente.

## Arquitectura y datos

Angular + Material → API Express → PostgreSQL/Supabase. Las radiografías se guardan como BYTEA privado en PostgreSQL para que archivo, estado y consumo del token sean atómicos. No hay URL pública de descarga ni se utiliza la tabla genérica de adjuntos para estas radiografías. Esta decisión requiere considerar el tamaño de la base y sus copias de respaldo; no sustituye un visor DICOM. Se validan firma de tipo, extensión, tamaño y vigencia; no hay diagnóstico automático ni análisis antivirus.

Tablas nuevas: `pacientes_odontologos`, `solicitudes_radiografias`, `accesos_radiografias`, `radiografias`, `eventos_radiografias`, `notificaciones_radiografias`. Todas tienen RLS habilitado; el navegador accede mediante Node, no con el usuario propietario de PostgreSQL. Los tokens son aleatorios, se almacenan con SHA-256 y viajan en el fragmento del enlace (no en la ruta de la página). La API recibe el token en el cuerpo de la petición. Una transacción con bloqueo impide consumir dos veces una solicitud. La auditoría no tiene endpoints de modificación y un trigger impide UPDATE/DELETE. Un propietario de base de datos aún puede alterar el esquema: no equivale a un registro criptográfico externo.

La notificación es interna, dirigida al solicitante. Si su registro falla, un savepoint conserva la radiografía y registra el fallo en auditoría; la solicitud completada continúa visible.

## Contrato API

| Método / ruta | Acceso | Resultado |
| --- | --- | --- |
| GET /api/radiographs | radiografias.read + paciente asignado | Listado paginado; filtros paciente y estado |
| POST /api/radiographs | radiografias.create + asignación | 201, solicitud pendiente |
| POST /api/radiographs/:id/access | radiografias.update + asignación | 201, enlace, QR, vencimiento |
| POST /api/radiographs/:id/revoke | radiografias.update + asignación | Revoca enlaces |
| POST /api/radiographs/:id/cancel | radiografias.update + asignación | Cancela solicitud pendiente |
| POST /api/external/radiographs/access | Token en JSON | Tipo de estudio, número y vigencia |
| POST /api/external/radiographs/upload | Token y file en multipart | 201, carga completada |
| GET /api/radiographs/:id/file | radiografias.read + asignación | Archivo privado; download=1 para descargar |
| GET /api/radiography-audit | radiografias.audit | Historial paginado por paciente, desde, hasta |
| GET /api/radiography-notifications | radiografias.read | Notificaciones propias autorizadas |
| POST /api/radiography-notifications/:id/read | Propietario | Marca como leída |
| GET/POST /api/patient-assignments | Administrador | Consulta/crea asignaciones |
| DELETE /api/patient-assignments/:patient/:doctor | Administrador | Retira autorización |

Errores: 401 sin sesión, 403 sin permiso, 404 registro no accesible, 409 estado incompatible, 410 enlace vencido/revocado/utilizado, 413 tamaño excedido, 422 datos o archivo inválidos, 429 exceso de intentos. No se revela la existencia de expedientes ajenos.

## Evidencias y límites de la validación

`npm test` prueba instalación, asignación, separación entre odontólogos/empresas, solicitudes, vencimiento/revocación, firmas y tamaños de archivo, una sola carga, consulta privada, notificaciones y auditoría. La prueba de navegador recorre el flujo con datos sintéticos en una base temporal.

Esto no certifica todavía las métricas académicas de 2.3: quedan las sesiones de usabilidad con participantes, mediciones con datos y red representativos, compatibilidad en las versiones acordadas, monitoreo de disponibilidad y una restauración documentada del despliegue. Las pruebas locales no se presentan como validación en CERPAX.
