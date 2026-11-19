import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmHost, Toasts } from './shared/kit';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts, ConfirmHost],
  template: `<router-outlet /><mm-toasts /><mm-confirm />`,
})
export class App {}
