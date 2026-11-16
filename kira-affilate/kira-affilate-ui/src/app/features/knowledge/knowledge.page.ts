import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {GUIDES} from '../../content/guides';
import {KnowledgeEntry} from '../../content/knowledge';
import {LEGAL} from '../../content/legal';
import {TAX} from '../../content/tax';
import {KnowledgeCenter} from '../../shared/knowledge-center/knowledge-center';
import {TaxCalculator} from './tax-calculator';

type Topic = 'guides' | 'tax' | 'legal';

const TOPICS: Record<Topic, {title: string; intro: string; entries: KnowledgeEntry[]}> = {
  guides: {title: 'Hướng dẫn Affiliate', intro: 'Cách làm tiếp thị liên kết Shopee đúng chính sách và hiệu quả.', entries: GUIDES},
  tax: {title: 'Thuế & Thu nhập', intro: 'Nghĩa vụ thuế đối với thu nhập từ tiếp thị liên kết.', entries: TAX},
  legal: {title: 'Pháp luật Việt Nam', intro: 'Quy định pháp luật liên quan đến quảng cáo và tiếp thị liên kết.', entries: LEGAL}
};

@Component({
  selector: 'app-knowledge-page',
  imports: [KnowledgeCenter, TaxCalculator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header>
        <h1 data-testid="page-heading">{{ view().title }}</h1>
        <p class="muted mt-0.5">{{ view().intro }}</p>
      </header>
      @if (topic() === 'tax') {
        <app-tax-calculator/>
      }
      <app-knowledge-center [entries]="view().entries"/>
    </div>
  `
})
export class KnowledgePage {
  /** Bound from route data. */
  readonly topic = input.required<Topic>();
  protected readonly view = computed(() => TOPICS[this.topic()]);
}
