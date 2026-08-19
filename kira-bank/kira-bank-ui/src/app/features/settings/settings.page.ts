import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize} from 'rxjs';
import {LanguageService} from '../../core/i18n/language.service';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {LanguageSwitcherComponent} from '../../shared/language-switcher/language-switcher';
import {Profile} from '../../shared/models/api.models';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, LanguageSwitcherComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPage {
  readonly i18n = inject(LanguageService);
  readonly loading = signal(true);
  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);
  readonly email = signal('');
  readonly profileVersion = signal<number | null>(null);
  readonly profileForm = new FormGroup({
    fullName: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.maxLength(150)]}),
    phone: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(30)]})
  });
  readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    newPassword: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)]}),
    confirmPassword: new FormControl('', {nonNullable: true, validators: [Validators.required]})
  });
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  constructor() {
    this.api.get<Profile>('auth/profile').pipe(finalize(() => this.loading.set(false))).subscribe({
      next: profile => {
        this.email.set(profile.email);
        this.profileVersion.set(profile.version);
        this.profileForm.patchValue({fullName: profile.fullName, phone: profile.phone ?? ''});
        this.profileForm.markAsPristine();
      }
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const version = this.profileVersion();
    if (version === null) return;
    this.savingProfile.set(true);
    this.api.put<Profile>('auth/profile', {...this.profileForm.getRawValue(), version})
      .pipe(finalize(() => this.savingProfile.set(false)))
      .subscribe({
        next: profile => {
          this.profileVersion.set(profile.version);
          this.profileForm.markAsPristine();
          this.toast.show(this.i18n.t('settings.profileSaved'), 'success');
        }
      });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const values = this.passwordForm.getRawValue();
    if (values.newPassword !== values.confirmPassword) {
      this.passwordForm.controls.confirmPassword.setErrors({mismatch: true});
      return;
    }
    this.savingPassword.set(true);
    this.api.post<void>('auth/change-password', {
      currentPassword: values.currentPassword,
      newPassword: values.newPassword
    }).pipe(finalize(() => this.savingPassword.set(false))).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.toast.show(this.i18n.t('settings.passwordChanged'), 'success');
      }
    });
  }
}
