import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Api, toApiError} from '../../core/api';

@Component({
  selector: 'app-forgot-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot.page.html',
  styleUrl: './forgot.page.css'
})
export class ForgotPage {
  private readonly api = inject(Api);
  readonly email = signal('');
  readonly busy = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    const email = this.email().trim();
    if (this.busy()) return;
    if (!email) {
      this.error.set('Vui lòng nhập email.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post('/auth/password/forgot', {email});
      this.sent.set(true);
    } catch (e) {
      const err = toApiError(e);
      this.error.set(Object.values(err.fieldErrors)[0] ?? err.message);
    } finally {
      this.busy.set(false);
    }
  }
}
