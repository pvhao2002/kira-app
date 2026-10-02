import {ChangeDetectionStrategy, Component, input} from '@angular/core';

/**
 * Kira Farm logo: a sprout in a round badge plus the wordmark. The badge follows the branch theme
 * (`--accent` fill, `--primary` stroke/leaves) and the wordmark inherits the surrounding text colour and size.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logo.html',
  styleUrl: './logo.css',
  host: {'[style.--logo-size]': 'size() + "px"'}
})
export class AppLogo {
  /** Height/width of the badge in px. */
  readonly size = input(30);
  /** Hide the wordmark to show the badge only. */
  readonly showText = input(true);
}
