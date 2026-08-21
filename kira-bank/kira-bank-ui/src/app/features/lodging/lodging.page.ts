import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {IconComponent} from '../../shared/icon/icon';
import {AddressSuggestion, LodgingFee, LodgingListing, LodgingListingRequest, LodgingReferenceLocation, LodgingReview, LodgingReviewStatus} from '../../shared/models/api.models';

@Component({
  selector: 'app-lodging-page', imports: [ReactiveFormsModule, IconComponent], templateUrl: './lodging.page.html', styleUrls: ['./lodging.page.scss'], changeDetection: ChangeDetectionStrategy.OnPush
})
export class LodgingPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);
  readonly listings = signal<LodgingListing[]>([]);
  readonly locations = signal<LodgingReferenceLocation[]>([]);
  readonly reviews = signal<LodgingReview[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly search = signal('');
  readonly dialog = signal<'listing' | 'location' | 'review' | null>(null);
  readonly editing = signal<LodgingListing | null>(null);
  readonly reviewing = signal<LodgingListing | null>(null);
  readonly uploadFiles = signal<File[]>([]);
  readonly selectedLocationIds = signal<number[]>([]);
  readonly reviewStatus = signal<LodgingReviewStatus>('OK');
  readonly suggestions = signal<AddressSuggestion[]>([]);
  readonly suggestionTarget = signal<'listing' | 'location' | null>(null);
  readonly error = signal('');
  private autocompleteTimer: ReturnType<typeof setTimeout> | undefined;
  readonly listingForm = new FormGroup({
    address: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.maxLength(500)]}),
    rentPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    electricityAmount: new FormControl<number | null>(null), electricityUnit: new FormControl('KWH', {nonNullable: true}),
    waterAmount: new FormControl<number | null>(null), waterUnit: new FormControl('CUBIC_METER', {nonNullable: true}),
    serviceAmount: new FormControl<number | null>(null), serviceUnit: new FormControl('MONTH', {nonNullable: true}),
    parkingAmount: new FormControl<number | null>(null), parkingUnit: new FormControl('VEHICLE_MONTH', {nonNullable: true}),
    facebookUrl: new FormControl('', {nonNullable: true}), phone: new FormControl('', {nonNullable: true}), videoUrl: new FormControl('', {nonNullable: true}), note: new FormControl('', {nonNullable: true})
  });
  readonly locationForm = new FormGroup({name: new FormControl('', {nonNullable: true, validators: [Validators.required]}), address: new FormControl('', {nonNullable: true, validators: [Validators.required]})});
  readonly reviewForm = new FormGroup({reason: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(1000)]})});

  constructor() { this.load(); this.loadLocations(); }
  load(): void { this.loading.set(true); this.api.lodgings(this.page(), 20, this.search().trim()).pipe(finalize(() => this.loading.set(false))).subscribe({next: response => { this.listings.set(response.data); this.totalPages.set(response.meta.totalPages); }, error: () => this.error.set(this.i18n.t('lodging.loadFailed'))}); }
  loadLocations(): void { this.api.lodgingLocations().subscribe({next: locations => this.locations.set(locations)}); }
  searchListings(value: string): void { this.search.set(value); this.page.set(0); this.load(); }
  changePage(delta: number): void { const next = this.page() + delta; if (next < 0 || next >= this.totalPages()) return; this.page.set(next); this.load(); }
  openCreate(): void { this.editing.set(null); this.error.set(''); this.uploadFiles.set([]); this.selectedLocationIds.set([]); this.listingForm.reset({address: '', rentPrice: null, electricityAmount: null, electricityUnit: 'KWH', waterAmount: null, waterUnit: 'CUBIC_METER', serviceAmount: null, serviceUnit: 'MONTH', parkingAmount: null, parkingUnit: 'VEHICLE_MONTH', facebookUrl: '', phone: '', videoUrl: '', note: ''}); this.dialog.set('listing'); }
  openEdit(listing: LodgingListing): void { if (!listing.canEdit) return; this.editing.set(listing); this.error.set(''); this.uploadFiles.set([]); this.selectedLocationIds.set(listing.distances.map(distance => distance.referenceLocationId)); this.listingForm.reset({address: listing.address, rentPrice: listing.rentPrice, electricityAmount: listing.electricity?.amount ?? null, electricityUnit: listing.electricity?.unit ?? 'KWH', waterAmount: listing.water?.amount ?? null, waterUnit: listing.water?.unit ?? 'CUBIC_METER', serviceAmount: listing.service?.amount ?? null, serviceUnit: listing.service?.unit ?? 'MONTH', parkingAmount: listing.parking?.amount ?? null, parkingUnit: listing.parking?.unit ?? 'VEHICLE_MONTH', facebookUrl: listing.facebookUrl ?? '', phone: listing.phone ?? '', videoUrl: listing.videoUrl ?? '', note: listing.note ?? ''}); this.dialog.set('listing'); }
  closeDialog(): void { if (!this.saving()) this.dialog.set(null); }
  addressInput(target: 'listing' | 'location', value: string): void { const control = target === 'listing' ? this.listingForm.controls.address : this.locationForm.controls.address; control.setValue(value); this.suggestionTarget.set(target); this.suggestions.set([]); if (this.autocompleteTimer) clearTimeout(this.autocompleteTimer); if (value.trim().length < 3) return; this.autocompleteTimer = setTimeout(() => { const query = value.trim(); this.api.lodgingAddressSuggestions(query).subscribe({next: suggestions => { if (this.suggestionTarget() === target && control.value.trim() === query) this.suggestions.set(suggestions); }, error: () => this.suggestions.set([])}); }, 300); }
  chooseSuggestion(suggestion: AddressSuggestion): void { const control = this.suggestionTarget() === 'listing' ? this.listingForm.controls.address : this.locationForm.controls.address; control.setValue(suggestion.label); this.suggestions.set([]); this.suggestionTarget.set(null); }
  closeSuggestions(): void { setTimeout(() => { this.suggestions.set([]); this.suggestionTarget.set(null); }, 150); }
  updateLocations(event: Event): void { this.selectedLocationIds.set(Array.from((event.target as HTMLSelectElement).selectedOptions).map(option => Number(option.value))); }
  selectFiles(event: Event): void { const files = Array.from((event.target as HTMLInputElement).files ?? []); this.uploadFiles.set(files.slice(0, 10)); }
  pasteImages(event: ClipboardEvent): void {
    const images = Array.from(event.clipboardData?.items ?? []).filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile()).filter((file): file is File => file !== null);
    if (!images.length) return;
    event.preventDefault();
    this.uploadFiles.update(files => [...files, ...images].slice(0, 10));
  }
  saveListing(): void {
    if (this.listingForm.invalid || this.selectedLocationIds().length < 1) { this.listingForm.markAllAsTouched(); this.error.set(this.selectedLocationIds().length < 1 ? this.i18n.t('lodging.selectLocation') : ''); return; }
    const value = this.listingForm.getRawValue(); const existing = this.editing(); const request: LodgingListingRequest = {address: value.address, rentPrice: value.rentPrice!, electricity: this.fee(value.electricityAmount, value.electricityUnit), water: this.fee(value.waterAmount, value.waterUnit), service: this.fee(value.serviceAmount, value.serviceUnit), parking: this.fee(value.parkingAmount, value.parkingUnit), facebookUrl: this.blank(value.facebookUrl), phone: this.blank(value.phone), videoUrl: this.blank(value.videoUrl), note: this.blank(value.note), referenceLocationIds: this.selectedLocationIds(), version: existing?.version ?? null};
    this.saving.set(true); this.error.set(''); const request$ = existing ? this.api.updateLodging(existing.id, request) : this.api.createLodging(request);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({next: listing => { this.uploadSequentially(listing, 0); this.dialog.set(null); this.toast.show(this.i18n.t('lodging.saved'), 'success'); this.load(); }, error: error => this.error.set(error.error?.message ?? this.i18n.t('lodging.saveFailed'))});
  }
  private uploadSequentially(listing: LodgingListing, index: number): void { const files = this.uploadFiles(); if (index >= files.length) return; this.api.uploadLodgingImage(listing.id, files[index]).subscribe({next: () => { this.load(); this.uploadSequentially(listing, index + 1); }, error: () => { this.toast.show(`${files[index].name}: ${this.i18n.t('lodging.uploadFailed')}`, 'error'); this.uploadSequentially(listing, index + 1); }}); }
  deleteListing(listing: LodgingListing): void { if (!listing.canDelete || !confirm(this.i18n.t('lodging.deleteConfirm'))) return; this.api.deleteLodging(listing.id).subscribe({next: () => { this.toast.show(this.i18n.t('lodging.deleted'), 'success'); this.load(); }}); }
  retry(listing: LodgingListing): void { if (!listing.canEdit) return; this.api.recalculateLodging(listing.id).subscribe({next: () => this.load(), error: () => this.toast.show(this.i18n.t('lodging.retryFailed'), 'error')}); }
  deleteImage(listing: LodgingListing, attachmentId: number): void { if (!listing.canEdit) return; this.api.deleteLodgingImage(listing.id, attachmentId).subscribe({next: () => { this.editing.update(current => current?.id === listing.id ? {...current, images: current.images.filter(image => image.attachmentId !== attachmentId)} : current); this.load(); }}); }
  openLocation(): void { this.locationForm.reset({name: '', address: ''}); this.dialog.set('location'); }
  saveLocation(): void { if (this.locationForm.invalid) { this.locationForm.markAllAsTouched(); return; } this.saving.set(true); this.api.createLodgingLocation({...this.locationForm.getRawValue(), version: null}).pipe(finalize(() => this.saving.set(false))).subscribe({next: location => { this.locations.update(values => [...values, location].sort((a, b) => a.name.localeCompare(b.name))); this.selectedLocationIds.update(ids => [...ids, location.id]); this.dialog.set('listing'); }, error: error => this.error.set(error.error?.message ?? this.i18n.t('lodging.saveFailed'))}); }
  openReview(listing: LodgingListing): void { this.reviewing.set(listing); this.reviewStatus.set(listing.reviewSummary.myStatus ?? 'OK'); this.reviewForm.reset({reason: listing.reviewSummary.myReason ?? ''}); this.dialog.set('review'); this.api.lodgingReviews(listing.id).subscribe({next: reviews => this.reviews.set(reviews)}); }
  saveReview(): void { const listing = this.reviewing(); const reason = this.reviewForm.controls.reason.value.trim(); if (!listing || (this.reviewStatus() === 'NOT_OK' && !reason)) { this.error.set(this.i18n.t('lodging.reviewReasonRequired')); return; } this.saving.set(true); this.api.reviewLodging(listing.id, this.reviewStatus(), reason || null).pipe(finalize(() => this.saving.set(false))).subscribe({next: () => { this.dialog.set(null); this.load(); this.toast.show(this.i18n.t('lodging.reviewSaved'), 'success'); }, error: error => this.error.set(error.error?.message ?? this.i18n.t('lodging.saveFailed'))}); }
  fee(amount: number | null, unit: string): LodgingFee | null { return amount === null || amount === undefined ? null : {amount, unit}; }
  blank(value: string): string | null { return value.trim() || null; }
  money(value: number | null): string { return value === null ? '—' : new Intl.NumberFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US', {maximumFractionDigits: 2}).format(value) + ' VND'; }
  feeText(label: string, fee: LodgingFee | null): string { return fee ? `${label}: ${this.money(fee.amount)}/${fee.unit.replaceAll('_', ' ')}` : ''; }
}
