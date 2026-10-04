# Diagrama UML de casos de uso

El diagrama representa exclusivamente el sistema web, conforme al apartado 1 de `Recomendaciones_E1_T2.txt`. Se contrastó con la tabla de requisitos de `Perfil-Diplomado.tex`, disponible en la misma carpeta de documentación del diplomado.

| Requisito | Caso de uso | Actor |
| --- | --- | --- |
| RF-01 | Gestionar cuentas autorizadas | Administrador |
| RF-02 | Registrar y consultar pacientes | Odontólogo |
| RF-03 | Crear solicitud de radiografía | Odontólogo |
| RF-04 | Generar enlace temporal o código QR | Odontólogo |
| RF-05 | Cargar radiografía mediante acceso temporal | CERPAX |
| RF-06 | Consultar radiografía | Odontólogo |
| RF-07 | Consultar trazabilidad | Administrador |
| RF-08 | Consultar estado de solicitud | Odontólogo |

Se incluye además **Iniciar sesión**, compartido por Administrador y Odontólogo: la autenticación aparece como precondición de los casos internos y el login está solicitado en la entrega E2. No se asigna un número RF inventado a esta función.

La gestión de pacientes se asocia al Odontólogo según RF-02; no se infieren permisos adicionales para el Administrador. CERPAX es una entidad externa que carga archivos mediante acceso temporal, no un tercer perfil interno. El paciente no tiene acceso propio.

Los tres actores se ubican fuera del límite del software. Las asociaciones UML son líneas continuas sin flechas; no representan secuencia ni relaciones «include» o «extend». El color es un recurso visual complementario, sin semántica UML añadida. Se mantiene el fondo blanco y la impresión en una página carta vertical.

La habilidad Archify se consultó para el trabajo. Sus esquemas instalados no admiten casos de uso UML, por lo que se utilizó una adaptación SVG/HTML. No se afirma validación nativa Archify. La verificación independiente en Chrome y las huellas SHA-256 están en `casos-de-uso.verificacion.json`.
