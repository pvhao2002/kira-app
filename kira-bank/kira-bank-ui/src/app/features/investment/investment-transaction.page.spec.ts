import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {InvestmentImportBatch} from '../../shared/models/api.models';
import {InvestmentTransactionPage} from './investment-transaction.page';

describe('InvestmentTransactionPage', () => {
  let fixture: ComponentFixture<InvestmentTransactionPage>;
  let component: InvestmentTransactionPage;
  let api: {
    page: ReturnType<typeof vi.fn>;
    investmentTransactions: ReturnType<typeof vi.fn>;
    createInvestmentTransactionImport: ReturnType<typeof vi.fn>;
    investmentTransactionImport: ReturnType<typeof vi.fn>;
    confirmInvestmentTransactions: ReturnType<typeof vi.fn>;
    retryInvestmentImportFile: ReturnType<typeof vi.fn>
  };

  const readyBatch: InvestmentImportBatch = {
    batchId: 'batch-1', accountId: 7, status: 'READY',
    summary: {detected: 1, inserted: 0, updated: 0, skipped: 0, failed: 0, review: 1},
    files: [{attachmentId: 10, originalName: 'receipt.png', contentUrl: '/content', status: 'READY', errorCode: null}],
    transactions: [{
      itemId: 'item-1', version: 0, transactionType: 'DEPOSIT', transactionStatus: 'COMPLETED',
      amount: 100000, currency: 'VND', transactionAt: '2026-08-18T02:30:00Z',
      externalTransactionId: 'TX1', description: 'Nạp tiền', rawText: 'raw', confidence: 0.75,
      processingAction: 'REVIEW', matchedTransactionId: null, warnings: ['LOW_CONFIDENCE']
    }]
  };

  beforeEach(async () => {
    api = {
      page: vi.fn().mockReturnValue(of({data: [{id: 7, accountCode: 'A1', accountName: 'Demo', currency: 'VND', status: 'ACTIVE'}], meta: {page: 0, size: 100, totalElements: 1, totalPages: 1}})),
      investmentTransactions: vi.fn().mockReturnValue(of({data: [], meta: {page: 0, size: 50, totalElements: 0, totalPages: 0}})),
      createInvestmentTransactionImport: vi.fn().mockReturnValue(of(readyBatch)),
      investmentTransactionImport: vi.fn().mockReturnValue(of(readyBatch)),
      confirmInvestmentTransactions: vi.fn().mockReturnValue(of({inserted: 1, updated: 0, skipped: 0, failed: 0, results: []})),
      retryInvestmentImportFile: vi.fn().mockReturnValue(of(readyBatch))
    };
    await TestBed.configureTestingModule({
      imports: [InvestmentTransactionPage],
      providers: [
        {provide: ApiService, useValue: api},
        {provide: ToastService, useValue: {show: vi.fn()}},
        provideRouter([])
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(InvestmentTransactionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('validates client file limits and accepts supported images', () => {
    const png = new File([new Uint8Array([1, 2, 3])], 'receipt.png', {type: 'image/png'});
    component.chooseFiles({target: {files: [png], value: ''}} as unknown as Event);
    expect(component.selectedFiles()).toEqual([png]);

    const tooMany = Array.from({length: 10}, (_, index) =>
      new File(['x'], `receipt-${index}.png`, {type: 'image/png'}));
    component.chooseFiles({target: {files: tooMany, value: ''}} as unknown as Event);
    expect(component.error()).toContain('tối đa 10 ảnh');
  });

  it('shows editable preview and applies conflict resolution', () => {
    const png = new File(['x'], 'receipt.png', {type: 'image/png'});
    component.chooseFiles({target: {files: [png], value: ''}} as unknown as Event);
    component.upload();
    expect(component.reviewItems()[0].description).toBe('Nạp tiền');
    expect(component.reviewItems()[0].resolution).toBe('ACCEPT');

    component.openResolution(component.reviewItems()[0]);
    component.resolveConflict('SAVE_AS_NEW');
    expect(component.reviewItems()[0].resolution).toBe('SAVE_AS_NEW');
  });

  it('polls queued batches and exposes confirm summary', async () => {
    vi.useFakeTimers();
    const queued = {...readyBatch, status: 'QUEUED' as const, transactions: []};
    api.createInvestmentTransactionImport.mockReturnValue(of(queued));
    api.investmentTransactionImport.mockReturnValue(of(readyBatch));
    const png = new File(['x'], 'receipt.png', {type: 'image/png'});
    component.chooseFiles({target: {files: [png], value: ''}} as unknown as Event);
    component.upload();
    await vi.advanceTimersByTimeAsync(3000);
    expect(api.investmentTransactionImport).toHaveBeenCalledWith(7, 'batch-1');
    expect(component.batch()?.status).toBe('READY');

    component.confirm();
    expect(component.confirmResult()?.inserted).toBe(1);
    vi.useRealTimers();
  });
});
