import {Pipe, PipeTransform} from '@angular/core';
import {vnd} from '../core/format';

/** `{{ price | vnd }}` -> "₫45.000". Pure, so Angular memoises it instead of calling a method every change detection. */
@Pipe({name: 'vnd'})
export class VndPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return vnd(value ?? 0);
  }
}
