import {Service, computed, effect, inject, signal, untracked} from '@angular/core';
import {Api, apiResource} from './api';

export type Role = 'customer' | 'staff' | 'manager' | 'admin';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface ProfileInput {
  fullName: string;
  phone: string | null;
  birthDate: string | null;
  gender: Gender | null;
}

export interface AuthUser {
  id?: number;
  role: Role;
  label: string;
  name: string;
  fullName?: string;
  email: string;
  phone?: string | null;
  /** yyyy-MM-dd */
  birthDate?: string | null;
  gender?: Gender | null;
  /** Indexes into BRANCHES this user may work in (backend branch id - 1). Admin sees all; customers none. */
  branches: number[];
  /** Where the redirect rules send this role after login. */
  dest: string;
  destDesc: string;
}

/** Demo accounts matching the mockup's redirect rules (screen 6d); the dev seed creates them with a shared password. */
export const DEMO_PASSWORD = 'KiraFarm@123';
export const DEMO_USERS: AuthUser[] = [
  {role: 'customer', label: 'Khách hàng', name: 'Lan', email: 'lan.nguyen@gmail.com', branches: [], dest: '/account', destDesc: 'Trang tài khoản: đơn hàng, địa chỉ, wishlist. Nếu đang thanh toán dở, quay lại /checkout.'},
  {role: 'staff', label: 'Nhân viên chi nhánh', name: 'Minh', email: 'minh.tran@kirafarm.vn', branches: [0], dest: '/admin/orders', destDesc: 'Danh sách đơn hàng của chi nhánh Quận 7, sau bước OTP.'},
  {role: 'manager', label: 'Quản lý nhiều chi nhánh', name: 'Ngọc', email: 'ngoc.le@kirafarm.vn', branches: [1, 2], dest: '/admin', destDesc: 'Chọn chi nhánh làm việc, sau đó vào trang tổng quan của chi nhánh đó.'},
  {role: 'admin', label: 'Quản trị viên', name: 'Toàn', email: 'admin@kirafarm.vn', branches: [0, 1, 2, 3, 4], dest: '/admin', destDesc: 'Tổng quan tất cả chi nhánh, có quyền cấu hình màu và phân quyền.'}
];

interface ApiProfile {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  birthDate?: string | null;
  gender?: Gender | null;
  role: Role;
  branchIds: number[];
}

interface ApiAuthResponse {
  accessToken: string;
  user: ApiProfile;
}

/** Login response for staff/manager/admin: no tokens until the TOTP code is verified. */
interface ApiOtpChallenge {
  otpRequired: true;
  challengeToken: string;
  enrolled: boolean;
}

export interface OtpEnrollment {
  secret: string;
  otpauthUri: string;
}

const SESSION_HINT = 'kirafarm-session';
const hint = {
  has: () => { try { return localStorage.getItem(SESSION_HINT) === '1'; } catch { return false; } },
  set: (on: boolean) => { try { on ? localStorage.setItem(SESSION_HINT, '1') : localStorage.removeItem(SESSION_HINT); } catch { /* ignore */ } }
};

const DEST: Record<Role, {label: string; dest: string; destDesc: string}> = {
  customer: {label: 'Khách hàng', dest: '/account', destDesc: DEMO_USERS[0].destDesc},
  staff: {label: 'Nhân viên chi nhánh', dest: '/admin/orders', destDesc: DEMO_USERS[1].destDesc},
  manager: {label: 'Quản lý nhiều chi nhánh', dest: '/admin', destDesc: DEMO_USERS[2].destDesc},
  admin: {label: 'Quản trị viên', dest: '/admin', destDesc: DEMO_USERS[3].destDesc}
};

/**
 * Session state. The access token lives only in memory; the refresh token is an HttpOnly cookie
 * (`farm_refresh`), so a page reload restores the session through `restore()`.
 */
@Service()
export class AuthStore {
  private readonly api = inject(Api);

  readonly user = signal<AuthUser | null>(null);
  readonly accessToken = signal<string | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isBackoffice = computed(() => {
    const r = this.user()?.role;
    return r === 'staff' || r === 'manager' || r === 'admin';
  });
  /** Set after a correct password for a back-office user; cleared once the OTP is verified or cancelled. */
  readonly otp = signal<{token: string; enrolled: boolean} | null>(null);
  /** Secret shown to a not-yet-enrolled user (from POST /auth/otp/enroll). */
  readonly enrollment = signal<OtpEnrollment | null>(null);

