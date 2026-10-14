import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {InvestmentImportState} from '../../shared/models/api.models';
import {InvestmentTransactionPage} from './investment-transaction.page';

describe('InvestmentTransactionPage', () => {
  let fixture: ComponentFixture<InvestmentTransactionPage>;
  let component: InvestmentTransactionPage;
  let api: {
    page: ReturnType<typeof vi.fn>;
    createInvestmentTransactionImport: ReturnType<typeof vi.fn>;
    investmentImportState: ReturnType<typeof vi.fn>;
    confirmInvestmentTransactions: ReturnType<typeof vi.fn>;
    runInvestmentAiJob: ReturnType<typeof vi.fn>;
    cancelInvestmentAiJob: ReturnType<typeof vi.fn>
  };

  const file = (aiStatus: InvestmentImportState['files'][number]['aiStatus']) => ({
    attachmentId: 10, originalName: 'receipt.png', contentUrl: '/content', aiStatus, aiError: null,
    createdAt: '2026-08-18T02:30:00Z', committedCount: 2
  });
  const readyState: InvestmentImportState = {
    accountId: 7,
    files: [file('READY')],
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
      createInvestmentTransactionImport: vi.fn().mockReturnValue(of(readyState)),
      investmentImportState: vi.fn().mockReturnValue(of(readyState)),
      confirmInvestmentTransactions: vi.fn().mockReturnValue(of({inserted: 1, updated: 0, skipped: 0, failed: 0, results: []})),
      runInvestmentAiJob: vi.fn().mockReturnValue(of({})),
      cancelInvestmentAiJob: vi.fn().mockReturnValue(of({}))
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

  it('loads import state when the account is selected', () => {
    expect(api.investmentImportState).toHaveBeenCalledWith(7);
    expect(component.state()?.files[0].committedCount).toBe(2);
    expect(component.reviewItems()[0].resolution).toBe('ACCEPT');
  });

  it('validates client file limits and accepts supported images', () => {
    const png = new File([new Uint8Array([1, 2, 3])], 'receipt.png', {type: 'image/png'});
    component.chooseFiles({target: {files: [png], value: ''}} as unknown as Event);
    expect(component.selectedFiles()).toEqual([png]);

    const tooMany = Array.from({length: 10}, (_, index) =>
      new File(['x'], `receipt-${index}.png`, {type: 'image/png'}));
    component.chooseFiles({target: {files: tooMany, value: ''}} as unknown as Event);
    expect(component.error()).toContain('up to 10 files');
  });

  it('applies conflict resolution to a review item', () => {
    component.openResolution(component.reviewItems()[0]);
    component.resolveConflict('SAVE_AS_NEW');
    expect(component.reviewItems()[0].resolution).toBe('SAVE_AS_NEW');
  });

  it('polls while a file is processing, then confirms and reloads', async () => {
    vi.useFakeTimers();
    api.createInvestmentTransactionImport.mockReturnValue(of({...readyState, files: [file('PENDING')], transactions: []}));
    const png = new File(['x'], 'receipt.png', {type: 'image/png'});
    component.chooseFiles({target: {files: [png], value: ''}} as unknown as Event);
    component.upload();
    expect(component.state()?.files[0].aiStatus).toBe('PENDING');
    api.investmentImportState.mockClear();
    await vi.advanceTimersByTimeAsync(3000);
    expect(api.investmentImportState).toHaveBeenCalledWith(7);
    expect(component.state()?.files[0].aiStatus).toBe('READY');

    component.confirm();
    expect(api.confirmInvestmentTransactions.mock.calls[0][0]).toBe(7);
    expect(component.confirmResult()?.inserted).toBe(1);
    vi.useRealTimers();
  });

  it('retries and cancels files through the AI job endpoints', () => {
    component.retryFile(10);
    expect(api.runInvestmentAiJob).toHaveBeenCalledWith(10, false);
    component.cancelFile(10);
    expect(api.cancelInvestmentAiJob).toHaveBeenCalledWith(10, false);
  });
});
