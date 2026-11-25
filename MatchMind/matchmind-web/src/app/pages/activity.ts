import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Activity } from '../core/models';
import { errorMessage, keepPrevious, viewState } from '../core/resource';
import { fmtDateTime } from '../shared/format';
import { Paginator } from '../shared/kit';
import { StateView } from '../shared/ui';

const ID = '[0-9a-f-]{36}';
/** Known requests in words; anything else shows as "METHOD path". */
const LABELS: [RegExp, string][] = [
  [/^POST \/auth\/logout$/, 'Signed out'],
  [/^POST \/auth\/logout-all$/, 'Signed out everywhere'],
  [/^POST \/auth\/change-password$/, 'Changed password'],
  [/^POST \/parlays$/, 'Saved a parlay'],
  [new RegExp(`^DELETE /parlays/${ID}$`), 'Deleted a parlay'],
  [/^POST \/account\/imports$/, 'Started an account import'],
  [/^POST \/users$/, 'Created a user'],
  [/^POST \/users\/generate-password$/, 'Generated a password'],
  [new RegExp(`^PATCH /users/${ID}$`), 'Changed a user'],
  [new RegExp(`^POST /users/${ID}/reset-password$`), 'Reset a password'],
  [new RegExp(`^POST /users/${ID}/unlock$`), 'Unlocked a user'],
];

/** "Signed in", "Sign-in failed", "Saved a parlay", or the raw request for anything else. */
export function activityLabel(a: Pick<Activity, 'method' | 'path' | 'status'>): string {
  const req = `${a.method} ${a.path.replace(/^\/api\/v1/, '')}`;
  if (req === 'POST /auth/login') return a.status < 300 ? 'Signed in' : a.status === 429 ? 'Sign-in blocked (too many tries)' : 'Sign-in failed';
  return LABELS.find(([re]) => re.test(req))?.[1] ?? req;
}

@Component({
  selector: 'mm-activity',
  imports: [Paginator, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel stack">
      <p class="page-note">Sign-ins (also failed ones) and every change made from this account, newest first. Page views are not recorded.</p>
      @if (isAdmin()) {
        <form class="filter-bar" role="search" (submit)="$event.preventDefault(); apply(user.value)">
          <label for="activity-user">User</label>
          <input #user id="activity-user" class="input" type="search" placeholder="All users" autocomplete="off" [value]="username()">
          <button class="btn btn-sm" type="submit">Show</button>
        </form>
      }
      @if (data(); as page) {
        <div class="table-wrap"><table class="dt" aria-label="Account activity">
          <thead><tr><th>Time</th>@if (isAdmin()) { <th>User</th> }<th>Activity</th><th>Result</th><th>IP</th><th>Browser</th></tr></thead>
          <tbody>@for (a of page.data; track a.id) {
            <tr><td class="nowrap">{{ fmt(a.at) }}</td>
              @if (isAdmin()) { <td>{{ a.username ?? 'Unknown username' }}</td> }
              <td>{{ label(a) }}</td>
              <td><span class="tag" [class.tag-success]="a.status < 400" [class.tag-danger]="a.status >= 400">{{ a.status < 400 ? 'OK' : a.status }}</span></td>
              <td class="mono">{{ a.clientIp ?? '—' }}</td>
              <td [attr.title]="a.userAgent">{{ a.browser }} · {{ a.os }}</td></tr>
          } @empty { <tr><td [attr.colspan]="isAdmin() ? 6 : 5" class="empty">No activity yet.</td></tr> }</tbody>
        </table></div>
        @if (page.meta.totalElements > page.meta.size) {
          <mm-paginator [page]="page.meta.page" [size]="page.meta.size" [total]="page.meta.totalElements"
            [sizes]="[]" unit="events" (pageChange)="pageNo.set($event.page)" />
        }
      } @else {
        <mm-state [state]="state()" [message]="error()" retryable (retry)="resource.reload()" />
      }
    </section>`,
})
export class ActivityPage {
  readonly isAdmin = inject(AuthService).isAdmin;
  readonly username = signal('');
  readonly pageNo = signal(0);
  readonly resource = inject(ApiService).activityResource(this.username, this.pageNo);
  readonly data = keepPrevious(this.resource);
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly fmt = fmtDateTime;
  readonly label = activityLabel;

  apply(value: string): void {
    this.username.set(value.trim());
    this.pageNo.set(0);
  }
}
