import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {AuthStore} from '../../core/auth/auth.store';

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthPage {
  readonly loading = signal(false);
  readonly form = new FormGroup({
    fullName: new FormControl('', {nonNullable: true, validators: this.isRegister ? [Validators.required] : []}),
    email: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.email]}),
    password: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.minLength(8)]})
  });
  private readonly route = inject(ActivatedRoute);
  readonly isRegister = this.route.snapshot.data['mode'] === 'register';
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    const value = this.form.getRawValue();
    const request = this.isRegister ? this.auth.register(value) : this.auth.login(value);
    request.pipe(finalize(() => this.loading.set(false))).subscribe(() => this.router.navigateByUrl('/app'));
  }
}
