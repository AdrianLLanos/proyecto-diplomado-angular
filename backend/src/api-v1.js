// Contrato público explícito; las rutas anteriores se conservan por compatibilidad.
const resources={pacientes:'pacientes',odontologos:'medicos',cuentas:'usuarios',citas:'citas',horarios:'horarios',antecedentes:'antecedentes',recetas:'recetas',smtp:'smtp',ajustes:'ajustes',aplicacion:'aplicacion'};
export function apiV1(req,res,next){
 if(!req.url.startsWith('/api/v1/'))return next();
 const match=req.url.match(/^\/api\/v1\/([^/?]+)(.*)$/);
 const [,resource,suffix]=match;
 if(resource==='records')return res.status(404).json({message:'Usa una ruta específica de la API v1'});
 req.url=resource==='salud'?'/api/health'+suffix:Object.hasOwn(resources,resource)?'/api/records/'+resources[resource]+suffix:'/api/'+resource+suffix;
 next();
}
