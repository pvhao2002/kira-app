import { Component } from '@angular/core';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-cards',
  imports: [
    RouterLink
  ],
  templateUrl: './cards.html',
  styleUrl: './cards.css',
  standalone: true
})
export class Cards {

}
