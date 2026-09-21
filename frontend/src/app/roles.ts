import {Component,inject,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MAT_DIALOG_DATA,MatDialogRef} from '@angular/material/dialog';
import {MATERIAL} from './material';
import {Api,errorText} from './api';
@Component({standalone:true,imports:[FormsModule,MatCheckboxModule,...MATERIAL],template:`<div class="page-heading"><div><p class="eyebrow">CONTROL DE ACCESO</p><h1>Roles y permisos</h1><p>Configura los permisos que se aplicarán al activar el control de roles.</p></div></div>@if(error()){<p class="error-banner">{{error()}}</p>}
 <div class="dashboard-grid"><section class="panel settings-panel"><h2>Roles</h2>@for(r of roles();track r.id){<button mat-button (click)="select(r)">{{r.nombre}}</button>}<mat-form-field appearance="outline"><mat-label>Nombre del nuevo rol</mat-label><input matInput [(ngModel)]="name"></mat-form-field><button mat-flat-button (click)="create()">Crear rol</button></section>
 @if(selected();as r){<section class="panel settings-panel"><h2>{{r.nombre}}</h2>@if(r.nombre==='Super Admin'){<p>El administrador conserva todos los permisos.</p>}@else{<div class="permission-list">@for(p of permissions();track p.id){<mat-checkbox [checked]="checked(p.id)" (change)="toggle(p.id,$event.checked)">{{p.nombre_visible}}</mat-checkbox>}</div><button mat-flat-button (click)="save()">Guardar permisos</button>@if(r.es_predeterminado!=='1'){<button mat-button (click)="remove()">Eliminar rol</button>}}</section>}</div>`})
export class Roles {
 api=inject(Api);roles=signal<any[]>([]);permissions=signal<any[]>([]);selected=signal<any>(null);error=signal('');name='';ids=new Set<string>();constructor(){this.load();}
 load(){this.api.get<any>('/roles').subscribe({next:d=>{this.roles.set(d.roles);this.permissions.set(d.permissions);},error:e=>this.error.set(errorText(e))});}
 select(r:any){this.selected.set(r);this.ids=new Set(r.permisos.map(String));}checked(id:any){return this.ids.has(String(id));}toggle(id:any,v:boolean){v?this.ids.add(String(id)):this.ids.delete(String(id));}
 create(){this.api.post('/roles',{nombre:this.name}).subscribe({next:()=>{this.name='';this.load();},error:e=>this.error.set(errorText(e))});}
 save(){this.api.put('/roles/'+this.selected().id,{nombre:this.selected().nombre,permisos:[...this.ids]}).subscribe({next:()=>{this.load();this.error.set('');},error:e=>this.error.set(errorText(e))});}
 remove(){if(!window.confirm('¿Eliminar este rol?'))return;this.api.delete('/roles/'+this.selected().id).subscribe({next:()=>{this.selected.set(null);this.load();},error:e=>this.error.set(errorText(e))});}
}
@Component({standalone:true,imports:[FormsModule,...MATERIAL],template:`<h2 mat-dialog-title>Roles del usuario</h2><mat-dialog-content>@if(error()){<p class="error-banner">{{error()}}</p>}<mat-form-field appearance="outline"><mat-label>Roles asignados</mat-label><mat-select [(ngModel)]="ids" multiple>@for(r of roles();track r.id){<mat-option [value]="''+r.id">{{r.nombre}}</mat-option>}</mat-select></mat-form-field></mat-dialog-content><mat-dialog-actions><button mat-button mat-dialog-close>Cancelar</button><button mat-flat-button (click)="save()">Guardar</button></mat-dialog-actions>`})
export class UserAccess {
 api=inject(Api);data=inject<{id:string}>(MAT_DIALOG_DATA);dialog=inject(MatDialogRef<UserAccess>);roles=signal<any[]>([]);ids:string[]=[];error=signal('');constructor(){this.api.get<any>('/roles').subscribe({next:d=>{this.roles.set(d.roles);this.api.get<any>('/users/'+this.data.id+'/access').subscribe({next:u=>this.ids=d.roles.filter((r:any)=>u.roles.includes(r.nombre)).map((r:any)=>String(r.id)),error:e=>this.error.set(errorText(e))});},error:e=>this.error.set(errorText(e))});}save(){this.api.put('/users/'+this.data.id+'/access',{roles:this.ids}).subscribe({next:()=>this.dialog.close(true),error:e=>this.error.set(errorText(e))});}
}
