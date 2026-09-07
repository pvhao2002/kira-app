import {ChangeDetectionStrategy, Component, computed, DestroyRef, HostListener, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {DomSanitizer} from '@angular/platform-browser';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize, interval} from 'rxjs';
import {TravelApiService} from '../../core/services/travel-api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {AuthStore} from '../../core/auth/auth.store';
import {TravelActivity, TravelBooking, TravelData, TravelExpense, TravelFile, TravelPacking, TravelPlace, TravelTrip} from '../../shared/models/travel.models';

type Collection = 'activities' | 'packing' | 'expenses' | 'bookings' | 'places';
type Tab = 'overview' | 'itinerary' | 'packing' | 'expenses' | 'bookings' | 'places';
type Item = TravelActivity | TravelPacking | TravelExpense | TravelBooking | TravelPlace;

@Component({
  selector: 'app-travel-page', imports: [FormsModule, DatePipe],
  templateUrl: './travel.page.html', styleUrl: './travel.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelPage {
  readonly i18n = inject(LanguageService);
  private readonly api = inject(TravelApiService);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  readonly trips = signal<TravelTrip[]>([]);
  readonly selected = signal<TravelTrip | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly query = signal('');
  readonly tab = signal<Tab>('overview');
  readonly editor = signal<Collection | 'trip' | null>(null);
  readonly editingExistingTrip = signal(false);
  readonly files = signal<TravelFile[]>([]);
  readonly filesLoading = signal(false);
  readonly filesError = signal(false);
  readonly mapPlace = signal<TravelPlace | null>(null);
  private readonly now = signal(Date.now());
  private editingId: string | null = null;
  readonly tabs: Tab[] = ['overview', 'itinerary', 'packing', 'expenses', 'bookings', 'places'];
  readonly currencies = ['VND', 'USD', 'EUR', 'JPY', 'THB', 'GBP', 'SGD'];
  readonly bookingTypes = ['FLIGHT', 'STAY', 'TRAIN', 'BUS', 'ACTIVITY', 'OTHER'];
  tripDraft!: TravelData;
  activity!: TravelActivity;
  packing!: TravelPacking;
  expense!: TravelExpense;
  booking!: TravelBooking;
  place!: TravelPlace;
  readonly filteredTrips = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.trips().filter(t => `${t.data.name} ${t.data.destination}`.toLocaleLowerCase().includes(query));
  });
  readonly packed = computed(() => this.selected()?.data.packing.filter(p => p.packed).length ?? 0);
  readonly days = computed(() => {
    const trip = this.selected();
    if (!trip) return [];
    const result: {date: string; activities: TravelActivity[]}[] = [];
    const end = Date.parse(`${trip.data.endDate}T00:00:00Z`);
    for (let time = Date.parse(`${trip.data.startDate}T00:00:00Z`); time <= end; time += 86400000) {
      const date = new Date(time).toISOString().slice(0, 10);
      result.push({date, activities: trip.data.activities.filter(a => a.date === date).sort((a, b) => a.time.localeCompare(b.time))});
    }
    return result;
  });
  readonly mapUrl = computed(() => {
    const place = this.mapPlace();
    if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return null;
    const lat = Math.max(-90, Math.min(90, place.latitude));
    const lon = Math.max(-180, Math.min(180, place.longitude));
    const box = [Math.max(-180, lon - .025), Math.max(-90, lat - .02), Math.min(180, lon + .025), Math.min(90, lat + .02)].join(',');
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box)}&layer=mapnik&marker=${lat},${lon}`);
  });

  constructor() {
    this.load();
    interval(30000).pipe(takeUntilDestroyed()).subscribe(() => this.now.set(Date.now()));
  }
  t(key: string): string { return this.i18n.t(`travel.${key}`); }
  canLeave(): boolean { return !this.busy() && (!this.editor() || window.confirm(this.t('discard'))); }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void { if (this.editor() || this.busy()) event.preventDefault(); }
  load(): void {
    if (this.busy() || (this.editor() && !this.canLeave())) return;
    this.editor.set(null); this.loading.set(true); this.error.set('');
    const selectedId = this.selected()?.id;
    this.api.list().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))).subscribe({
      next: trips => { this.trips.set(trips); this.select(trips.find(t => t.id === selectedId) ?? trips[0] ?? null); },
      error: () => this.error.set(this.t('error'))
    });
  }
  select(trip: TravelTrip | null): void {
    if (!this.canLeave()) return;
    this.editor.set(null); this.error.set(''); this.notice.set(''); this.selected.set(trip);
    this.mapPlace.set(trip?.data.places[0] ?? null); this.files.set([]);
    if (trip) this.loadFiles(trip.id);
  }
  changeTab(tab: Tab): void {
    if (!this.canLeave()) return;
    this.editor.set(null); this.error.set(''); this.tab.set(tab);
  }
  private dateInZone(timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(this.now());
    const get = (type: string) => parts.find(p => p.type === type)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  countdown(trip: TravelTrip): string {
    const today = this.dateInZone(trip.data.timezone);
    const days = Math.round((Date.parse(`${trip.data.startDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    if (days > 0) return this.i18n.t('travel.daysLeft', {days});
    if (days === 0) return this.t('today');
    return this.t(today <= trip.data.endDate ? 'ongoing' : 'finished');
  }
  money(amount: number, currency = this.selected()?.data.currency ?? 'VND'): string {
    return new Intl.NumberFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US', {style: 'currency', currency}).format(amount);
  }
  moneyStep(currency = this.selected()?.data.currency ?? 'VND'): number { return ['VND', 'JPY'].includes(currency) ? 1 : .01; }
  memberName(id: string): string { return this.selected()?.data.members.find(m => m.id === id)?.name ?? id; }
  openTrip(trip: TravelTrip | null): void {
    if (!this.canLeave()) return;
    this.editingId = trip?.id ?? null;
    this.editingExistingTrip.set(trip !== null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = this.dateInZone(timezone);
    this.tripDraft = trip ? structuredClone(trip.data) : {
      name: '', destination: '', startDate: date, endDate: date, timezone, currency: 'VND', budget: 0, notes: '',
      members: [{id: crypto.randomUUID(), name: this.auth.user()?.fullName ?? ''}],
      activities: [], packing: [], expenses: [], bookings: [], places: []
    };
    this.error.set(''); this.editor.set('trip');
  }
  addMember(): void { if (this.tripDraft.members.length < 50) this.tripDraft.members.push({id: crypto.randomUUID(), name: ''}); }
  removeMember(id: string): void {
    if (this.tripDraft.expenses.some(e => e.paidBy === id || e.participants.includes(id))) { this.error.set(this.t('memberInUse')); return; }
    this.tripDraft.members = this.tripDraft.members.filter(m => m.id !== id);
  }
  saveTrip(): void {
    const data = this.tripDraft;
    try { new Intl.DateTimeFormat('en', {timeZone: data.timezone}).format(); }
    catch { this.error.set(this.t('invalid')); return; }
    const length = (Date.parse(data.endDate) - Date.parse(data.startDate)) / 86400000;
    if (!Number.isFinite(length) || length < 0 || length > 730 || data.activities.some(a => a.date < data.startDate || a.date > data.endDate)
      || !data.name.trim() || !data.destination.trim() || !data.members.length || data.members.some(m => !m.name.trim())) {
      this.error.set(this.t('invalid')); return;
    }
    this.persist(data, this.editingId);
  }
  cancel(): void { if (this.canLeave()) { this.editor.set(null); this.error.set(''); } }
  private persist(data: TravelData, id: string | null = this.selected()?.id ?? null): void {
    if (this.busy()) return;
    const version = id ? this.trips().find(t => t.id === id)?.version : -1;
    if (version === undefined) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    this.api.save(id, data, version).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: trip => {
        this.trips.update(trips => [trip, ...trips.filter(t => t.id !== trip.id)]);
        this.selected.set(trip); this.editor.set(null); this.notice.set(this.t('saved'));
        this.mapPlace.set(trip.data.places.find(p => p.id === this.mapPlace()?.id) ?? trip.data.places[0] ?? null);
        if (!id) { this.tab.set('overview'); this.loadFiles(trip.id); }
      },
      error: e => this.error.set(this.t(e.status === 409 ? 'conflict' : e.status === 400 ? 'invalid' : 'error'))
    });
  }
  openItem(key: Collection, item?: Item): void {
    if (!this.canLeave()) return;
    const trip = this.selected(); if (!trip) return;
    const id = crypto.randomUUID(), date = trip.data.startDate;
    if (key === 'activities') this.activity = item ? structuredClone(item as TravelActivity) : {id, date, time: '', title: '', location: '', notes: ''};
    if (key === 'packing') this.packing = item ? structuredClone(item as TravelPacking) : {id, name: '', category: this.t('essentials'), quantity: 1, packed: false};
    if (key === 'expenses') this.expense = item ? structuredClone(item as TravelExpense) : {id, date, title: '', amount: 0, paidBy: trip.data.members[0].id, participants: trip.data.members.map(m => m.id)};
    if (key === 'bookings') this.booking = item ? structuredClone(item as TravelBooking) : {id, date, title: '', type: 'FLIGHT', reference: '', notes: '', url: ''};
    if (key === 'places') this.place = item ? structuredClone(item as TravelPlace) : {id, name: '', address: '', latitude: 0, longitude: 0, notes: '', visited: false};
    this.error.set(''); this.editor.set(key);
  }
  participant(id: string, included: boolean): void {
    this.expense.participants = included ? [...new Set([...this.expense.participants, id])] : this.expense.participants.filter(p => p !== id);
  }
  saveItem(): void {
    const key = this.editor(); const trip = this.selected();
    if (!key || key === 'trip' || !trip) return;
    const item = {activities: this.activity, packing: this.packing, expenses: this.expense, bookings: this.booking, places: this.place}[key];
    if (key === 'expenses' && this.expense.participants.length === 0) { this.error.set(this.t('invalid')); return; }
    if (key === 'packing' && !Number.isInteger(this.packing.quantity)) { this.error.set(this.t('invalid')); return; }
    if (key === 'activities' && (this.activity.date < trip.data.startDate || this.activity.date > trip.data.endDate)) {
      this.error.set(this.t('invalid')); return;
    }
    const items: Item[] = [...trip.data[key]];
    const index = items.findIndex(i => i.id === item.id);
    if (index < 0) items.push(item); else items[index] = item;
    this.persist({...trip.data, [key]: items});
  }
  removeItem(key: Collection, id: string): void {
    const trip = this.selected(); if (!trip || this.busy() || !window.confirm(this.t('confirmItem'))) return;
    this.persist({...trip.data, [key]: trip.data[key].filter(i => i.id !== id)});
  }
  toggle(key: 'packing' | 'places', id: string): void {
    const trip = this.selected(); if (!trip || this.busy()) return;
    const data = structuredClone(trip.data);
    if (key === 'packing') { const item = data.packing.find(p => p.id === id); if (item) item.packed = !item.packed; }
    else { const item = data.places.find(p => p.id === id); if (item) item.visited = !item.visited; }
    this.persist(data);
  }
  deleteTrip(): void {
    const trip = this.selected(); if (!trip || this.busy() || !window.confirm(this.t('confirmTrip'))) return;
    this.busy.set(true); this.error.set('');
    this.api.delete(trip).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.trips.update(trips => trips.filter(t => t.id !== trip.id));
        this.selected.set(null); this.files.set([]); this.mapPlace.set(null);
      }, error: e => this.error.set(this.t(e.status === 409 ? 'conflict' : 'error'))
    });
  }
  loadFiles(id = this.selected()?.id): void {
    if (!id) return;
    this.filesLoading.set(true); this.filesError.set(false);
    this.api.files(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: files => { if (this.selected()?.id === id) { this.files.set(files); this.filesLoading.set(false); } },
      error: () => { if (this.selected()?.id === id) { this.filesError.set(true); this.filesLoading.set(false); } }
    });
  }
  upload(event: Event): void {
    const input = event.target as HTMLInputElement, file = input.files?.[0], trip = this.selected(); input.value = '';
    if (!file || !trip || this.busy()) return;
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      this.error.set(this.t('fileInvalid')); return;
    }
    this.busy.set(true); this.error.set('');
    this.api.upload(trip.id, file).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: () => this.loadFiles(trip.id), error: () => this.error.set(this.t('error'))
    });
  }
  download(file: TravelFile): void {
    const trip = this.selected(); if (!trip || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.api.download(trip.id, file.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: blob => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); },
      error: () => this.error.set(this.t('error'))
    });
  }
  deleteFile(file: TravelFile): void {
    const trip = this.selected(); if (!trip || this.busy() || !window.confirm(this.t('confirmFile'))) return;
    this.busy.set(true); this.error.set('');
    this.api.deleteFile(trip.id, file.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: () => this.loadFiles(trip.id), error: () => this.error.set(this.t('error'))
    });
  }
  directions(place: TravelPlace): string { return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`; }
}
