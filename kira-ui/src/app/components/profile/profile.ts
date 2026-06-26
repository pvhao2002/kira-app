import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {AuthService} from '../../config/AuthService';
import {ToastService} from '../../config/ToastService';
import {
  TravelChecklistApiService,
  TravelChecklistGroupDto,
  TravelChecklistItemDto,
  TravelChecklistPlanDto,
  TravelChecklistScheduleType
} from '../../services/travel-checklist-api.service';
import {formatVnd, parseVndInput} from '../../utils/format-vnd';

type TravelChecklistItemDraft = {
  activityTime: string;
  activity: string;
  address: string;
  cost: string;
  note: string;
};

const emptyItemDraft: TravelChecklistItemDraft = {
  activityTime: '',
  activity: '',
  address: '',
  cost: '',
  note: ''
};

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly authService = inject(AuthService);
  private readonly checklistApi = inject(TravelChecklistApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly avatarLoadFailed = signal(false);

  readonly user = this.authService.user;
  readonly checklistLoading = signal(true);
  readonly checklistError = signal<string | null>(null);
  readonly travelPlans = signal<TravelChecklistPlanDto[]>([]);
  readonly selectedPlanId = signal<number | null>(null);
  readonly newPlanName = signal('');
  readonly savingPlan = signal(false);
  readonly savingGroup = signal(false);
  readonly itemSavingId = signal<string | null>(null);

  readonly groupTitle = signal('');
  readonly groupType = signal<TravelChecklistScheduleType>('DAY');
  readonly groupDate = signal(this.todayIso());
  readonly groupStartTime = signal('09:00');
  readonly groupEndTime = signal('10:00');
  readonly itemDrafts = signal<Record<number, TravelChecklistItemDraft>>({});

  readonly selectedPlan = computed(() => {
    const selectedId = this.selectedPlanId();
    const plans = this.travelPlans();
    if (selectedId === null) {
      return plans[0] ?? null;
    }
    return plans.find(plan => plan.planId === selectedId) ?? plans[0] ?? null;
  });

  readonly selectedPlanStats = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) {
      return {total: 0, checked: 0};
    }
    const items = plan.groups.flatMap(group => group.items);
    return {
      total: items.length,
      checked: items.filter(item => item.checked).length
    };
  });

  readonly avatarUrl = computed(() => {
    const currentUser = this.user();
    if (!currentUser) {
      return this.getFallbackAvatar('User');
    }
    if (this.avatarLoadFailed()) {
      return this.getFallbackAvatar(currentUser.username);
    }
    const avatar = currentUser.avatar?.trim();
    return avatar ? avatar : this.getFallbackAvatar(currentUser.username);
  });

  constructor() {
    this.reloadTravelPlans();
  }

  onAvatarError(): void {
    this.avatarLoadFailed.set(true);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/']);
      },
      error: () => {
        this.authService.clearSession();
        void this.router.navigate(['/']);
      }
    });
  }

  reloadTravelPlans(): void {
    this.checklistLoading.set(true);
    this.checklistError.set(null);
    this.checklistApi.list().subscribe({
      next: plans => {
        this.travelPlans.set(plans);
        const current = this.selectedPlanId();
        if (plans.length === 0) {
          this.selectedPlanId.set(null);
        } else if (current === null || !plans.some(plan => plan.planId === current)) {
          this.selectedPlanId.set(plans[0].planId);
        }
        this.checklistLoading.set(false);
      },
      error: err => {
        this.checklistLoading.set(false);
        const raw = err?.error?.message ?? err?.message ?? 'Unable to load travel checklist plans.';
        this.checklistError.set(typeof raw === 'string' ? raw : 'Unable to load travel checklist plans.');
      }
    });
  }

  createPlan(): void {
    const planName = this.newPlanName().trim();
    if (!planName) {
      this.toast.error('Plan name is required.');
      return;
    }
    this.savingPlan.set(true);
    this.checklistApi.createPlan(planName).subscribe({
      next: plan => {
        this.savingPlan.set(false);
        this.newPlanName.set('');
        this.selectedPlanId.set(plan.planId);
        this.toast.success('Travel plan saved.');
        this.reloadTravelPlans();
      },
      error: err => {
        this.savingPlan.set(false);
        this.showApiError(err, 'Unable to save travel plan.');
      }
    });
  }

  renamePlan(plan: TravelChecklistPlanDto): void {
    const nextName = globalThis.prompt('Plan name', plan.planName)?.trim();
    if (!nextName || nextName === plan.planName) {
      return;
    }
    this.checklistApi.updatePlan(plan.planId, {planName: nextName}).subscribe({
      next: () => {
        this.toast.success('Plan renamed.');
        this.reloadTravelPlans();
      },
      error: err => this.showApiError(err, 'Unable to rename plan.')
    });
  }

  togglePlanPublished(plan: TravelChecklistPlanDto): void {
    this.checklistApi.updatePlan(plan.planId, {published: !plan.published}).subscribe({
      next: updated => {
        this.toast.success(updated.published ? 'Plan published.' : 'Plan unpublished.');
        this.reloadTravelPlans();
      },
      error: err => this.showApiError(err, 'Unable to update public visibility.')
    });
  }

  deletePlan(plan: TravelChecklistPlanDto): void {
    if (!globalThis.confirm(`Delete travel plan "${plan.planName}"?`)) {
      return;
    }
    this.checklistApi.deletePlan(plan.planId).subscribe({
      next: () => {
        this.toast.success('Plan deleted.');
        this.reloadTravelPlans();
      },
      error: err => this.showApiError(err, 'Unable to delete plan.')
    });
  }

  createGroup(): void {
    const plan = this.selectedPlan();
    if (!plan) {
      this.toast.error('Create a plan first.');
      return;
    }
    const title = this.groupTitle().trim();
    if (!title) {
      this.toast.error('Checklist group title is required.');
      return;
    }
    const scheduleType = this.groupType();
    const payload = scheduleType === 'DAY'
      ? {
        scheduleType,
        scheduleDate: this.groupDate(),
        title,
        sortOrder: plan.groups.length
      }
      : {
        scheduleType,
        startTime: this.groupStartTime(),
        endTime: this.groupEndTime(),
        title,
        sortOrder: plan.groups.length
      };
    this.savingGroup.set(true);
    this.checklistApi.createGroup(plan.planId, payload).subscribe({
      next: () => {
        this.savingGroup.set(false);
        this.groupTitle.set('');
        this.toast.success('Checklist group added.');
        this.reloadTravelPlans();
      },
      error: err => {
        this.savingGroup.set(false);
        this.showApiError(err, 'Unable to add checklist group.');
      }
    });
  }

  editGroup(plan: TravelChecklistPlanDto, group: TravelChecklistGroupDto): void {
    if (this.isCheckListGroup(group)) {
      return;
    }
    const nextTitle = globalThis.prompt('Group title', group.title)?.trim();
    if (!nextTitle) {
      return;
    }
    const body: {
      title: string;
      scheduleDate?: string | null;
      startTime?: string | null;
      endTime?: string | null;
    } = {title: nextTitle};
    if (group.scheduleType === 'DAY') {
      const nextDate = globalThis.prompt('Schedule date (YYYY-MM-DD)', group.scheduleDate ?? this.todayIso())?.trim();
      if (!nextDate) {
        return;
      }
      body.scheduleDate = nextDate;
    } else {
      const nextStart = globalThis.prompt('Start time (HH:mm)', this.trimTime(group.startTime) ?? '09:00')?.trim();
      const nextEnd = globalThis.prompt('End time (HH:mm)', this.trimTime(group.endTime) ?? '10:00')?.trim();
      if (!nextStart || !nextEnd) {
        return;
      }
      body.startTime = nextStart;
      body.endTime = nextEnd;
    }
    this.checklistApi.updateGroup(plan.planId, group.groupId, body).subscribe({
      next: () => {
        this.toast.success('Group updated.');
        this.reloadTravelPlans();
      },
      error: err => this.showApiError(err, 'Unable to update group.')
    });
  }

  deleteGroup(plan: TravelChecklistPlanDto, group: TravelChecklistGroupDto): void {
    if (this.isCheckListGroup(group)) {
      this.toast.error('Check List group cannot be deleted.');
      return;
    }
    if (!globalThis.confirm(`Delete checklist group "${group.title}"?`)) {
      return;
    }
    this.checklistApi.deleteGroup(plan.planId, group.groupId).subscribe({
      next: () => {
        this.toast.success('Group deleted.');
        this.reloadTravelPlans();
      },
      error: err => this.showApiError(err, 'Unable to delete group.')
    });
  }

  itemDraft(groupId: number): TravelChecklistItemDraft {
    return this.itemDrafts()[groupId] ?? emptyItemDraft;
  }

  setItemDraft(groupId: number, field: keyof TravelChecklistItemDraft, value: string): void {
    this.itemDrafts.update(drafts => ({
      ...drafts,
      [groupId]: {
        ...emptyItemDraft,
        ...(drafts[groupId] ?? {}),
        [field]: value
      }
    }));
  }

  addItem(plan: TravelChecklistPlanDto, group: TravelChecklistGroupDto): void {
    const draft = this.itemDraft(group.groupId);
    const activity = draft.activity.trim();
    if (!activity) {
      this.toast.error('Activity is required.');
      return;
    }
    const cost = draft.cost.trim() ? parseVndInput(draft.cost) : null;
    const checkListGroup = this.isCheckListGroup(group);
    this.itemSavingId.set(`add-${group.groupId}`);
    this.checklistApi.createItem(plan.planId, group.groupId, {
      activityTime: checkListGroup ? null : draft.activityTime.trim() || null,
      activity,
      address: checkListGroup ? null : draft.address.trim() || null,
      cost: checkListGroup ? null : cost,
      note: checkListGroup ? null : draft.note.trim() || null,
      sortOrder: group.items.length
    }).subscribe({
      next: created => {
        this.itemSavingId.set(null);
        this.itemDrafts.update(drafts => ({...drafts, [group.groupId]: emptyItemDraft}));
        this.addItemToState(plan.planId, group.groupId, created);
      },
      error: err => {
        this.itemSavingId.set(null);
        this.showApiError(err, 'Unable to add checklist detail.');
      }
    });
  }

  toggleItem(plan: TravelChecklistPlanDto, group: TravelChecklistGroupDto, item: TravelChecklistItemDto): void {
    this.itemSavingId.set(`item-${item.itemId}`);
    this.checklistApi.updateItem(plan.planId, group.groupId, item.itemId, {checked: !item.checked}).subscribe({
      next: updated => {
        this.itemSavingId.set(null);
        this.replaceItemInState(plan.planId, group.groupId, updated);
      },
      error: err => {
        this.itemSavingId.set(null);
        this.showApiError(err, 'Unable to update checklist detail.');
      }
    });
  }

  editItem(plan: TravelChecklistPlanDto, group: TravelChecklistGroupDto, item: TravelChecklistItemDto): void {
    if (this.isCheckListGroup(group)) {
      const activity = globalThis.prompt('Item name', this.itemActivity(item))?.trim();
      if (!activity) {
        return;
      }
      this.checklistApi.updateItem(plan.planId, group.groupId, item.itemId, {
        activity,
        activityTime: null,
        address: null,
        cost: null,
        note: null
      }).subscribe({
        next: updated => {
          this.toast.success('Item updated.');
          this.replaceItemInState(plan.planId, group.groupId, updated);
        },
        error: err => this.showApiError(err, 'Unable to update checklist item.')
      });
      return;
    }
    const activity = globalThis.prompt('Activity', this.itemActivity(item))?.trim();
    if (!activity) {
      return;
    }
    const activityTime = globalThis.prompt('Time (HH:mm)', this.trimTime(item.activityTime) ?? '')?.trim() ?? '';
    const address = globalThis.prompt('Address', item.address ?? '')?.trim() ?? '';
    const costRaw = globalThis.prompt('Cost (VND)', item.cost != null ? this.formatVnd(item.cost) : '')?.trim() ?? '';
    const note = globalThis.prompt('Note', item.note ?? '')?.trim() ?? '';
    this.checklistApi.updateItem(plan.planId, group.groupId, item.itemId, {
      activityTime: activityTime || null,
      activity,
      address,
      cost: costRaw ? parseVndInput(costRaw) : null,
      note
    }).subscribe({
      next: updated => {
        this.toast.success('Detail updated.');
        this.replaceItemInState(plan.planId, group.groupId, updated);
      },
      error: err => this.showApiError(err, 'Unable to update checklist detail.')
    });
  }

  deleteItem(plan: TravelChecklistPlanDto, group: TravelChecklistGroupDto, item: TravelChecklistItemDto): void {
    if (!globalThis.confirm(`Delete "${this.itemActivity(item)}"?`)) {
      return;
    }
    this.checklistApi.deleteItem(plan.planId, group.groupId, item.itemId).subscribe({
      next: () => this.removeItemFromState(plan.planId, group.groupId, item.itemId),
      error: err => this.showApiError(err, 'Unable to delete checklist detail.')
    });
  }

  groupScheduleLabel(group: TravelChecklistGroupDto): string {
    if (this.isCheckListGroup(group)) {
      return 'Packing checklist';
    }
    if (group.scheduleType === 'DAY') {
      return group.scheduleDate ?? 'No date';
    }
    const start = this.formatDisplayTime(group.startTime) ?? '--:--';
    const end = this.formatDisplayTime(group.endTime) ?? '--:--';
    return `${start} - ${end}`;
  }

  groupProgress(group: TravelChecklistGroupDto): string {
    const checked = group.items.filter(item => item.checked).length;
    return `${checked}/${group.items.length}`;
  }

  itemActivity(item: TravelChecklistItemDto): string {
    return item.activity?.trim() || item.content?.trim() || 'Untitled activity';
  }

  isCheckListGroup(group: TravelChecklistGroupDto): boolean {
    return group.scheduleType === 'CHECK_LIST';
  }

  formatVnd(n: number | null | undefined): string {
    return n == null ? '' : formatVnd(n);
  }

  formatDisplayTime(raw: string | null): string | null {
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

  private addItemToState(planId: number, groupId: number, item: TravelChecklistItemDto): void {
    this.updateGroupItems(planId, groupId, items => this.sortItemsByTime([...items, item]));
  }

  private replaceItemInState(planId: number, groupId: number, item: TravelChecklistItemDto): void {
    this.updateGroupItems(planId, groupId, items =>
      this.sortItemsByTime(items.map(existing => existing.itemId === item.itemId ? item : existing))
    );
  }

  private removeItemFromState(planId: number, groupId: number, itemId: number): void {
    this.updateGroupItems(planId, groupId, items => items.filter(item => item.itemId !== itemId));
  }

  private updateGroupItems(
    planId: number,
    groupId: number,
    updateItems: (items: TravelChecklistItemDto[]) => TravelChecklistItemDto[]
  ): void {
    this.travelPlans.update(plans => plans.map(plan => {
      if (plan.planId !== planId) {
        return plan;
      }
      return {
        ...plan,
        groups: plan.groups.map(group => {
          if (group.groupId !== groupId) {
            return group;
          }
          return {
            ...group,
            items: updateItems(group.items)
          };
        })
      };
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

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private showApiError(err: unknown, fallback: string): void {
    const e = err as {error?: {message?: unknown}; message?: unknown};
    const raw = e?.error?.message ?? e?.message ?? fallback;
    this.toast.error(typeof raw === 'string' ? raw : fallback);
  }

  private getFallbackAvatar(seed: string): string {
    return `https://ui-avatars.com/api/?background=1e293b&color=ffffff&name=${encodeURIComponent(seed)}`;
  }
}
