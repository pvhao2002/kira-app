import {Component} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-tools',
  imports: [],
  templateUrl: './tools.html',
  styleUrl: './tools.css',
})
export class Tools {
  constructor(protected readonly http: HttpClient) {
  }
}
