import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {AuthStore} from '../../core/auth/auth.store';
import {LanguageService} from '../../core/i18n/language.service';
import {LanguageSwitcherComponent} from '../../shared/language-switcher/language-switcher';
import {LoginVisitTracker} from '../../core/services/login-visit-tracker.service';

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcherComponent],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthPage {
  readonly i18n = inject(LanguageService);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  
  readonly form: FormGroup<{
    email: FormControl<string>;
    password: FormControl<string>;
  }>;
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly visits = inject(LoginVisitTracker);

  constructor() {
    this.visits.record();
    this.form = new FormGroup({
      email: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.email]}),
      password: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.minLength(8)]})
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const {email, password} = this.form.getRawValue();
    this.auth.login({email, password})
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl('/app'),
        error: (error: {status?: number}) => this.error.set(this.i18n.t(error.status === 429
          ? 'auth.tooManyAttempts' : 'auth.invalidCredentials'))
      });
  }
}
