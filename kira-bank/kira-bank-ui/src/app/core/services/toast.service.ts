import { Injectable, signal } from '@angular/core';
export interface Toast{message:string;kind:'success'|'error'|'info'}
@Injectable({providedIn:'root'})export class ToastService{readonly current=signal<Toast|null>(null);show(message:string,kind:Toast['kind']='info'):void{this.current.set({message,kind});window.setTimeout(()=>this.current.set(null),4000);}}

