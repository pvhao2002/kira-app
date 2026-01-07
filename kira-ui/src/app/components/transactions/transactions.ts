import { Component } from '@angular/core';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-transactions',
  imports: [
    RouterLink
  ],
  templateUrl: './transactions.html',
  styleUrl: './transactions.css',
  standalone: true
})
export class Transactions {

}
