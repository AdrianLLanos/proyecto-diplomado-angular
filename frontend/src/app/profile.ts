import {Component,inject,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MATERIAL} from './material';
import {Api,errorText} from './api';
import {FileInput} from './file-input';
@Component({standalone:true,imports:[FormsModule,FileInput,...MATERIAL],template:`<div class="page-heading"><div><p class="eyebrow">MI CUENTA</p><h1>Perfil y contraseña</h1></div></div>@if(message()){<div class="info-banner">{{message()}}</div>}@if(error()){<div class="error-banner">{{error()}}</div>}
 <section class="panel settings-panel"><h2>Datos personales</h2><form (ngSubmit)="save()"><div class="form-grid">@for(f of fields;track f.key){<mat-form-field appearance="outline"><mat-label>{{f.label}}</mat-label><input matInput [(ngModel)]="model[f.key]" [name]="f.key" [type]="f.key==='correo'?'email':'text'"></mat-form-field>}</div><app-file-input label="Fotografía" [(value)]="model['foto']"/><button mat-flat-button [disabled]="busy()">Guardar perfil</button></form></section>
 <section class="panel settings-panel"><h2>Cambiar contraseña</h2><form (ngSubmit)="password()"><div class="form-grid">@if(!api.session()?.localAccess){<mat-form-field appearance="outline"><mat-label>Contraseña actual</mat-label><input matInput type="password" name="actual" [(ngModel)]="actual" autocomplete="current-password"></mat-form-field>}<mat-form-field appearance="outline"><mat-label>Nueva contraseña</mat-label><input matInput type="password" name="nueva" [(ngModel)]="nueva" minlength="12" required autocomplete="new-password"><mat-hint>Al menos 12 caracteres</mat-hint></mat-form-field></div><button mat-flat-button [disabled]="busy()">Actualizar contraseña</button></form></section>`})
export class Profile {
 api=inject(Api);model:Record<string,any>={};fields=[{key:'nombre',label:'Nombre'},{key:'correo',label:'Correo'},{key:'telefono',label:'Teléfono'},{key:'direccion',label:'Dirección'}];actual='';nueva='';busy=signal(false);message=signal('');error=signal('');
 constructor(){this.api.get<any>('/profile').subscribe({next:d=>this.model=d,error:e=>this.error.set(errorText(e))});}
 save(){this.busy.set(true);this.api.put('/profile',this.model).subscribe({next:()=>{this.message.set('Perfil actualizado');this.busy.set(false);},error:e=>{this.error.set(errorText(e));this.busy.set(false);}});}
 password(){this.busy.set(true);this.api.post('/profile/password',{actual:this.actual,nueva:this.nueva}).subscribe({next:()=>{this.busy.set(false);this.nueva='';this.actual='';this.message.set('Contraseña actualizada. Inicia sesión de nuevo.');if(!this.api.session()?.localAccess){sessionStorage.clear();window.location.href='/login';}},error:e=>{this.error.set(errorText(e));this.busy.set(false);}});}
}
