import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface TransactionDto {
  transactionId: number;
  type: string;
  amount: number;
  transactionAt: string;
  description: string | null;
  source: string;
  status: string;
  pendingAiExtraction: boolean;
  aiError: string | null;
}

export interface CreateManualTransactionPayload {
  type: string;
  amount: number;
  transactionAt: string;
  description?: string | null;
}

export interface CreateReceiptPayload {
  imageBase64: string;
  fileName?: string | null;
  mimeType?: string | null;
}

@Injectable({providedIn: 'root'})
export class TransactionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/gateway/transactions';

  createManual(body: CreateManualTransactionPayload): Observable<TransactionDto> {
    return this.http.post<TransactionDto>(`${this.base}/manual`, body);
  }

  createReceipt(body: CreateReceiptPayload): Observable<TransactionDto> {
    return this.http.post<TransactionDto>(`${this.base}/receipt`, body);
  }
}
