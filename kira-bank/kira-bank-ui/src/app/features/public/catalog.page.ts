import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {LanguageSwitcherComponent} from '../../shared/language-switcher/language-switcher';
import {Bank, Card, FinderResult, Mcc} from '../../shared/models/api.models';

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
  readonly mccId = new FormControl(1, {nonNullable: true});
  readonly amount = new FormControl(1_000_000, {nonNullable: true});
  readonly items = signal<(Bank | Card | Mcc)[]>([]);
  readonly mccs = signal<Mcc[]>([]);
  readonly results = signal<FinderResult[]>([]);
  private readonly route = inject(ActivatedRoute);
  readonly type = this.route.snapshot.data['type'] as string;
  private readonly api = inject(ApiService);

  constructor() {
    this.load();
    this.api.mccs().subscribe(response => {
      this.mccs.set(response.data);
      if (response.data[0]) this.mccId.setValue(response.data[0].id);
    });
  }

  get title(): string {
    const key = this.type === 'banks' ? 'catalog.titleBanks'
      : this.type === 'cards' ? 'catalog.titleCards'
        : this.type === 'mcc' ? 'catalog.titleMcc' : 'catalog.titleFinder';
    return this.i18n.t(key);
  }

  load(): void {
    const query = this.search.value;
    if (this.type === 'banks') this.api.banks(query).subscribe(response => this.items.set(response.data));
    else if (this.type === 'cards') this.api.cards(query).subscribe(response => this.items.set(response.data));
    else this.api.mccs(query).subscribe(response => this.items.set(response.data));
  }

  find(): void {
    this.api.finder(this.mccId.value, this.amount.value).subscribe(response => this.results.set(response));
  }

  name(item: Bank | Card | Mcc): string {
    return 'name' in item ? item.name : item.cardName;
  }

  code(item: Bank | Card | Mcc): string {
    return 'code' in item ? item.code : item.cardNetwork;
  }

  description(item: Bank | Card | Mcc): string {
    return item.description;
  }
}
