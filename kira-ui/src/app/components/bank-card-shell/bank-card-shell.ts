import {ChangeDetectionStrategy, Component} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-bank-card-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './bank-card-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankCardShell {}
