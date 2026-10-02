import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {apiResource} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {StateBox} from '../../shared/state-box';
import {errMsg} from './admin.data';

interface ApiBranch {
  id: number;
  code: string;
  name: string;
  address: string;
  hours: string;
  open: boolean;
  themePrimary: string;
  themeAccent: string;
  managerName: string | null;
  phone: string | null;
}

@Component({
  selector: 'app-branches-page',
  imports: [RouterLink, StateBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './branches.page.html',
  styleUrl: './branches.page.css'
})
export class BranchesPage {
  readonly store = inject(BranchStore);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly isAdmin = computed(() => this.auth.user()?.role === 'admin');

  readonly res = apiResource<ApiBranch[]>(() => ({path: '/admin/branches'}), {defaultValue: []});
  readonly error = computed(() => (this.res.error() ? errMsg(this.res.error()) : ''));

  /** The API already returns only the caller's branches; index = id - 1 in BranchStore. */
  readonly cards = computed(() =>
    (this.res.hasValue() ? this.res.value() : []).map(b => ({...b, i: b.id - 1, p: b.themePrimary, a: b.themeAccent}))
  );

  manage(i: number): void {
    this.store.select(i);
    void this.router.navigate(['/admin']);
  }

  theme(i: number): void {
    this.store.select(i);
    void this.router.navigate(['/admin/branches/theme']);
  }
}
