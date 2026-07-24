import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {LanguageService} from '../../core/i18n/language.service';
import {LanguageSwitcherComponent} from '../../shared/language-switcher/language-switcher';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, LanguageSwitcherComponent],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPage {
  readonly i18n = inject(LanguageService);
  readonly chartHeights = [34, 52, 42, 68, 58, 82, 72, 92, 78, 100, 88, 110];
}
