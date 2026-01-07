import { Component } from '@angular/core';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-add-transaction',
  imports: [
    RouterLink
  ],
  templateUrl: './add-transaction.html',
  styleUrl: './add-transaction.css',
  standalone: true
})
export class AddTransaction {

}
