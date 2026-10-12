from pathlib import Path
import zipfile,re

root=Path(__file__).resolve().parent.parent
folder=root/'docs/monografia-corregida'
package=root/'docs/entrega-monografia-corregida.zip'
assets={
 '../diagramas/casos_de_uso.pdf':root/'docs/diagramas/casos_de_uso.pdf',
 '../diagramas/arquitectura.pdf':root/'docs/diagramas/arquitectura.pdf',
 '../diagramas/modelo_datos.pdf':root/'docs/diagramas/modelo_datos.pdf',
}
for name in ['login-prueba.png','pacientes-prueba.png','portal-cerpax-prueba.png','solicitudes-prueba.png','http-200.png','http-401.png','http-403.png','http-422.png']:
 assets['../../evidencia/'+name]=root/'evidencia'/name
with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED) as archive:
 for name in ['monografia.tex','seguridad-y-pruebas.tex']:
  text=(folder/name).read_text(encoding='utf-8')
  for old,path in assets.items():text=text.replace(old,'assets/'+path.name)
  assert not re.search(r'Admin-E3|Odonto-E3|Testing-only|eyJ[A-Za-z0-9_-]+\.',text)
  archive.writestr(name,text)
 for path in assets.values():archive.write(path,'assets/'+path.name)
 for name in ['monografia.pdf','seguridad-y-pruebas.pdf','EscudoUajms.png','bibliografia.bib']:
  archive.write(folder/name,name)
 for name in ['reporte-pruebas-e3.txt','seguridad-http.json','evidencias-navegador.json','evidencias-seguridad.html','evidencias-seguridad.pdf','verificacion-despliegue.json']:
  archive.write(root/'evidencia'/name,'evidencia/'+name)
 archive.writestr('LEEME.txt','''Copia corregida de la monografía; archivo original conservado.

Abra monografia.pdf para revisar el documento completo o seguridad-y-pruebas.pdf para revisar únicamente 2.7 y 2.8.
Para editar: monografia.tex. Descomprima todo el ZIP, conservando assets/.
Compile con LuaLaTeX, Biber, LuaLaTeX y LuaLaTeX desde esta carpeta.

Resultados: 31 pruebas del backend aprobadas, 0 fallidas. Un escenario adicional de navegador aprobado con 15 respuestas HTTP verificadas. El informe de seguridad contiene 22 comprobaciones; los contadores se superponen y no se suman.

Las evidencias de seguridad son locales con datos sintéticos. La verificación de producción fue de lectura; falta publicar esta revisión y comprobar la entrega completa a Supabase Storage en Vercel. Esa prueba no se presentó como aprobada.
No se incorporaron pruebas de Flutter ni credenciales de acceso al documento.
''')
with zipfile.ZipFile(package) as archive:assert archive.testzip() is None
print(f'{package.name}: {package.stat().st_size} bytes; archivo ZIP verificado.')
