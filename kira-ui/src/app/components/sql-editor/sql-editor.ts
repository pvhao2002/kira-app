import {Component, effect, ElementRef, input, output, signal, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-sql-editor',
  imports: [
    FormsModule
  ],
  templateUrl: './sql-editor.html',
  styleUrl: './sql-editor.scss',
})
export class SqlEditor {
  data = signal<any[]>([]);
  executionTime = input<number>(0);
  rowCount = input<number>(0);
  query = input<string>(`
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
  isExecuting = input<boolean>(false);
  execute = output<string>();


  localQuery = `
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
  `;
  lines = signal<number[]>([]);

  textAreaRef = viewChild<ElementRef>('textArea');
  lineNumbersRef = viewChild<ElementRef>('lineNumbers');

  // State quản lý chế độ hiển thị
  isInputMode = signal(true);

  // Object chứa dữ liệu input theo yêu cầu của bạn
  inputData = {
    firstHdc: '-0.5#+0.5',
    lastHdc: '-0.5/1#+0.5/1',
    firstOu: '2.5/3',
    lastOu: '2.5',
    firstCorner: '9.5',
    lastCorner: '9.5',
    htScoreStr: '',
    mode: 'FT'
  };

  constructor(protected readonly http: HttpClient) {
    effect(() => {
      this.localQuery = this.query();
      this.updateLineCount();
    });
  }

  updateLineCount() {
    const lineCount = this.localQuery.split('\n').length;
    // Always ensure at least 8 lines for visual consistency
    const count = Math.max(lineCount, 8);
    this.lines.set(Array.from({length: count}, (_, i) => i + 1));
  }

  syncScroll() {
    const textArea = this.textAreaRef()?.nativeElement;
    const lineNumbers = this.lineNumbersRef()?.nativeElement;
    if (textArea && lineNumbers) {
      lineNumbers.scrollTop = textArea.scrollTop;
    }
  }

  onExecute() {
    const p = this.isInputMode()
      ? this.inputData
      : this.localQuery;

    this.http.post<any[]>('api/sql/execute', p).subscribe(res => {
      this.data.set(res);
    });
  }
}
