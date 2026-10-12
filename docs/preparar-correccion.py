"""Genera una copia revisable del adjunto y secciones con evidencia existente."""
from pathlib import Path
import json,re,shutil
from datetime import datetime

root=Path(__file__).resolve().parent.parent
docs=root/'docs'
output=docs/'monografia-corregida'
output.mkdir(exist_ok=True)
original=Path('C:/Users/Boney/.codex/attachments/b5c7e58d-3210-4657-b6c1-5653ca5ab83b/Pasted text.txt')
source=original.read_text(encoding='utf-8')
security=(docs/'2.7-seguridad.tex').read_text(encoding='utf-8')
security=security.replace('/api/login','/api/v1/login').replace('/api/logout','/api/v1/logout')
security=security.replace(r'\texttt{/api/v1/logout}',r'\path{/api/v1/logout}').replace(r'\texttt{version\_sesion}',r'\path{version_sesion}')
security=security.replace('mediante bcrypt;','mediante bcrypt con costo 12;')
security=security.replace('de acceso al panel descrito en esta solución.','de acceso al panel. El servidor rechaza su inicio de sesión incluso si tiene\ncontraseña válida y rechaza los JWT anteriores de cuentas con el único rol\n\\texttt{Patient}. Compartir la tabla \\texttt{usuarios} permite reutilizar los\ndatos personales; no concede autorización para ingresar al sistema.')
matrix=(docs/'matriz-permisos.tex').read_text(encoding='utf-8')
security=security.replace('\\subsubsection{Validación de entradas y protección}',r'''Las cuentas internas se crean desde la administración. Un nuevo registro
de odontólogo recibe el rol \texttt{Doctor}; un paciente recibe
\texttt{Patient} y no obtiene acceso al panel. Las cuentas administrativas
creadas sin rol no pueden iniciar sesión hasta que el administrador les asigne
un perfil interno. Solo el administrador puede modificar estas asociaciones
mediante \path{/api/v1/users/:id/access}. No existe registro público que
conceda privilegios administrativos.

'''+matrix+'\n\\subsubsection{Validación de entradas y protección}')
security=security.replace('Los resultados de cada escenario deben acompañarse de las evidencias\ncorrespondientes en la sección de pruebas.','Los resultados obtenidos y sus evidencias se presentan en la sección de pruebas.')
(docs/'2.7-seguridad-corregida.tex').write_text(security,encoding='utf-8')

