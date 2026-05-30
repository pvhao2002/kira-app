import { ChangeDetectionStrategy, Component } from '@angular/core';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-transactions',
  imports: [
    RouterLink
  ],
  templateUrl: './transactions.html',
  styleUrl: './transactions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Transactions {

}
