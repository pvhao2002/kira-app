// `kira-ui/src/app/config/Toast.service.ts`
import {inject, Injectable} from '@angular/core';
import {ToastrService, IndividualConfig} from 'ngx-toastr';

@Injectable({providedIn: 'root'})
export class ToastService {
  private readonly toast = inject(ToastrService);

  success(message: string, title?: string, options?: Partial<IndividualConfig>) {
    this.toast.success(message, title, options);
  }

  error(message: string, title?: string, options?: Partial<IndividualConfig>) {
    this.toast.error(message, title, options);
  }

  info(message: string, title?: string, options?: Partial<IndividualConfig>) {
    this.toast.info(message, title, options);
  }

  warning(message: string, title?: string, options?: Partial<IndividualConfig>) {
    this.toast.warning(message, title, options);
  }
}
