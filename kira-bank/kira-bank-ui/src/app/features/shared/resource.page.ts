import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ApiService} from '../../core/services/api.service';

type Row = Record<string, unknown>;

@Component({
  selector: 'app-resource',
  templateUrl: './resource.page.html',
  styleUrl: './resource.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourcePage {
  readonly flowLabel = this.flow === 'credit' ? 'FLOW 1 · THẺ TÍN DỤNG' : this.flow === 'investment' ? 'FLOW 2 · ĐẦU TƯ WEBSITE' : 'HỆ THỐNG';
  readonly loading = signal(true);
  readonly rows = signal<Row[]>([]);
  readonly total = signal(0);
  readonly open = signal(false);
  readonly columns = signal<string[]>([]);
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] as string;
  readonly apiPath = this.route.snapshot.data['api'] as string;
  readonly flow = this.route.snapshot.data['flow'] as string;
  private readonly api = inject(ApiService);

  constructor() {
    this.api.page<Row>(this.apiPath).subscribe({
      next: response => {
        this.rows.set(response.data);
        this.total.set(response.meta.totalElements);
        this.columns.set(response.data[0] ? Object.keys(response.data[0]).filter(column => !['note', 'deletedAt'].includes(column)).slice(0, 6) : []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  label(column: string): string {
    return column.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase());
  }

  display(value: unknown): string {
    if (typeof value === 'number') return value.toLocaleString('vi-VN');
    if (value === null || value === undefined) return '—';
    return String(value);
  }
}
