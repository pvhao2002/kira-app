import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {AuthStore} from '../../core/auth/auth.store';
import {LanguageService} from '../../core/i18n/language.service';
import {LanguageSwitcherComponent} from '../../shared/language-switcher/language-switcher';

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
  readonly form: FormGroup<{
    fullName: FormControl<string>;
    email: FormControl<string>;
    password: FormControl<string>;
  }>;
  private readonly route = inject(ActivatedRoute);
  readonly isRegister = this.route.snapshot.data['mode'] === 'register';
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  constructor() {
    this.form = new FormGroup({
      fullName: new FormControl('', {nonNullable: true, validators: this.isRegister ? [Validators.required] : []}),
      email: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.email]}),
      password: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.minLength(8)]})
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    const value = this.form.getRawValue();
    const request = this.isRegister ? this.auth.register(value) : this.auth.login(value);
    request.pipe(finalize(() => this.loading.set(false))).subscribe(() => this.router.navigateByUrl('/app'));
  }
}
