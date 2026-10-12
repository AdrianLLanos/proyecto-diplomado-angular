La copia `monografia.tex` integra las correcciones de seguridad y pruebas del adjunto, sin modificar el archivo original. `monografia.pdf` permite revisarla completa; `seguridad-y-pruebas.pdf` contiene únicamente 2.7 y 2.8.

Cambios incorporados:

- Matriz de métodos, rutas y permisos de administrador, odontólogo, recepción y CERPAX.
- Explicación de bcrypt con costo 12, JWT de ocho horas, cierre de sesión e invalidación, validación y almacenamiento privado.
- Veinte casos documentados que cubren RF-01 a RF-04, respuestas 200/400/401/403/404/410/413/422 y controles de sesión.
- Ejecución del backend: 31 pruebas aprobadas, ninguna fallida. Además, 22 comprobaciones específicas de seguridad y un escenario de navegador con 15 respuestas verificadas; los contadores se superponen y no se suman.
- Capturas nuevas de las pantallas y de los resultados HTTP, con datos sintéticos y sin credenciales ni JWT.
- Diez mediciones reales del listado de pacientes en Vercel, con tiempos de 208 a 349 ms.
- Numeración de implementación, etiquetas duplicadas, citas inexistentes y redacción duplicada corregidas.

Cambios de código verificados localmente:

- Bloqueo del inicio de sesión y los JWT anteriores de cuentas con solo el rol Patient.
- Administración de cuentas reservada al administrador, incluso ante permisos directos concedidos al odontólogo.
- Rutas específicas `/api/v1/pacientes`, `/api/v1/odontologos`, `/api/v1/cuentas` y adaptación del frontend; las rutas anteriores conservan su autorización.
- Carga de Radiografías después de recibir la sesión, evitando listas vacías al abrir directamente la pantalla.

Alcance de la evidencia:

Las pruebas automatizadas utilizan Express real, migraciones SQL y PostgreSQL embebido mediante PGlite. Las pruebas de archivos locales cubren la ruta multipart; no demuestran una entrega completa a Supabase Storage desde Vercel. La verificación del despliegue fue de lectura y no modificó registros. Los cambios nuevos de código no se han publicado durante esta revisión.

Para cerrar la observación de producción del tutor, falta desplegar esta revisión y ejecutar el recorrido de solicitud, enlace/QR, entrega directa a Storage y consulta del archivo con un odontólogo autorizado. No se marcó esa verificación como aprobada. La aplicación Flutter no se incorporó al alcance de estas pruebas.

Compilación desde esta carpeta: LuaLaTeX, Biber, LuaLaTeX, LuaLaTeX sobre `monografia.tex`. Las rutas relativas utilizan `docs/diagramas/` y `evidencia/` del proyecto. El ZIP de entrega contiene una copia portátil con todos sus recursos.

Reproducción de pruebas desde la raíz:

```text
npm run build
npm run test:report
npm run test:e2e -w backend -- security.spec.js
```

Los informes están en `evidencia/reporte-pruebas-e3.txt`, `evidencia/seguridad-http.json`, `evidencia/evidencias-navegador.json`, `evidencia/evidencias-seguridad.pdf` y `evidencia/verificacion-despliegue.json`.
