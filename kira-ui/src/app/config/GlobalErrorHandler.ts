import {ErrorHandler, Injectable} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      // HTTP error
      console.error('[HTTP]', error.status, error.message);
    } else {
      console.error('[APP]', error);
    }
  }
}
