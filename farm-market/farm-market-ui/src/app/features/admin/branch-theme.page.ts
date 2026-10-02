import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {AA_RATIO, whiteContrast} from '../../core/contrast';
import {ACCENT_PRESETS, PRIMARY_PRESETS} from '../../core/mock-data';
import {AppLogo} from '../../shared/logo';
import {VndPipe} from '../../shared/vnd.pipe';
import {errMsg} from './admin.data';

@Component({
  selector: 'app-branch-theme-page',
  imports: [AppLogo, RouterLink, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './branch-theme.page.html',
  styleUrl: './branch-theme.page.css'
})
export class BranchThemePage {
  readonly store = inject(BranchStore);
  private readonly auth = inject(AuthStore);

  readonly primaries = PRIMARY_PRESETS;
  readonly accents = ACCENT_PRESETS;
  readonly allowed = computed(() => this.auth.allowedBranches());
  readonly saving = signal(false);
  readonly err = signal('');

  pickBranch(i: number): void {
    this.store.select(i);
    this.err.set('');
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.err.set('');
    try {
      await this.store.saveTheme();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.saving.set(false);
    }
  }

  private readonly contrast = computed(() => whiteContrast(this.store.theme().primary));
  readonly ok = computed(() => this.contrast() >= AA_RATIO);
  readonly ratio = computed(() => this.contrast().toFixed(1).replace('.', ',') + ':1');
}
