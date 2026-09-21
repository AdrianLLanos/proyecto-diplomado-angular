import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MATERIAL} from './material';
import {Api,Module,Row,errorText} from './api';
@Component({standalone:true,imports:[CommonModule,...MATERIAL],template:`<h2 mat-dialog-title>{{data.module.label}}</h2><mat-dialog-content><article class="print-document">
 <header><h1>{{settings()['general.company_name']||'Clínica Dental'}}</h1><p>{{settings()['general.company_address']}} · {{settings()['general.company_phone']}}</p><p>{{settings()['general.company_email']}}</p></header>
 <h2>{{data.module.label}} · #{{data.row.id}}</h2>
 @if(error()){<p class="error-banner">{{error()}}</p>}
 <dl class="detail-list">@for(f of data.module.fields;track f.name){@if(!f.secret&&!['informacion_medicamentos','informacion_diagnosticos','informe','foto','archivo'].includes(f.name)){<div><dt>{{f.label}}</dt><dd>{{value(f.name)}}</dd></div>}}</dl>
 @if(data.module.key==='recetas'){<h3>Medicamentos</h3><table class="report-table"><tr><th>Medicamento</th><th>Presentación</th><th>Indicación</th><th>Días</th></tr>@for(m of array(data.row['informacion_medicamentos']);track $index){<tr><td>{{m.medicine_name}}</td><td>{{m.medicine_type}}</td><td>{{m.instruction}}</td><td>{{m.day}}</td></tr>}</table><h3>Diagnósticos</h3>@for(d of array(data.row['informacion_diagnosticos']);track $index){<p><strong>{{d.diagnosis}}</strong> · {{d.diagnosis_instruction}}</p>}}
 @if(data.row['informe']){<h3>Informe</h3><div [innerHTML]="data.row['informe']"></div>}
 @if(data.row['items']){<h3>Conceptos</h3><table class="report-table"><tr><th>Concepto</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr>@for(i of data.row['items'];track i.id){<tr><td>{{i.nombre_cuenta}}<small>{{i.descripcion}}</small></td><td>{{i.cantidad}}</td><td>{{i.precio|number:'1.2-2'}}</td><td>{{i.total|number:'1.2-2'}}</td></tr>}</table><p class="invoice-total">Total: {{data.row['total_general']|number:'1.2-2'}} · Saldo: {{data.row['saldo_pendiente']|number:'1.2-2'}}</p><p>{{settings()['invoice.footer']}}</p>}
 @for(url of attachments();track url){<button mat-stroked-button class="no-print" (click)="open(url)"><mat-icon>attach_file</mat-icon>Ver adjunto</button>}
 </article></mat-dialog-content><mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cerrar</button><button mat-flat-button (click)="print()"><mat-icon>print</mat-icon>Imprimir / guardar PDF</button></mat-dialog-actions>`})
export class DocumentView {
 data=inject<{module:Module;row:Row}>(MAT_DIALOG_DATA);api=inject(Api);people=signal<any[]>([]);settings=signal<Record<string,string>>({});error=signal('');
 constructor(){this.api.get<any>('/documents/'+this.data.module.key+'/'+this.data.row.id).subscribe({next:d=>{this.people.set(d.people);this.settings.set(d.settings);},error:e=>this.error.set(errorText(e))});}
 value(key:string){const v=this.data.row[key];if(['usuario_id','paciente_id','medico_id'].includes(key))return this.people().find(p=>String(p.id)===String(v))?.nombre||v||'—';return v==null?'—':typeof v==='object'?JSON.stringify(v):String(v);}
 array(v:any):any[]{if(Array.isArray(v))return v;try{const x=JSON.parse(v);return Array.isArray(x)?x:[];}catch{return[];}}
 attachments(){const a=this.data.row['archivo'],p=this.data.row['foto'];return [...(a?[a]:[]),...(typeof p==='string'&&p.startsWith('/api/')?[p]:this.array(p))].filter(x=>typeof x==='string'&&x.startsWith('/api/'));}
 open(url:string){this.api.blob(url.slice(4),{module:this.data.module.key,record:this.data.row.id}).subscribe({next:b=>{const u=URL.createObjectURL(b);window.open(u,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(u),60000);},error:e=>this.error.set(errorText(e))});}
 print(){window.print();}
}
