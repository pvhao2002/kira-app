import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

/** Unknown URL inside the app: say so (the shell's h1 reads "Page not found") instead of silently redirecting. */
@Component({
  selector: 'mm-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <div class="state-box">
        <i class="pi pi-compass" aria-hidden="true"></i>
        <div>
          <strong>There is no page at <code>{{ url }}</code>.</strong>
          <p>The link may be old or mistyped.</p>
          <p><a routerLink="/" class="btn btn-primary">Go to the start page</a></p>
        </div>
      </div>
    </section>`,
})
export class NotFoundPage {
  readonly url = inject(Router).url;
}
