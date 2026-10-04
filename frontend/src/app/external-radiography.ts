import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {MATERIAL} from './material';
import {errorText} from './api';
@Component({standalone:true,imports:[CommonModule,...MATERIAL],template:`<main class="external-radio"><section class="panel radio-panel"><p class="eyebrow">CLÍNICA SAN MARTÍN · CERPAX</p><h1>Entrega de radiografía</h1>@if(error()){<p class="error-banner" role="alert">{{error()}}</p>}@if(done()){<h2>Archivo recibido</h2><p role="status">La solicitud quedó completada. Puedes cerrar esta página; este enlace ya no permite nuevas cargas.</p>}@else if(request();as r){<p>Solicitud #{{r.id}} · {{r.tipo}}</p><p>Vence: {{r.vence_en|date:'dd/MM/yyyy HH:mm'}}</p><p>Selecciona la radiografía correspondiente a esta solicitud. PDF, PNG, JPEG o WebP, hasta 50 MB.</p><label for="radiografia">Archivo de radiografía</label><input id="radiografia" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" (change)="select($event)">@if(file){<p>{{file.name}}</p>}<button mat-flat-button (click)="upload()" [disabled]="!file||busy()">{{busy()?'Enviando…':'Enviar radiografía'}}</button>}@else if(!error()){<p>Verificando enlace…</p>}</section></main>`})
export class ExternalRadiography {
 http=inject(HttpClient);request=signal<any>(null);error=signal('');busy=signal(false);done=signal(false);file:File|null=null;token=window.location.hash.slice(1);
 constructor(){this.http.post('/api/external/radiographs/access',{token:this.token}).subscribe({next:r=>this.request.set(r),error:e=>this.error.set(errorText(e))});}
 select(event:Event){const file=(event.target as HTMLInputElement).files?.[0]||null;this.error.set('');if(file&&file.size>50*1024*1024){this.file=null;this.error.set('El archivo supera el límite de 50 MB.');}else this.file=file;}
 upload(){
  if(!this.file)return;
  const file=this.file, body={token:this.token,nombre:file.name,tipo:file.type,tamano:file.size};this.busy.set(true);
  this.http.post<any>('/api/external/radiographs/upload-url',body).subscribe({next:async upload=>{
   try{
    const response=await fetch(upload.signedUrl,{method:'PUT',headers:{'content-type':file.type,'x-upsert':'false','cache-control':'max-age=3600'},body:file});
    if(!response.ok)throw new Error();
    this.http.post('/api/external/radiographs/upload-complete',{...body,path:upload.path}).subscribe({next:()=>{this.done.set(true);this.busy.set(false);history.replaceState(null,'',window.location.pathname);this.token='';},error:e=>{this.error.set(errorText(e));this.busy.set(false);}});
   }catch{this.error.set('No se pudo subir el archivo a CERPAX. Inténtalo nuevamente.');this.busy.set(false);}
  },error:e=>{this.error.set(errorText(e));this.busy.set(false);}});
 }
}
