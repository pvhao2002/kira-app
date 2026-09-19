import {ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {AuthStore} from '../../core/auth/auth.store';
import {LanguageService} from '../../core/i18n/language.service';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {PageResponse, Profile} from '../../shared/models/api.models';

interface AdminUser { id: number; fullName: string; email: string; phone: string | null; roles: string[]; status: string; }

@Component({
  selector: 'app-admin-users', imports: [ReactiveFormsModule],
  templateUrl: './admin-users.page.html', styleUrl: './admin-users.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsersPage {
  @ViewChild('createDialog') set createDialog(dialog: ElementRef<HTMLDialogElement> | undefined) {
    if (dialog && !dialog.nativeElement.open) dialog.nativeElement.showModal();
  }
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  readonly auth = inject(AuthStore);
  readonly i18n = inject(LanguageService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly result = signal<PageResponse<AdminUser> | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly open = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly search = signal('');
  private query = '';
  readonly form = new FormGroup({
    fullName: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]}),
    email: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.email]}),
    phone: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(30)]}),
    password: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.minLength(8), Validators.maxLength(72)]}),
    confirmPassword: new FormControl('', {nonNullable: true, validators: [Validators.required]})
  }, {validators: control => control.get('password')?.value === control.get('confirmPassword')?.value ? null : {passwordMismatch: true}});

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  t(key: string): string { return this.i18n.t(`users.${key}`); }

  applySearch(): void {
    const query = (this.searchInput?.nativeElement.value ?? this.search()).trim();
    this.search.set(query);
    this.query = query;
    this.load(0);
  }

  load(page = 0): void {
    if (!this.auth.admin()) return;
    this.request?.unsubscribe();
    this.loading.set(true); this.error.set('');
    this.request = this.api.page<AdminUser>('admin/users', page, 20, this.query).subscribe({
      next: result => { this.result.set(result); this.loading.set(false); },
      error: () => { this.result.set(null); this.error.set(this.t('loadError')); this.loading.set(false); }
    });
  }

  openCreate(): void {
    if (!this.auth.admin()) return;
    this.form.reset(); this.formError.set(''); this.open.set(true);
  }

  close(): void {
    if (this.saving()) return;
    this.open.set(false); this.form.reset(); this.formError.set('');
  }

  save(): void {
    if (!this.auth.admin() || this.saving()) return;
    this.form.controls.email.setValue(this.form.controls.email.value.trim());
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.saving.set(true); this.formError.set('');
    this.api.post<Profile>('admin/users', {fullName: value.fullName.trim(), email: value.email,
      phone: value.phone.trim() || null, password: value.password}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false); this.close(); this.toast.show(this.t('created'), 'success');
        this.search.set(''); this.query = ''; this.load(0);
      },
      error: e => {
        this.saving.set(false);
        this.formError.set(this.t(e.error?.code === 'EMAIL_EXISTS' ? 'emailExists' : e.status === 403 ? 'forbidden' : 'saveError'));
      }
    });
  }
}
