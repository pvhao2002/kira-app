import { inject, RESPONSE_INIT } from '@angular/core';

/** Lets SSR answer 404 for missing articles/categories so crawlers drop them. No-op in the browser. */
export function injectResponseStatus(): (status: number) => void {
  const init = inject(RESPONSE_INIT, { optional: true });
  return (status) => {
    if (init) {
      init.status = status;
    }
  };
}
