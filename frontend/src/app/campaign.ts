import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {Api,errorText} from './api';
import {MATERIAL} from './material';
@Component({standalone:true,imports:[CommonModule,FormsModule,...MATERIAL],template:`<h2 mat-dialog-title>Seguimiento de campaña</h2><mat-dialog-content><p>Los envíos se ejecutan en el procesador de campañas cuando está habilitado.</p>@if(error()){<p class="error-banner">{{error()}}</p>}
 <table class="report-table"><tr><th>Destinatario</th><th>Estado</th><th>Intentos</th><th>Detalle</th></tr>@for(r of rows();track r.id){<tr><td>{{r.nombre}}</td><td>{{r.estado}}</td><td>{{r.intentos}}</td><td>{{r.error||r.entrega_id||'—'}}</td></tr>}</table>
 @if(!rows().length){<p>Todavía no hay entregas registradas.</p>}<label><input type="checkbox" [(ngModel)]="confirmed"> Confirmo que quiero programar el envío o reintentar los fallidos a estos destinatarios.</label>
 </mat-dialog-content><mat-dialog-actions><button mat-button mat-dialog-close>Cerrar</button><button mat-button (click)="load()">Actualizar</button><button mat-stroked-button [disabled]="!confirmed||busy()" (click)="act('retry')">Reintentar fallidos</button><button mat-flat-button [disabled]="!confirmed||busy()" (click)="act('start')">Programar ahora</button></mat-dialog-actions>`})
export class CampaignView {
 data=inject<{channel:string;id:string}>(MAT_DIALOG_DATA);api=inject(Api);rows=signal<any[]>([]);error=signal('');busy=signal(false);confirmed=false;
 constructor(){this.load();}path(){return '/campaigns/'+this.data.channel+'/'+this.data.id;}
 load(){this.api.get<any[]>(this.path()).subscribe({next:d=>this.rows.set(d),error:e=>this.error.set(errorText(e))});}
 act(action:string){this.busy.set(true);this.api.post(this.path()+'/'+action,{}).subscribe({next:()=>{this.confirmed=false;this.busy.set(false);this.load();},error:e=>{this.error.set(errorText(e));this.busy.set(false);}});}
}
