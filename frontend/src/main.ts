import {bootstrapApplication} from '@angular/platform-browser';
import {provideHttpClient,withInterceptors} from '@angular/common/http';
import {provideRouter} from '@angular/router';
import {LOCALE_ID} from '@angular/core';
import {registerLocaleData} from '@angular/common';
import localeEs from '@angular/common/locales/es';
import {MatPaginatorIntl} from '@angular/material/paginator';
import {App} from './app/app';
import {authInterceptor} from './app/api';
registerLocaleData(localeEs);
const paginator=new MatPaginatorIntl();paginator.itemsPerPageLabel='Registros por página';paginator.nextPageLabel='Página siguiente';paginator.previousPageLabel='Página anterior';paginator.firstPageLabel='Primera página';paginator.lastPageLabel='Última página';paginator.getRangeLabel=(p,s,n)=>n===0?'0 registros':`${p*s+1} – ${Math.min((p+1)*s,n)} de ${n}`;
bootstrapApplication(App,{providers:[provideHttpClient(withInterceptors([authInterceptor])),{provide:LOCALE_ID,useValue:'es'},{provide:MatPaginatorIntl,useValue:paginator},provideRouter([
  {path:'radiografias',loadComponent:()=>import('./app/radiography').then(m=>m.Radiography)},
  {path:'carga-radiografia',loadComponent:()=>import('./app/external-radiography').then(m=>m.ExternalRadiography)},
  {path:'dashboard',loadComponent:()=>import('./app/dashboard').then(m=>m.Dashboard)},
  {path:'modulos/:key',loadComponent:()=>import('./app/records').then(m=>m.Records)},
  {path:'reportes',loadComponent:()=>import('./app/reports').then(m=>m.Reports)},
  {path:'login',loadComponent:()=>import('./app/login').then(m=>m.Login)},
  {path:'perfil',loadComponent:()=>import('./app/profile').then(m=>m.Profile)},
  {path:'configuracion',loadComponent:()=>import('./app/settings').then(m=>m.Settings)},
  {path:'roles',loadComponent:()=>import('./app/roles').then(m=>m.Roles)},
  {path:'sitio/:page',loadComponent:()=>import('./app/public-site').then(m=>m.PublicSite)},
  {path:'recuperar',loadComponent:()=>import('./app/password-reset').then(m=>m.PasswordReset)},
  {path:'restablecer',loadComponent:()=>import('./app/password-reset').then(m=>m.PasswordReset)},
  {path:'',pathMatch:'full',redirectTo:'sitio/home'},
  {path:'**',redirectTo:'dashboard'},
])]}).catch(console.error);
