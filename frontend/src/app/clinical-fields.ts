import {Component,Input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MATERIAL} from './material';
@Component({selector:'app-clinical-fields',standalone:true,imports:[FormsModule,...MATERIAL],template:`
 <section class="clinical-section"><h3>Medicamentos</h3>@for(item of model.informacion_medicamentos;track $index;let i=$index){<div class="clinical-row">
 <mat-form-field appearance="outline"><mat-label>Medicamento</mat-label><input matInput [(ngModel)]="item.medicine_name" [ngModelOptions]="{standalone:true}"></mat-form-field>
 <mat-form-field appearance="outline"><mat-label>Presentación</mat-label><input matInput [(ngModel)]="item.medicine_type" [ngModelOptions]="{standalone:true}"></mat-form-field>
 <mat-form-field appearance="outline"><mat-label>Indicaciones</mat-label><input matInput [(ngModel)]="item.instruction" [ngModelOptions]="{standalone:true}"></mat-form-field>
 <mat-form-field appearance="outline"><mat-label>Días</mat-label><input matInput [(ngModel)]="item.day" [ngModelOptions]="{standalone:true}"></mat-form-field>
 <button mat-icon-button type="button" (click)="model.informacion_medicamentos.splice(i,1)" aria-label="Quitar medicamento"><mat-icon>delete_outline</mat-icon></button></div>}
 <button mat-stroked-button type="button" (click)="model.informacion_medicamentos.push({medicine_name:'',medicine_type:'',instruction:'',day:''})">Agregar medicamento</button></section>
 <section class="clinical-section"><h3>Diagnósticos</h3>@for(item of model.informacion_diagnosticos;track $index;let i=$index){<div class="clinical-row">
 <mat-form-field appearance="outline"><mat-label>Diagnóstico</mat-label><input matInput [(ngModel)]="item.diagnosis" [ngModelOptions]="{standalone:true}"></mat-form-field>
 <mat-form-field appearance="outline"><mat-label>Indicaciones del diagnóstico</mat-label><input matInput [(ngModel)]="item.diagnosis_instruction" [ngModelOptions]="{standalone:true}"></mat-form-field>
 <button mat-icon-button type="button" (click)="model.informacion_diagnosticos.splice(i,1)" aria-label="Quitar diagnóstico"><mat-icon>delete_outline</mat-icon></button></div>}
 <button mat-stroked-button type="button" (click)="model.informacion_diagnosticos.push({diagnosis:'',diagnosis_instruction:''})">Agregar diagnóstico</button></section>
`})
export class ClinicalFields {@Input() model:any;}
