import {Injectable, signal} from '@angular/core';

export interface Toast {
  message: string;
  kind: 'success' | 'error' | 'info';
}

@Injectable({providedIn: 'root'})
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private timer = 0;

  show(message: string, kind: Toast['kind'] = 'info'): void {
    window.clearTimeout(this.timer);
    this.current.set({message, kind});
    this.timer = window.setTimeout(() => this.current.set(null), 4000);
  }
}
