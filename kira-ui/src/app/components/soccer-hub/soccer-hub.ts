import {ChangeDetectionStrategy, Component} from '@angular/core';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-soccer-hub',
  imports: [RouterLink],
  templateUrl: './soccer-hub.html',
  styleUrl: './soccer-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoccerHub {
}