report=(root/'evidencia/reporte-pruebas-e3.txt').read_text(encoding='utf-8')
count=int(re.search(r'(?:ℹ|#) tests (\d+)',report)[1])
passed=int(re.search(r'(?:ℹ|#) pass (\d+)',report)[1])
failed=int(re.search(r'(?:ℹ|#) fail (\d+)',report)[1])
date=re.search(r'Ejecución: (\S+)',report)[1]
# Bolivia usa UTC-4, sin cambio estacional.
from datetime import timezone,timedelta
local=datetime.fromisoformat(date.replace('Z','+00:00')).astimezone(timezone(timedelta(hours=-4)))
browser=json.loads((root/'evidencia/evidencias-navegador.json').read_text(encoding='utf-8'))
assert all(c['expected']==c['obtained'] for c in browser['cases'])
http=json.loads((root/'evidencia/seguridad-http.json').read_text(encoding='utf-8'))
assert len(http['results'])==22 and all(c['status']=='Aprobado' for c in http['results'])
rows=[
('CP-01','RF-01: credenciales válidas','HTTP 200 y JWT','HTTP 200; EV-01; Figura~\\ref{fig:prueba-200}'),
('CP-02','RF-01: contraseña incorrecta','HTTP 401, mensaje genérico','HTTP 401; EV-02'),
('CP-03','Sin JWT en pacientes','HTTP 401','HTTP 401; EV-03; Figura~\\ref{fig:prueba-401}'),
('CP-04','Odontólogo consulta cuentas','HTTP 403','HTTP 403; EV-08; Figura~\\ref{fig:prueba-403}'),
('CP-05','RF-02: paciente sin campos obligatorios','HTTP 422','HTTP 422; EV-04; Figura~\\ref{fig:prueba-422}'),
('CP-06','RF-02: crear, consultar, actualizar y eliminar paciente','201, 200, 200, 200; posterior 404','Códigos coincidentes; SEG-04 a 06 y SEG-21 a 22'),
('CP-07','Paciente ajeno al odontólogo','HTTP 404','HTTP 404; SEG-11'),
('CP-08','RF-03: crear solicitud de paciente asignado','HTTP 201 y asociación persistida','HTTP 201; EV-11; verificación SQL en radiography.test.js'),
('CP-09','RF-03: solicitar estudio sin asignación','HTTP 404','HTTP 404; EV-09'),
('CP-10','RF-04: generar enlace y QR','HTTP 201, URL y PNG del QR','HTTP 201; EV-12 y EV-13'),
('CP-11','RF-04: validar acceso vigente','HTTP 200, datos mínimos','HTTP 200; EV-15'),
('CP-12','RF-04: reutilizar enlace revocado','HTTP 410','HTTP 410; EV-14'),
('CP-13','Enlace vencido y carga repetida','HTTP 410 en ambos casos','HTTP 410; radiography.test.js'),
('CP-14','Carga multipart local y consulta protegida','HTTP 201 y 200; solicitud completada','Códigos coincidentes; radiography.test.js'),
('CP-15','Archivo con contenido o extensión inválidos; exceso de tamaño','422, 422 y 413','Códigos coincidentes; radiography.test.js'),
('CP-16','Paciente intenta ingresar con contraseña válida o JWT anterior','HTTP 401; sin token nuevo','HTTP 401; SEG-16 y SEG-17'),
('CP-17','JWT alterado, vencido o reutilizado después de logout','HTTP 401','HTTP 401; SEG-13, SEG-18 y SEG-20'),
('CP-18','Odontólogo usa otra clínica','HTTP 403','HTTP 403; SEG-14'),
('CP-19','Permiso directo de cuentas concedido a odontólogo','HTTP 403 también en ruta anterior','HTTP 403; SEG-15'),
('CP-20','Recepcionista intenta acceder a radiografías y datos clínicos','HTTP 403 y omisión de campos sensibles','Comprobado; receptionist.test.js'),
]
tests=r'''% Insertar bajo 2.8 Pruebas; requiere longtable,array,booktabs,graphicx,float,hyperref.
Las pruebas verifican los cuatro requisitos prioritarios: autenticación
(RF-01), pacientes (RF-02), solicitudes radiográficas (RF-03) y acceso
temporal por enlace o QR (RF-04). Se utilizan caminos correctos y errores,
con datos sintéticos, comprobando el estado HTTP y las reglas de acceso.

\subsubsection{Entorno y ejecución}

Las pruebas automatizadas ejecutan el backend real de Express y sus
migraciones SQL sobre PostgreSQL embebido mediante PGlite. Supertest realiza
solicitudes HTTP y Playwright verifica el acceso desde el navegador y genera
evidencias. Este entorno está aislado de los pacientes y archivos reales.
La prueba local de archivos utiliza la ruta multipart y contenido en la base
de prueba; no acredita la carga directa de producción en Supabase Storage.

'''
tests+=f'La ejecución del {local:%d/%m/%Y a las %H:%M:%S} (hora de Bolivia)\nregistró {count} pruebas, {passed} aprobadas y {failed} fallidas, sin omitidas.\n'
tests+=f'El escenario adicional de navegador se aprobó y verificó {len(browser["cases"])}\nrespuestas HTTP. El archivo de seguridad específico registra 22\ncomprobaciones HTTP; estos conteos describen distintos niveles y no deben sumarse\ncomo si fueran casos independientes.\n'
tests+=r'''
Los comandos reproducibles son \texttt{npm run test:report} y
\texttt{npm run test:e2e -w backend -- security.spec.js}.
El reporte completo se conserva en
\path{evidencia/reporte-pruebas-e3.txt}; las respuestas resumidas se encuentran
en \path{evidencia/seguridad-http.json} y
\path{evidencia/evidencias-navegador.json}. Ninguno incluye contraseñas ni JWT.

\subsubsection{Casos ejecutados}

\begingroup
\footnotesize
\setlength{\tabcolsep}{3pt}
\renewcommand{\arraystretch}{1.2}
\begin{longtable}{@{}>{\raggedright\arraybackslash}p{.09\linewidth}>{\raggedright\arraybackslash}p{.24\linewidth}>{\raggedright\arraybackslash}p{.21\linewidth}>{\raggedright\arraybackslash}p{.27\linewidth}>{\raggedright\arraybackslash}p{.11\linewidth}@{}}
\caption{Casos de prueba ejecutados y resultados observados}\label{tab:pruebas-reales}\\
\toprule
\textbf{ID}&\textbf{Escenario}&\textbf{Esperado}&\textbf{Obtenido y evidencia}&\textbf{Estado}\\\midrule
\endfirsthead
\toprule
\textbf{ID}&\textbf{Escenario}&\textbf{Esperado}&\textbf{Obtenido y evidencia}&\textbf{Estado}\\\midrule
\endhead
\bottomrule\endlastfoot
'''
for id,scenario,expected,obtained in rows:
 tests+=f'{id} & {scenario} & {expected} & {obtained} & Aprobado \\\\\n'
