import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router,RouterLink,RouterLinkActive,RouterOutlet,NavigationEnd} from '@angular/router';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MATERIAL} from './material';
import {Api,Module,Session,errorText} from './api';
@Component({selector:'app-root',standalone:true,imports:[CommonModule,RouterLink,RouterLinkActive,RouterOutlet,MatSidenavModule,...MATERIAL],template:`
  @if(isPublic()){<router-outlet/>} @else {
  <mat-sidenav-container class="app-shell">
    <mat-sidenav #nav [mode]="compact?'over':'side'" [opened]="!compact" class="sidebar">
      <a routerLink="/dashboard" class="brand"><span class="brand-mark"><mat-icon>health_and_safety</mat-icon></span><span>Clínica Dental<small>Gestión integral</small></span></a>
      <div class="nav-section"><a routerLink="/dashboard" routerLinkActive="active" class="nav-item" (click)="compact&&nav.close()"><mat-icon>space_dashboard</mat-icon>Resumen</a></div>
      @if(api.can('radiografias')){<div class="nav-section"><a routerLink="/radiografias" routerLinkActive="active" class="nav-item"><mat-icon>medical_information</mat-icon>Radiograf?as / CERPAX</a></div>}
      @for(group of groups;track group){<div class="nav-section"><p>{{group}}</p>@for(m of modules();track m.key){@if(m.group===group){<a [routerLink]="['/modulos',m.key]" routerLinkActive="active" class="nav-item" (click)="compact&&nav.close()"><mat-icon>{{m.icon}}</mat-icon>{{m.label}}</a>}}</div>}
      <div class="nav-section">@if(api.can('reportes')){<a routerLink="/reportes" routerLinkActive="active" class="nav-item"><mat-icon>bar_chart</mat-icon>Reportes financieros</a>}<a routerLink="/perfil" routerLinkActive="active" class="nav-item"><mat-icon>person</mat-icon>Mi perfil</a>@if(api.can('ajustes')){<a routerLink="/configuracion" class="nav-item"><mat-icon>settings</mat-icon>Ajustes generales</a>}@if(api.can('roles')){<a routerLink="/roles" class="nav-item"><mat-icon>admin_panel_settings</mat-icon>Roles y permisos</a>}<a routerLink="/sitio/home" class="nav-item"><mat-icon>public</mat-icon>Ver sitio público</a></div>
      <div class="sidebar-foot"><span class="status-dot"></span>Espacio de la clínica</div>
    </mat-sidenav>
    <mat-sidenav-content>
      <header class="topbar"><div class="topbar-left"><button mat-icon-button (click)="nav.toggle()" aria-label="Abrir menú"><mat-icon>menu</mat-icon></button><span>Panel de administración</span><mat-select class="company-select" aria-label="Empresa activa" [value]="currentCompany" (selectionChange)="switchCompany($event.value)">@for(c of companies();track c.id){<mat-option [value]="''+c.id">{{c.nombre}}</mat-option>}</mat-select></div><div class="profile"><div class="avatar">{{api.session()?.user?.nombre?.charAt(0)||'C'}}</div><div><strong>{{api.session()?.user?.nombre||'Clínica Dental'}}</strong><small>{{api.session()?.localAccess?'Acceso local':'Administrador'}}</small></div>@if(!api.session()?.localAccess){<button mat-icon-button (click)="logout()" aria-label="Cerrar sesión"><mat-icon>logout</mat-icon></button>}</div></header>
      <main>@if(error()){<div class="error-banner">{{error()}} <button mat-button (click)="initialize()">Reintentar</button></div>}<router-outlet/></main>
    </mat-sidenav-content>
  </mat-sidenav-container>}
`})
export class App {
  api=inject(Api);router=inject(Router);modules=signal<Module[]>([]);error=signal('');compact=window.innerWidth<1000;
  groups=['Clínica','Laboratorio','Finanzas','Comunicación','Configuración'];
  companies=signal<any[]>([]);currentCompany='';
  isPublic(){return this.router.url==='/'||/^\/(sitio|login|restablecer|recuperar|carga-radiografia)/.test(this.router.url);}
  constructor(){this.router.events.subscribe(e=>{if(e instanceof NavigationEnd&&!this.isPublic()&&!this.api.session())this.initialize();});}
  switchCompany(id:string){sessionStorage.setItem('clinica-company',String(id));window.location.reload();}
  initialize(){this.error.set('');this.api.get<Session>('/session').subscribe({next:s=>{this.api.session.set(s);this.currentCompany=String(s.companyId);this.api.get<any[]>('/companies').subscribe({next:c=>this.companies.set(c),error:e=>this.error.set(errorText(e))});this.api.catalog$.subscribe({next:m=>this.modules.set(m),error:e=>this.error.set(errorText(e))});},error:e=>{if(e.status!==401)this.error.set(errorText(e));}});}
  logout(){this.api.post('/logout',{}).subscribe({next:()=>{sessionStorage.clear();this.api.session.set(null);this.router.navigateByUrl('/login');},error:e=>this.error.set(errorText(e))});}
}
