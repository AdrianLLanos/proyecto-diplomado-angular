import {Component,inject,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MATERIAL} from './material';
import {Api,errorText} from './api';
import {FileInput} from './file-input';
@Component({standalone:true,imports:[FormsModule,FileInput,...MATERIAL],template:`<div class="page-heading"><div><p class="eyebrow">CONFIGURACIÓN</p><h1>Ajustes de la empresa</h1><p>Información general, localización y facturación.</p></div></div>@if(message()){<div class="info-banner">{{message()}}</div>}@if(error()){<div class="error-banner">{{error()}}</div>}<form (ngSubmit)="save()">@for(group of groups;track group.title){<section class="panel settings-panel"><h2>{{group.title}}</h2><div class="form-grid">@for(f of group.fields;track f[0]){<mat-form-field appearance="outline"><mat-label>{{f[1]}}</mat-label><input matInput [(ngModel)]="model[f[0]]" [name]="f[0]"></mat-form-field>}</div>@if(group.title==='Empresa'){<app-file-input label="Logotipo público" [(value)]="model['general.company_logo']" [publish]="true"/>}</section>}<button mat-flat-button [disabled]="busy()||!api.can('ajustes','update')">Guardar ajustes</button></form>`})
export class Settings {
 api=inject(Api);model:Record<string,string>={};message=signal('');error=signal('');busy=signal(false);
 groups=[{title:'Empresa',fields:[['general.company_name','Nombre de la clínica'],['general.company_email','Correo'],['general.company_phone','Teléfono'],['general.company_address','Dirección'],['general.company_tax_number','Número fiscal']]},{title:'Localización',fields:[['general.timezone','Zona horaria'],['general.default_locale','Idioma'],['general.date_format','Formato de fecha'],['general.financial_start','Inicio del año fiscal']]},{title:'Facturación y valores predeterminados',fields:[['invoice.prefix','Prefijo de factura'],['invoice.footer','Pie de factura'],['invoice.due_date','Días de vencimiento'],['general.default_currency','Moneda predeterminada'],['general.default_payment_method','Método de pago']]}];
 constructor(){this.api.get<Record<string,string>>('/settings').subscribe({next:d=>this.model=d,error:e=>this.error.set(errorText(e))});}
 save(){this.busy.set(true);this.api.put('/settings',this.model).subscribe({next:()=>{this.message.set('Ajustes guardados');this.busy.set(false);},error:e=>{this.error.set(errorText(e));this.busy.set(false);}});}
}