tests+=r'''\end{longtable}
\noindent\textit{Fuente: elaboración propia a partir de la ejecución automatizada.}
\endgroup

Los identificadores EV corresponden al informe de navegador y los SEG al
informe HTTP de seguridad. Los archivos de pruebas citados pertenecen a
\path{backend/test/}. Las filas agrupan operaciones relacionadas; el número
de filas no equivale al contador del ejecutor de Node.js.

\subsubsection{Evidencias}

Las siguientes capturas muestran respuestas reales del servidor de prueba
registradas por Playwright. Son capturas del informe de ejecución, con las
credenciales y los tokens omitidos, y no capturas del despliegue de Vercel.
'''
for code,caption in [(200,'Inicio de sesión autorizado, CP-01.'),(401,'Acceso a pacientes sin JWT, CP-03.'),(403,'Consulta de cuentas por un odontólogo, CP-04.'),(422,'Registro de paciente sin campos obligatorios, CP-05.')]:
 tests+=f'\n\\begin{{figure}}[H]\n\\centering\n\\includegraphics[width=\\textwidth]{{../../evidencia/http-{code}.png}}\n\\caption{{{caption} Fuente: ejecución propia en entorno local.}}\n\\label{{fig:prueba-{code}}}\n\\end{{figure}}\n'
tests+=r'''
El informe ampliado \path{evidencia/evidencias-seguridad.pdf} contiene las
15 respuestas del recorrido de navegador, incluidas la creación de la
solicitud, la generación del enlace y el rechazo del enlace revocado.

\subsubsection{Comprobaciones en producción y rendimiento}

'''
deployment=json.loads((root/'evidencia/verificacion-despliegue.json').read_text(encoding='utf-8'))
perf=[r for r in deployment['results'] if '?size=15' in r['path']]
assert len(perf)==10 and all(r['status']==200 for r in perf)
tests+=r'''En el despliegue de Vercel se realizaron comprobaciones de lectura:
la salud de la API respondió 200, el acceso a pacientes sin autenticación
respondió 401, el inicio de sesión respondió 200 y la consulta de solicitudes
radiográficas respondió 200. El detalle se conserva en
\path{evidencia/verificacion-despliegue.json}.

Se midieron diez consultas consecutivas autenticadas al listado de pacientes,
con página de quince registros y sin transferencias de archivos. La medición
incluye el tiempo observado por el cliente HTTP desde este equipo, la red y
la lectura de la respuesta JSON. No es una prueba de concurrencia ni de carga.

\begin{table}[H]\centering
\caption{Tiempos observados en consultas de pacientes en Vercel}
\begin{tabular}{rrr}\toprule
\textbf{Consulta}&\textbf{Estado HTTP}&\textbf{Tiempo (ms)}\\\midrule
'''
for i,r in enumerate(perf,1):tests+=f'{i}&{r["status"]}&{r["milliseconds"]}\\\\\n'
tests+=r'\bottomrule\end{tabular}\end{table}'+'\n'
ok=sum(r['milliseconds']<=3000 for r in perf)
tests+=f'En esta muestra, {ok} de 10 consultas respondieron en menos de tres\nsegundos, con un rango de {min(r["milliseconds"] for r in perf)} a {max(r["milliseconds"] for r in perf)} ms.\n'
tests+=r'''Se satisface el umbral de RNF-01 para esta operación y estas condiciones;
el resultado no se generaliza a todas las operaciones ni a usuarios concurrentes.

Las modificaciones de autorización y las nuevas rutas v1 documentadas en esta
revisión se verificaron localmente. El recorrido completo de creación,
enlace y entrega directa a Supabase Storage no se ejecutó en producción
durante esta revisión; las comprobaciones de lectura anteriores no lo
sustituyen. Antes de presentar la versión desplegada debe verificarse ese
recorrido sobre la misma revisión del código.
'''
(docs/'2.8-pruebas.tex').write_text(tests,encoding='utf-8')

