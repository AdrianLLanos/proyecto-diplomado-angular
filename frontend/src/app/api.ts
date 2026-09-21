import {inject,Injectable,signal} from '@angular/core';
import {HttpClient,HttpErrorResponse,HttpInterceptorFn} from '@angular/common/http';
import {Router} from '@angular/router';
import {catchError,shareReplay,throwError} from 'rxjs';
export interface Field {name:string;label:string;type:string;required:boolean;readOnly?:boolean;secret?:boolean;reference?:string;options?:string[];maxLength?:number;}
export interface Module {key:string;table:string;label:string;icon:string;group:string;fields:Field[];actions?:string[];}
export interface Row {[key:string]:any;id:string;}
export interface List {rows:Row[];total:number;}
export interface Session {user:{id:string;nombre:string;correo:string;roles:string[];permissions:string[];bypass?:boolean};localAccess:boolean;companyId:number;}
@Injectable({providedIn:'root'})
export class Api {
  private http=inject(HttpClient);
  session=signal<Session|null>(null);
  catalog$=this.http.get<Module[]>('/api/catalog').pipe(shareReplay({bufferSize:1,refCount:false}));
  get<T>(path:string,params:Record<string,string|number>={}){return this.http.get<T>('/api'+path,{params});}
  post<T>(path:string,body:unknown){return this.http.post<T>('/api'+path,body);}
  put<T>(path:string,body:unknown){return this.http.put<T>('/api'+path,body);}
  delete(path:string){return this.http.delete('/api'+path);}
  upload(file:File,publish=false){const body=new FormData();body.append('file',file);body.append('publico',String(publish));return this.http.post<{id:string;url:string;nombre:string;tipo:string}>('/api/files',body);}
  blob(path:string,params:Record<string,string>={}){return this.http.get('/api'+path,{params,responseType:'blob'});}
  can(key:string,action='read'){const u=this.session()?.user;return !!u&&(!!u.bypass||u.roles.includes('Super Admin')||u.permissions?.includes(key+'.'+action));}
  list(key:string,page=0,size=15,search=''){return this.get<List>('/records/'+key,{page,size,search});}
}
export const authInterceptor:HttpInterceptorFn=(req,next)=>{
  const router=inject(Router);const token=sessionStorage.getItem('clinica-token');const company=sessionStorage.getItem('clinica-company');
  const headers:Record<string,string>={};if(token)headers['Authorization']='Bearer '+token;if(company)headers['X-Company-ID']=company;
  return next(req.clone({setHeaders:headers})).pipe(catchError((e:HttpErrorResponse)=>{
    if(e.status===401&&!req.url.endsWith('/login')){sessionStorage.removeItem('clinica-token');router.navigateByUrl('/login');}
    return throwError(()=>e);
  }));
};
export const errorText=(e:any)=>{
  if(typeof e.error?.message==='string')return e.error.message;
  if(e.status===429)return 'Demasiados intentos. Espera un minuto y vuelve a intentar.';
  if(e.status===401)return 'Correo o contrase?a incorrectos.';
  if(e.status===403)return 'No tienes permiso para realizar esta acci?n.';
  if(e.status>=500)return 'El servidor no pudo completar la solicitud. Revisa la terminal del backend.';
  if(e.status===0)return 'No se pudo conectar con el servidor. Comprueba que Node.js est? iniciado.';
  return 'No se pudo completar la solicitud. Recarga la p?gina e intenta nuevamente.';
};
