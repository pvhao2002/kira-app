import {ChangeDetectionStrategy, Component, computed, input, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {KnowledgeEntry} from '../../content/knowledge';
import {formatDate} from '../../core/format/formatters';
import {matchesSearch} from '../../core/format/text';
import {StateBox} from '../state-box';

const KINDS: Record<KnowledgeEntry['kind'], {label: string; tone: string}> = {
  legal: {label: 'Nghĩa vụ pháp lý', tone: 'bg-danger-soft text-danger'},
  policy: {label: 'Chính sách Shopee', tone: 'bg-brand-soft text-brand-strong'},
  recommendation: {label: 'Khuyến nghị', tone: 'bg-info-soft text-info'}
};

@Component({
  selector: 'app-knowledge-center',
  imports: [FormsModule, StateBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './knowledge-center.html'
})
export class KnowledgeCenter {
  readonly entries = input.required<KnowledgeEntry[]>();
  protected readonly kinds = KINDS;
  protected readonly formatDate = formatDate;
  protected readonly query = signal('');
  protected readonly category = signal<string | null>(null);

  protected readonly categories = computed(() => [...new Set(this.entries().map(e => e.category))]);

  protected readonly visible = computed(() => {
    const query = this.query(), category = this.category();
    return this.entries().filter(e =>
      (category === null || e.category === category) &&
      matchesSearch([e.title, e.category, ...e.body, ...(e.bullets ?? []), ...e.sources.flatMap(s => [s.title, s.number ?? ''])].join(' '), query));
  });

  /** Only http(s) links are rendered as links; anything else in the data is shown as text. */
  protected safeUrl(url: string | undefined): string | null {
    return url && /^https?:\/\//i.test(url) ? url : null;
  }

  protected chip(active: boolean): string {
    return `block w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors duration-150 lg:whitespace-normal ${
      active ? 'bg-brand-soft text-brand-strong' : 'text-muted hover:bg-white hover:text-ink'}`;
  }

  protected reset(): void {
    this.query.set('');
    this.category.set(null);
  }
}