  /**
   * Real sign-in against the API. Resolves the user for customers, or null when a second factor is required
   * (then continue on /login/otp with enroll()/verifyOtp()). Throws ApiError on bad credentials.
   */
  async signIn(identifier: string, password: string, clientIp: string | null = null): Promise<AuthUser | null> {
    const res = await this.api.post<ApiAuthResponse | ApiOtpChallenge>('/auth/login', {identifier, password, clientIp});
    if ('otpRequired' in res) {
      this.otp.set({token: res.challengeToken, enrolled: res.enrolled});
      this.enrollment.set(null);
      return null;
    }
    return this.apply(res);
  }

  /** First-time setup: asks the server for a new TOTP secret. Throws ApiError (409 OTP_ALREADY_ENROLLED, 401 OTP_INVALID). */
  async enroll(): Promise<OtpEnrollment> {
    const c = this.otp();
    if (!c) throw new Error('No pending OTP challenge');
    const e = await this.api.post<OtpEnrollment>('/auth/otp/enroll', {challengeToken: c.token});
    this.enrollment.set(e);
    return e;
  }

  /** Verifies the 6-digit code and completes the sign-in. Throws ApiError (OTP_INVALID, OTP_RATE_LIMITED). */
  async verifyOtp(code: string): Promise<AuthUser> {
    const c = this.otp();
    if (!c) throw new Error('No pending OTP challenge');
    const res = await this.api.post<ApiAuthResponse>('/auth/otp/verify', {challengeToken: c.token, code});
    this.cancelOtp();
    return this.apply(res);
  }

  cancelOtp(): void {
    this.otp.set(null);
    this.enrollment.set(null);
  }

  /** Try to resume a session from the refresh cookie; resolves false when there is none. */
  async restore(): Promise<boolean> {
    return this.refresh();
  }

  async refresh(): Promise<boolean> {
    // No hint = never signed in here: skip the call so anonymous visitors don't hit a 401 on every load.
    if (!hint.has()) return false;
    try {
      this.apply(await this.api.post<ApiAuthResponse>('/auth/refresh'));
      return true;
    } catch {
      hint.set(false);
      this.user.set(null);
      this.accessToken.set(null);
      return false;
    }
  }

  /**
   * GET /auth/me for customers (editable profile fields: phone, birth date, gender). Keyed on the user id so merging the
   * response back into `user` does not retrigger the request. Use `profile.reload()` to refresh.
   */
  readonly profile = apiResource<ApiProfile>(() => (this.profileKey() ? {path: '/auth/me'} : undefined));
  private readonly profileKey = computed(() => (this.user()?.role === 'customer' ? this.user()?.id : undefined));

  constructor() {
    effect(() => {
      // value() throws while the resource is in the error state, so read it only when there is one.
      const p = this.profile.hasValue() ? this.profile.value() : undefined;
      if (p) untracked(() => this.merge(p));
    });
  }

  /** PUT /auth/me; throws ApiError (fieldErrors) on validation problems. Keeps the header name in sync. */
  async saveProfile(input: ProfileInput): Promise<void> {
    this.merge(await this.api.put<ApiProfile>('/auth/me', input));
  }

  private merge(p: ApiProfile): void {
    const u = this.user();
    if (!u) return;
    this.user.set({...u, name: p.fullName.split(' ').pop() ?? p.fullName, fullName: p.fullName, phone: p.phone ?? null,
      birthDate: p.birthDate ?? null, gender: p.gender ?? null});
  }

  login(user: AuthUser): void {
    this.user.set(user);
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch { /* cookie may already be gone */ }
    hint.set(false);
    this.user.set(null);
    this.accessToken.set(null);
  }

  /** Branch indexes the current user may see; admin sees all. */
  allowedBranches(): number[] {
    return this.user()?.branches ?? [];
  }

  /** Where to go after login: customers return to the page that sent them, others to their landing page. */
  landing(user: AuthUser, returnUrl?: string | null): string {
    if (user.role === 'customer') return returnUrl && returnUrl.startsWith('/') ? returnUrl : user.dest;
    return user.dest;
  }

  private apply(res: ApiAuthResponse): AuthUser {
    const p = res.user;
    const d = DEST[p.role];
    const user: AuthUser = {
      id: p.id,
      role: p.role,
      label: d.label,
      name: p.fullName.split(' ').pop() ?? p.fullName,
      fullName: p.fullName,
      email: p.email,
      phone: p.phone ?? null,
      birthDate: p.birthDate ?? null,
      gender: p.gender ?? null,
      branches: p.role === 'admin' ? [0, 1, 2, 3, 4] : p.branchIds.map(id => id - 1),
      dest: d.dest,
      destDesc: d.destDesc
    };
    hint.set(true);
    this.accessToken.set(res.accessToken);
    this.user.set(user);
    return user;
  }
}
