import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {LanguageSwitcherComponent} from '../../shared/language-switcher/language-switcher';
import {Bank, Mcc} from '../../shared/models/api.models';

@Component({
  selector: 'app-catalog',
  imports: [RouterLink, ReactiveFormsModule, LanguageSwitcherComponent],
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogPage {
  readonly i18n = inject(LanguageService);
  readonly search = new FormControl('', {nonNullable: true});
  readonly items = signal<(Bank | Mcc)[]>([]);
  private readonly route = inject(ActivatedRoute);
  readonly type = this.route.snapshot.data['type'] as 'banks' | 'mcc';
  private readonly api = inject(ApiService);

  constructor() {
    this.load();
  }

  get title(): string {
    return this.i18n.t(this.type === 'banks' ? 'catalog.titleBanks' : 'catalog.titleMcc');
  }

  load(): void {
    const query = this.search.value;
    const request = this.type === 'banks' ? this.api.banks(query) : this.api.mccs(query);
    request.subscribe(response => this.items.set(response.data));
  }

  name(item: Bank | Mcc): string {
    return item.name;
  }

  code(item: Bank | Mcc): string {
    return item.code;
  }

  description(item: Bank | Mcc): string {
    return item.description;
  }
}
