import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {MATERIAL} from './material';
import {Api,errorText} from './api';
@Component({standalone:true,imports:[CommonModule,RouterLink,...MATERIAL],template:`
  <div class="page-heading"><div><p class="eyebrow">TU CLÍNICA, EN UN SOLO LUGAR</p><h1>Resumen de actividad</h1><p>Consulta tus indicadores y organiza la atención del día.</p></div><a mat-flat-button routerLink="/modulos/citas"><mat-icon>add</mat-icon> Gestionar citas</a></div>
  @if(loading()){<mat-progress-bar mode="indeterminate"/>}@if(error()){<div class="error-banner">{{error()}} <button mat-button (click)="load()">Reintentar</button></div>}
  <section class="metrics">@for(m of data()?.metrics;track m.key){<a class="metric-card" [routerLink]="['/modulos',m.key]"><div class="metric-icon"><mat-icon>{{icons[m.key]}}</mat-icon></div><span>{{m.label}}</span><strong>{{m.value}}</strong><small>Ver registros <mat-icon>arrow_forward</mat-icon></small></a>}</section>
  <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Próximas citas</h2><p>La agenda de tus siguientes atenciones</p></div><a mat-button routerLink="/modulos/citas">Ver agenda <mat-icon>arrow_forward</mat-icon></a></div>
    @for(c of data()?.upcoming;track c.id){<a class="appointment" routerLink="/modulos/citas"><div class="date-badge"><strong>{{c.fecha_cita|date:'dd'}}</strong><small>{{c.fecha_cita|date:'MMM'}}</small></div><div><strong>{{c.paciente}}</strong><p>{{c.medico}}</p></div><span class="time-chip">{{c.hora_inicio.slice(0,5)}}</span></a>}
    @if(!loading()&&!data()?.upcoming?.length){<div class="empty-state"><mat-icon>event_available</mat-icon><h3>Tu agenda está libre</h3><p>Registra una cita para comenzar a organizar la atención.</p><a mat-stroked-button routerLink="/modulos/citas">Abrir citas</a></div>}
  </section><section class="panel quick-panel"><h2>Accesos rápidos</h2><p>Continúa con las tareas de tu clínica.</p><a routerLink="/modulos/pacientes"><mat-icon>person_add</mat-icon><span>Pacientes<small>Fichas y datos de contacto</small></span><mat-icon>chevron_right</mat-icon></a><a routerLink="/modulos/antecedentes"><mat-icon>assignment</mat-icon><span>Antecedentes<small>Información clínica del paciente</small></span><mat-icon>chevron_right</mat-icon></a><a routerLink="/modulos/facturas"><mat-icon>receipt_long</mat-icon><span>Facturación<small>Conceptos, importes y saldos</small></span><mat-icon>chevron_right</mat-icon></a><div class="care-note"><mat-icon>favorite</mat-icon><h3>Más tiempo para tus pacientes</h3><p>Mantén sus datos y el seguimiento de cada atención en un mismo espacio.</p></div></section></div>
`})
export class Dashboard {
  api=inject(Api);data=signal<any>(null);loading=signal(true);error=signal('');icons:Record<string,string>={pacientes:'groups',medicos:'medical_services',citas:'event',facturas:'receipt_long',recetas:'medication',informes:'science'};
  constructor(){this.load();}load(){this.loading.set(true);this.error.set('');this.api.get('/dashboard').subscribe({next:d=>{this.data.set(d);this.loading.set(false);},error:e=>{this.error.set(errorText(e));this.loading.set(false);}});}
}
