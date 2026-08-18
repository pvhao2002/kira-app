import {effect, Injectable} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy} from '@angular/router';
import {LanguageService} from '../i18n/language.service';

const BRAND_TITLE = 'Kira Bank';

@Injectable()
export class LocalizedTitleStrategy extends TitleStrategy {
  private activeTitleKey: string | null = null;

  constructor(
    private readonly title: Title,
    private readonly i18n: LanguageService
  ) {
    super();
    effect(() => {
      this.i18n.language();
      this.applyTitle();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let route: ActivatedRouteSnapshot | null = snapshot.root;
    let titleKey: string | null = null;

    while (route) {
      const candidate = route.data['titleKey'];
      if (typeof candidate === 'string') {
        titleKey = candidate;
      }
      route = route.firstChild;
    }

    this.activeTitleKey = titleKey;
    this.applyTitle();
  }

  private applyTitle(): void {
    if (!this.activeTitleKey || !this.i18n.has(this.activeTitleKey)) {
      this.title.setTitle(BRAND_TITLE);
      return;
    }

    this.title.setTitle(`${this.i18n.t(this.activeTitleKey)} | ${BRAND_TITLE}`);
  }
}
