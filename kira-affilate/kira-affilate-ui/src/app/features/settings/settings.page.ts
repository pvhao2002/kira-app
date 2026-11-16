import {ChangeDetectionStrategy, Component, computed, effect, inject, signal} from '@angular/core';
import {rxResource} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {Observable} from 'rxjs';
import {apiErrorMessage} from '../../core/api/api-error';
import {CredentialLastStatus, CredentialStatus} from '../../core/api/models';
import {ShopeeApi} from '../../core/api/shopee-api.service';
import {AuthStore} from '../../core/auth/auth.store';
import {formatDateTime} from '../../core/format/formatters';
import {ToastService} from '../../core/services/toast.service';
import {valueOr} from '../../shared/resource.util';
import {StateBox} from '../../shared/state-box';
import {StatusBadge} from '../../shared/status-badge';
import {SyncChip} from '../../shared/sync-chip';

const STATUS_HELP: Record<CredentialLastStatus, string> = {
  OK: 'Kết nối hoạt động bình thường.',
  INVALID_CREDENTIAL: 'App ID hoặc Secret không đúng. Hãy kiểm tra lại thông tin trong trang Open API của Shopee Affiliate.',
  NO_API_ACCESS: 'Tài khoản chưa được Shopee cấp quyền Open API',
  RATE_LIMITED: 'Shopee đang giới hạn tần suất gọi API. Vui lòng thử lại sau ít phút.',
  ERROR: 'Không kiểm tra được kết nối với Shopee. Vui lòng thử lại sau.'
};

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, StateBox, StatusBadge, SyncChip],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPage {
  protected readonly auth = inject(AuthStore);
  private readonly shopee = inject(ShopeeApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly formatDateTime = formatDateTime;

  // ----- profile -----
  protected readonly fullName = signal(this.auth.user()?.fullName ?? '');
  protected readonly profileError = signal('');
  protected readonly savingProfile = signal(false);

  // ----- password -----
  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly passwordError = signal('');
  protected readonly savingPassword = signal(false);

  // ----- Shopee credentials -----
  protected readonly credentialsRes = rxResource({stream: () => this.shopee.credentials()});
  /** The latest status: from the last save/test when there is one, otherwise from the initial load. */
  private readonly latest = signal<CredentialStatus | null>(null);
  protected readonly credentials = computed(() => this.latest() ?? valueOr(this.credentialsRes, null));
  protected readonly statusHelp = computed(() => {
    const status = this.credentials()?.lastStatus;
    return status ? STATUS_HELP[status] ?? '' : '';
  });
  protected readonly appId = signal('');
  protected readonly secret = signal('');
  protected readonly credentialError = signal('');
  protected readonly credentialBusy = signal<'save' | 'test' | 'delete' | null>(null);
  protected readonly confirmDelete = signal(false);

  constructor() {
    // Prefill the App ID once it is known; the secret is never returned by the server and never prefilled.
    effect(() => {
      const appId = valueOr(this.credentialsRes, null)?.appId;
      if (appId) this.appId.set(appId);
    });
  }

  protected saveProfile(): void {
    const fullName = this.fullName().trim();
    this.profileError.set(fullName ? '' : 'Vui lòng nhập họ tên.');
    if (!fullName || this.savingProfile()) return;
    this.savingProfile.set(true);
    this.auth.updateProfile(fullName).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.toast.show('Đã cập nhật hồ sơ.', 'success');
      },
      error: e => {
        this.savingProfile.set(false);
        this.profileError.set(apiErrorMessage(e));
      }
    });
  }

  protected changePassword(): void {
    const currentPassword = this.currentPassword(), newPassword = this.newPassword();
    const error = !currentPassword ? 'Vui lòng nhập mật khẩu hiện tại.'
      : newPassword.length < 8 || newPassword.length > 72 ? 'Mật khẩu mới phải từ 8 đến 72 ký tự.'
        : newPassword !== this.confirmPassword() ? 'Mật khẩu nhập lại không khớp.' : '';
    this.passwordError.set(error);
    if (error || this.savingPassword()) return;
    this.savingPassword.set(true);
    this.auth.changePassword({currentPassword, newPassword}).subscribe({
      next: () => {
        // The server revoked every session, including this one.
        this.auth.clear();
        this.toast.show('Đã đổi mật khẩu. Vui lòng đăng nhập lại.', 'success');
        void this.router.navigateByUrl('/login');
      },
      error: e => {
        this.savingPassword.set(false);
        this.passwordError.set(apiErrorMessage(e));
      }
    });
  }

  protected saveCredentials(): void {
    const appId = this.appId().trim(), secret = this.secret().trim();
    this.credentialError.set(appId && secret ? '' : 'Vui lòng nhập cả App ID và Secret.');
    if (!appId || !secret) return;
    this.runCredential('save', this.shopee.saveCredentials({appId, secret}), 'Đã lưu và kiểm tra thông tin kết nối.');
  }

  protected testCredentials(): void {
    this.runCredential('test', this.shopee.testCredentials(), 'Đã kiểm tra kết nối.');
  }

  protected deleteCredentials(): void {
    if (this.credentialBusy()) return;
    this.credentialBusy.set('delete');
    this.shopee.deleteCredentials().subscribe({
      next: () => {
        this.credentialBusy.set(null);
        this.confirmDelete.set(false);
        this.latest.set({configured: false, appId: null, lastCheckedAt: null, lastStatus: null, lastErrorCode: null, lastErrorMessage: null});
        this.appId.set('');
        this.secret.set('');
        this.toast.show('Đã xóa thông tin kết nối Shopee.', 'success');
      },
      error: e => {
        this.credentialBusy.set(null);
        this.credentialError.set(apiErrorMessage(e));
      }
    });
  }

  protected logout(): void {
    const toLogin = () => void this.router.navigateByUrl('/login');
    this.auth.logout().subscribe({complete: toLogin, error: toLogin});
  }

  private runCredential(kind: 'save' | 'test', request: Observable<CredentialStatus>, done: string): void {
    if (this.credentialBusy()) return;
    this.credentialBusy.set(kind);
    this.credentialError.set('');
    request.subscribe({
      next: status => {
        this.credentialBusy.set(null);
        this.latest.set(status);
        this.secret.set('');
        this.toast.show(done, status.lastStatus === 'OK' ? 'success' : 'info');
      },
      error: e => {
        this.credentialBusy.set(null);
        this.credentialError.set(apiErrorMessage(e));
      }
    });
  }
}
