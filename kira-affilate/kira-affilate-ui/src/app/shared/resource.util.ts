import {Resource} from '@angular/core';

/** A resource's value, or the fallback while it is loading, idle or failed (reading `value()` then would throw). */
export function valueOr<T>(resource: Resource<T | undefined>, fallback: T): T {
  return resource.hasValue() ? resource.value() as T : fallback;
}
