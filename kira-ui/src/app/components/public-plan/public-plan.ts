import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {
  TravelChecklistApiService,
  TravelChecklistGroupDto,
  TravelChecklistItemDto,
  TravelChecklistPlanDto
} from '../../services/travel-checklist-api.service';
import {formatVnd} from '../../utils/format-vnd';

@Component({
  selector: 'app-public-plan',
  imports: [RouterLink],
  templateUrl: './public-plan.html',
  styleUrl: './public-plan.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPlan {
  private readonly checklistApi = inject(TravelChecklistApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly plans = signal<TravelChecklistPlanDto[]>([]);

  constructor() {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);
    this.checklistApi.listPublished().subscribe({
      next: plans => {
        this.plans.set(this.sortPlanItems(plans));
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        const raw = err?.error?.message ?? err?.message ?? 'Unable to load public travel plans.';
        this.error.set(typeof raw === 'string' ? raw : 'Unable to load public travel plans.');
      }
    });
  }

  groupScheduleLabel(group: TravelChecklistGroupDto): string {
    if (this.isCheckListGroup(group)) {
      return 'Packing checklist';
    }
    if (group.scheduleType === 'DAY') {
      return group.scheduleDate ?? 'No date';
    }
    return `${this.formatDisplayTime(group.startTime) ?? '--:--'} - ${this.formatDisplayTime(group.endTime) ?? '--:--'}`;
  }

  groupIcon(group: TravelChecklistGroupDto): string {
    if (this.isCheckListGroup(group)) {
      return 'inventory_2';
    }
    return group.scheduleType === 'DAY' ? 'calendar_today' : 'schedule';
  }

  itemActivity(item: TravelChecklistItemDto): string {
    return item.activity?.trim() || item.content?.trim() || 'Untitled activity';
  }

  itemTime(item: TravelChecklistItemDto): string | null {
    return this.formatDisplayTime(item.activityTime);
  }

  isCheckListGroup(group: TravelChecklistGroupDto): boolean {
    return group.scheduleType === 'CHECK_LIST';
  }

  formatVnd(n: number | null | undefined): string {
    return n == null ? '' : formatVnd(n);
  }

  completedCount(plan: TravelChecklistPlanDto): number {
    return plan.groups.flatMap(group => group.items).filter(item => item.checked).length;
  }

  totalCount(plan: TravelChecklistPlanDto): number {
    return plan.groups.flatMap(group => group.items).length;
  }

  private sortPlanItems(plans: TravelChecklistPlanDto[]): TravelChecklistPlanDto[] {
    return plans.map(plan => ({
      ...plan,
      groups: plan.groups.map(group => ({
        ...group,
        items: this.sortItemsByTime(group.items)
      }))
    }));
  }

  private sortItemsByTime(items: TravelChecklistItemDto[]): TravelChecklistItemDto[] {
    return [...items].sort((a, b) => {
      const timeA = this.timeSortValue(a.activityTime);
      const timeB = this.timeSortValue(b.activityTime);
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.itemId - b.itemId;
    });
  }

  private timeSortValue(raw: string | null): number {
    const trimmed = this.trimTime(raw);
    if (!trimmed) {
      return Number.MAX_SAFE_INTEGER;
    }
    const [hourRaw, minuteRaw = '0'] = trimmed.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return hour * 60 + minute;
  }

  private trimTime(raw: string | null): string | null {
    return raw ? raw.slice(0, 5) : null;
  }

  private formatDisplayTime(raw: string | null): string | null {
    const trimmed = this.trimTime(raw);
    if (!trimmed) {
      return null;
    }
    const [hourRaw, minute = '00'] = trimmed.split(':');
    const hour = Number(hourRaw);
    if (!Number.isFinite(hour)) {
      return trimmed;
    }
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute} ${period}`;
  }
}