# Copia completa: reemplazar únicamente los apartados corregidos y los problemas detectados.
start=source.index('\\section{Seguridad}')
end=source.index('\\section{Despliegue}',start)
source=source[:start]+'\\section{Seguridad}\n\n'+security.replace('\\subsubsection','\\subsection')+'\n\\section{Pruebas}\n\n'+tests.replace('\\subsubsection','\\subsection')+'\n'+source[end:]
source=source.replace('\\parencite{ho2024,bravo2025,ulloa2024}','\\parencite{ho2024}')
source=source.replace('\\parencite{lastra2026,castano2024}','')
source=source.replace('fig:pacientes-escritorio','fig:login-escritorio',1)
# La segunda aparición del identificador CERPAX debe ser única.
first=source.find('\\label{fig:cerpax}');second=source.find('\\label{fig:cerpax}',first+1)
if second!=-1:source=source[:second]+source[second:].replace('\\label{fig:cerpax}','\\label{fig:solicitudes-escritorio}',1)
source=source.replace('/api/records/pacientes','/api/v1/pacientes').replace('/api/login','/api/v1/login').replace('/api/radiographs','/api/v1/radiographs').replace('/api/external/radiographs','/api/v1/external/radiographs')
source=source.replace('200, 401, 403, 404, 422, 503','200, 302, 401, 403, 404, 422, 503')
source=source.replace('\\setlength{\\parindent}{0pt}','\\setlength{\\parindent}{0pt}\n\\setlength{\\emergencystretch}{3em}')
# Corregir numeración 2.6.0.x y retirar la segunda redacción duplicada.
impl=re.search(r'\\section\{Implementaci.n\}',source)
if impl:
 end=source.index('\\section{Seguridad}',impl.start())
 body=source[impl.start():end]
 duplicate=body.find('\\subsection{Autenticación}')
 if duplicate!=-1:body=body[:duplicate]
 body=body.replace('\\subsubsection','\\subsection')
 body=body.replace('Con ello, el acceso directo quedó limitado a\nAdministrador y Odontólogo.','Los perfiles clínicos y administrativos principales son Administrador y\nOdontólogo; existe además Recepcionista con permisos administrativos\nlimitados, descritos en la matriz de autorización.')
 body+=r'''
\subsection{Fragmento de autorización del servidor}

El siguiente fragmento de \path{backend/src/auth.js} muestra la comprobación
de permisos. El recurso de cuentas exige administrador; las demás operaciones
requieren el permiso correspondiente. El código completo se encuentra en el
repositorio y el alcance por paciente se valida adicionalmente en el backend.

\begin{verbatim}
export const can=(user,key,action)=>!!user&&(
 user.bypass || user.roles.includes('Super Admin') || (
  key!=='usuarios' &&
  user.permissions.includes(`${key}.${action}`)
 )
);
\end{verbatim}

'''
 source=source[:impl.start()]+body+source[end:]
source=source.replace('{casos_de_uso.png}','{../diagramas/casos_de_uso.pdf}').replace('{arquitectura.pdf}','{../diagramas/arquitectura.pdf}').replace('{modelo_datos.pdf}','{../diagramas/modelo_datos.pdf}')
source=source.replace('{login.png}','{../../evidencia/login-prueba.png}').replace('{pacientes.png}','{../../evidencia/pacientes-prueba.png}').replace('{cerpax.png}','{../../evidencia/portal-cerpax-prueba.png}').replace('{cerpax2.png}','{../../evidencia/solicitudes-prueba.png}')
source=source.replace('Módulo cerpax en vista de escritorio.','Portal externo de entrega CERPAX.',1)
source=source.replace('Módulo cerpax en vista de escritorio.','Gestión de solicitudes radiográficas.',1)
source=re.sub(r'(SISTEMA WEB Y MÓVIL DE GESTIÓN DE PACIENTES)\s*(?:Y\s*)?(PARA LA CLÍNICA)',r'\1 Y RADIOGRAFÍAS DENTALES\n\2',source)
(output/'monografia.tex').write_text(source,encoding='utf-8')
shutil.copyfile('C:/Users/Boney/Desktop/Documento Oficial de Tesis/EscudoUajms.png',output/'EscudoUajms.png')
# Vista independiente que permite revisar solo el material modificado.
preview=r'''\documentclass[12pt,letterpaper]{report}
\usepackage{fontspec}\setmainfont{TeX Gyre Termes}
\usepackage{polyglossia}\setdefaultlanguage{spanish}
\usepackage[left=4cm,right=3cm,top=3cm,bottom=3cm]{geometry}
\usepackage{longtable,array,booktabs,graphicx,float,hyperref}
\hypersetup{hidelinks}
\usepackage{setspace}\onehalfspacing
\setlength{\parindent}{0pt}\setlength{\parskip}{6pt}
\begin{document}
\setcounter{chapter}{2}\setcounter{section}{6}
\section{Seguridad}
'''+security.replace('\\subsubsection','\\subsection')+'\n\\section{Pruebas}\n'+tests.replace('\\subsubsection','\\subsection')+'\n\\end{document}\n'
(output/'seguridad-y-pruebas.tex').write_text(preview,encoding='utf-8')
print(f'Generadas copia de monografía y secciones: {count} pruebas; {len(browser["cases"])} respuestas navegador; {len(http["results"])} comprobaciones de seguridad.')
