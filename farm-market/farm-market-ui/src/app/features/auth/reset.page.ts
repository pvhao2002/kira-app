import {ChangeDetectionStrategy, Component, inject, signal, WritableSignal} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {Api, toApiError} from '../../core/api';

/** The token travels in the URL fragment (#token=...) so it is never sent to a server or a Referer header. */
@Component({
  selector: 'app-reset-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset.page.html',
  styleUrl: './reset.page.css'
})
export class ResetPage {
  private readonly api = inject(Api);
  private readonly token = new URLSearchParams(inject(ActivatedRoute).snapshot.fragment ?? '').get('token') ?? '';
  readonly hasToken = this.token.length > 0;
  readonly serverError = signal(false);
  readonly password = signal('');
  readonly confirm = signal('');
  readonly showPw = signal(false);
  readonly busy = signal(false);
  readonly done = signal(false);
  readonly error = signal('');

  constructor() {
    // Drop the token from the address bar/history once read.
    if (this.hasToken) history.replaceState(history.state, '', location.pathname + location.search);
  }

  edit(field: WritableSignal<string>, value: string): void {
    field.set(value);
    this.error.set('');
    this.serverError.set(false);
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    const password = this.password();
    if (password.length < 8 || password.length > 72) {
      this.error.set('Mật khẩu từ 8 đến 72 ký tự.');
      return;
    }
    if (password !== this.confirm()) {
      this.error.set('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post('/auth/password/reset', {token: this.token, newPassword: password});
      this.done.set(true);
    } catch (e) {
      const err = toApiError(e);
      this.error.set(Object.values(err.fieldErrors)[0] ?? err.message);
      this.serverError.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
