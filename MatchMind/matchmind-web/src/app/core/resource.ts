import { Resource, ResourceStatus, Signal, computed, linkedSignal } from '@angular/core';
import { apiError } from './http';

export type ViewState = 'loading' | 'error' | 'ready';

/** A resource status as one of the three states `<mm-state>` knows. A reload keeps showing the old data ('ready'). */
export function statusToView(s: ResourceStatus): ViewState {
  return s === 'error' ? 'error' : s === 'idle' || s === 'loading' ? 'loading' : 'ready';
}

/** Maps a resource status to the three states `<mm-state>` knows. */
export function viewState(r: Resource<unknown>): Signal<ViewState> {
  return computed(() => statusToView(r.status()));
}

/** The API's own `message` for a failed resource, '' otherwise. */
export function errorMessage(r: Resource<unknown>): Signal<string> {
  return computed(() => (r.error() ? apiError(r.error()).message : ''));
}

/** `value()` throws while a resource is in the error state; this returns `fallback` (default undefined) instead. */
export function safeValue<T>(r: Resource<T | undefined>): Signal<T | undefined>;
export function safeValue<T>(r: Resource<T | undefined>, fallback: T): Signal<T>;
export function safeValue<T>(r: Resource<T | undefined>, fallback?: T): Signal<T | undefined> {
  return computed(() => (r.hasValue() ? r.value() : fallback));
}

/**
 * Like `safeValue`, but a resource blanks its value while the next request loads: this keeps the last good value
 * during that load (so a table can dim instead of flash empty) and drops it on error or when the resource goes idle.
 */
export function keepPrevious<T>(r: Resource<T | undefined>): Signal<T | undefined> {
  return linkedSignal<{ status: ResourceStatus; value: T | undefined }, T | undefined>({
    source: () => ({ status: r.status(), value: r.hasValue() ? r.value() : undefined }),
    computation: ({ status, value }, prev) => value ?? (status === 'loading' || status === 'reloading' ? prev?.value : undefined),
  });
}
