import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {HttpClient} from '@angular/common/http';

interface SqlInputData {
  firstHdc: string;
  lastHdc: string;
  firstOu: string;
  lastOu: string;
  firstCorner: string;
  lastCorner: string;
  htScoreStr: string;
  mode: string;
}

const DEFAULT_INPUT_DATA: SqlInputData = {
  firstHdc: '-0.5#+0.5',
  lastHdc: '-0.5/1#+0.5/1',
  firstOu: '2.5/3',
  lastOu: '2.5',
  firstCorner: '9.5',
  lastCorner: '9.5',
  htScoreStr: '',
  mode: 'FT',
};

@Component({
  selector: 'app-sql-editor',
  templateUrl: './sql-editor.html',
  styleUrl: './sql-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SqlEditor {
  private readonly http = inject(HttpClient);

  readonly data = signal<any[]>([]);
  readonly executionTime = input<number>(0);
  readonly rowCount = input<number>(0);
  readonly query = input<string>(`
    select ft_score_str as ft,
           count(1) count
    from event_analyst
    where first_hdc = '-0/0.5#+0/0.5'
      and last_hdc = '-0.5/1#+0.5/1'
      and first_ou = '3.5'
      and last_ou = '3.5'
      and first_corner = '10.5'
      and last_corner = '10.5'
    group by ft_score_str
    order by count desc
      limit 5
  `);
  readonly isExecuting = input<boolean>(false);
  readonly execute = output<string>();

  readonly localQuery = signal('');
  readonly lines = signal<number[]>([]);

  readonly textAreaRef = viewChild<ElementRef>('textArea');
  readonly lineNumbersRef = viewChild<ElementRef>('lineNumbers');

  readonly isInputMode = signal(true);
  readonly inputData = signal<SqlInputData>({...DEFAULT_INPUT_DATA});

  constructor() {
    effect(() => {
      this.localQuery.set(this.query());
      this.updateLineCount();
    });
  }

  updateLineCount(): void {
    const lineCount = this.localQuery().split('\n').length;
    const count = Math.max(lineCount, 8);
    this.lines.set(Array.from({length: count}, (_, i) => i + 1));
  }

  onLocalQueryInput(value: string): void {
    this.localQuery.set(value);
    this.updateLineCount();
  }

  setInputMode(mode: string): void {
    this.inputData.update((d) => ({...d, mode}));
  }

  updateInputField(field: keyof SqlInputData, value: string): void {
    this.inputData.update((d) => ({...d, [field]: value}));
  }

  syncScroll(): void {
    const textArea = this.textAreaRef()?.nativeElement;
    const lineNumbers = this.lineNumbersRef()?.nativeElement;
    if (textArea && lineNumbers) {
      lineNumbers.scrollTop = textArea.scrollTop;
    }
  }

  onExecute(): void {
    const p = this.isInputMode() ? this.inputData() : this.localQuery();

    this.http.post<any[]>('api/sql/execute', p).subscribe((res) => {
      this.data.set(res);
    });
  }
}
