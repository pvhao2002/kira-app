import * as ImagePicker from 'expo-image-picker';
import React, {useEffect, useRef, useState} from 'react';
import {Image, Modal, Pressable, ScrollView, View} from 'react-native';
import {useAuth} from './auth';
import {useLanguage, useT} from './i18n';
import {
  AddressSuggestion,
  FeeInput,
  LodgingDistance,
  lodgingErrorMessage,
  LodgingFee,
  lodgingImageUri,
  LodgingListing,
  LodgingReview,
  LodgingReviewStatus,
  ReferenceLocation,
  useLodgingApi
} from './lodgingApi';
import {Badge, Button, Card, Chips, Dialog, Empty, Field, Icon, Info, Row, Screen, Section, T, useNotice} from './ui';
import {useTheme} from './theme';

type PickedImage = { uri: string; name: string; type: string };
type ModalName = 'listing' | 'location' | 'review' | null;
type PendingAction = { title: string; message: string; run: () => void | Promise<void> };
type ListingForm = {
  address: string;
  rentPrice: string;
  electricityAmount: string;
  electricityUnit: string;
  waterAmount: string;
  waterUnit: string;
  serviceAmount: string;
  serviceUnit: string;
  parkingAmount: string;
  parkingUnit: string;
  facebookUrl: string;
  phone: string;
  videoUrl: string;
  note: string;
};

const emptyForm: ListingForm = {
  address: '',
  rentPrice: '',
  electricityAmount: '',
  electricityUnit: 'KWH',
  waterAmount: '',
  waterUnit: 'CUBIC_METER',
  serviceAmount: '',
  serviceUnit: 'MONTH',
  parkingAmount: '',
  parkingUnit: 'VEHICLE_MONTH',
  facebookUrl: '',
  phone: '',
  videoUrl: '',
  note: '',
};

function fee(amount: string, unit: string): FeeInput {
  if (!amount.trim()) return null;
  const value = Number(amount.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? {amount: value, unit} : null;
}

function money(value: number, lang: 'vi' | 'en') {
  return `${new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {maximumFractionDigits: 2}).format(value)} VND`;
}

function dateLabel(value: string, lang: 'vi' | 'en') {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : value;
}

function statusLabel(status: string, t: ReturnType<typeof useT>) {
  return status === 'READY' ? t('Đã sẵn sàng') : status === 'FAILED' ? t('Thất bại') : t('Đang chờ xử lý');
}

function statusTone(status: string): 'primary' | 'success' | 'warning' | 'error' {
  return status === 'READY' ? 'success' : status === 'FAILED' ? 'error' : 'warning';
}

function FeeLine({label, value, lang}: { label: string; value: LodgingFee | null; lang: 'vi' | 'en' }) {
  const {colors: c} = useTheme();
  return value ?
    <T size={11} color={c.muted}>{label}: {money(value.amount, lang)} / {value.unit.replaceAll('_', ' ')}</T> : null;
}

function DistanceLine({distance, t}: { distance: LodgingDistance; t: ReturnType<typeof useT> }) {
  const {colors: c} = useTheme();
  const value = distance.status === 'READY' && distance.distanceMeters != null
    ? `${(distance.distanceMeters / 1000).toFixed(2)} km`
    : distance.status === 'FAILED' ? t('Tính khoảng cách thất bại') : t('Đang tính khoảng cách');
  return <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}><Icon name="location-outline" size={14}
                                                                                  color={distance.status === 'FAILED' ? c.error : c.primary}/><T
    size={11} color={distance.status === 'FAILED' ? c.error : c.muted}>{distance.name}: {value}</T></View>;
}

function ListingCard({listing, authHeader, lang, t, onEdit, onDelete, onReview, onRecalculate}: {
  listing: LodgingListing; authHeader: Record<string, string>; lang: 'vi' | 'en'; t: ReturnType<typeof useT>;
  onEdit: () => void; onDelete: () => void; onReview: () => void; onRecalculate: () => void;
}) {
  const {colors: c} = useTheme();
  const cover = listing.images[0];
  return <Card style={{padding: 0}}>
    {cover ?
      <Image accessibilityLabel={listing.address} source={{uri: lodgingImageUri(cover.contentUrl), headers: authHeader}}
             resizeMode="cover" style={{width: '100%', height: 180}}/> :
      <View style={{height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: c.elevated}}><Icon
        name="home-outline" size={52} color={c.muted}/></View>}
    <View style={{padding: 16, gap: 10}}>
      <Row style={{alignItems: 'flex-start'}}><View style={{flex: 1, gap: 3}}><T size={17}
                                                                                 bold>{listing.formattedAddress || listing.address}</T><T
        size={11} color={c.muted}>{t('Đăng bởi')} {listing.owner.fullName || t('Không xác định')}</T></View><Badge
        tone={statusTone(listing.geocodeStatus)}>{statusLabel(listing.geocodeStatus, t)}</Badge></Row>
      <T size={20} bold color={c.primary}>{money(listing.rentPrice, lang)} <T size={11}
                                                                              color={c.muted}>/ {t('tháng')}</T></T>
      <View style={{gap: 3}}><FeeLine label={t('Điện')} value={listing.electricity} lang={lang}/><FeeLine
        label={t('Nước')} value={listing.water} lang={lang}/><FeeLine label={t('Dịch vụ')} value={listing.service}
                                                                      lang={lang}/><FeeLine label={t('Giữ xe')}
                                                                                            value={listing.parking}
                                                                                            lang={lang}/></View>
      {listing.distances.length ? <View style={{gap: 4, paddingTop: 3}}>{listing.distances.map(distance => <DistanceLine
        key={distance.referenceLocationId} distance={distance} t={t}/>)}</View> : null}
      <Row style={{gap: 8, flexWrap: 'wrap'}}><Badge tone="success">✓ {listing.reviewSummary.okCount} OK</Badge><Badge
        tone="error">× {listing.reviewSummary.notOkCount} {t('Không OK')}</Badge>{listing.images.length ?
        <Badge tone="muted">{listing.images.length} {t('ảnh')}</Badge> : null}</Row>
      {listing.note ? <T size={11} color={c.muted}>{listing.note}</T> : null}
      <Row style={{flexWrap: 'wrap', gap: 8}}><Button label={t('Đánh giá')} kind="secondary" icon="star-outline"
                                                      onPress={onReview}/>{listing.canEdit ? <><Button
        label={t('Tính lại khoảng cách')} kind="secondary" icon="refresh-outline" onPress={onRecalculate}/><Button
        label={t('Sửa')} kind="secondary" icon="create-outline" onPress={onEdit}/></> : null}{listing.canDelete ?
        <Button label={t('Xóa')} kind="danger" icon="trash-outline" onPress={onDelete}/> : null}</Row>
    </View>
  </Card>;
}

export function Lodging() {
  const api = useLodgingApi();
  const {authHeader} = useAuth();
  const {colors: c} = useTheme();
  const t = useT();
  const {lang} = useLanguage();
  const {notify, dialog} = useNotice();
  const [listings, setListings] = useState<LodgingListing[]>([]);
  const [locations, setLocations] = useState<ReferenceLocation[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [editing, setEditing] = useState<LodgingListing | null>(null);
  const [form, setForm] = useState<ListingForm>({...emptyForm});
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);
  const [pickedImages, setPickedImages] = useState<PickedImage[]>([]);
  const [locationEditing, setLocationEditing] = useState<ReferenceLocation | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [returnToListing, setReturnToListing] = useState(false);
  const [suggestionTarget, setSuggestionTarget] = useState<'listing' | 'location' | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [reviewing, setReviewing] = useState<LodgingListing | null>(null);
  const [reviews, setReviews] = useState<LodgingReview[]>([]);
  const [reviewStatus, setReviewStatus] = useState<LodgingReviewStatus>('OK');
  const [reviewReason, setReviewReason] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.list(appliedSearch, page, 20), api.locations()]).then(([result, locationResult]) => {
      if (!active) return;
      setListings(result.data);
      setTotalPages(result.meta.totalPages);
      setLocations(locationResult);
      setError('');
    }).catch(e => {
      if (active) setError(t(lodgingErrorMessage(e)));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [page, appliedSearch]);

  function reload() {
    setPage(current => current);
    api.list(appliedSearch, page, 20).then(result => {
      setListings(result.data);
      setTotalPages(result.meta.totalPages);
    }).catch(e => setError(t(lodgingErrorMessage(e))));
    api.locations().then(setLocations).catch(() => {
    });
  }

  function ask(action: PendingAction) {
    setPending(action);
  }

  function openCreate() {
    setEditing(null);
    setForm({...emptyForm});
    setSelectedLocationIds([]);
    setPickedImages([]);
    setError('');
    setModal('listing');
  }

  function openEdit(listing: LodgingListing) {
    setEditing(listing);
    setForm({
      address: listing.address,
      rentPrice: String(listing.rentPrice),
      electricityAmount: listing.electricity ? String(listing.electricity.amount) : '',
      electricityUnit: listing.electricity?.unit || 'KWH',
      waterAmount: listing.water ? String(listing.water.amount) : '',
      waterUnit: listing.water?.unit || 'CUBIC_METER',
      serviceAmount: listing.service ? String(listing.service.amount) : '',
      serviceUnit: listing.service?.unit || 'MONTH',
      parkingAmount: listing.parking ? String(listing.parking.amount) : '',
      parkingUnit: listing.parking?.unit || 'VEHICLE_MONTH',
      facebookUrl: listing.facebookUrl || '',
      phone: listing.phone || '',
      videoUrl: listing.videoUrl || '',
      note: listing.note || '',
    });
    setSelectedLocationIds(listing.distances.map(value => value.referenceLocationId));
    setPickedImages([]);
    setError('');
    setModal('listing');
  }

  function openLocation(fromListing = false, existing: ReferenceLocation | null = null) {
    setReturnToListing(fromListing);
    setLocationEditing(existing);
    setLocationName(existing?.name || '');
    setLocationAddress(existing?.address || '');
    setSuggestions([]);
    setSuggestionTarget(null);
    setError('');
    setModal('location');
  }

  function closeModal() {
    if (!saving) {
      setModal(null);
      setSuggestions([]);
      setSuggestionTarget(null);
      setError('');
    }
  }

  function currentAddress(target: 'listing' | 'location') {
    return target === 'listing' ? form.address : locationAddress;
  }

  function changeAddress(target: 'listing' | 'location', value: string) {
    if (target === 'listing') setForm(current => ({...current, address: value})); else setLocationAddress(value);
    setSuggestionTarget(target);
    setSuggestions([]);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 3) return;
    timer.current = setTimeout(() => {
      const query = value.trim();
      api.suggestions(query).then(result => {
        if (suggestionTarget === target && currentAddress(target).trim() === query) setSuggestions(result);
      }).catch(() => setSuggestions([]));
    }, 300);
  }

  function chooseSuggestion(suggestion: AddressSuggestion) {
    if (suggestionTarget === 'listing') setForm(current => ({...current, address: suggestion.label}));
    if (suggestionTarget === 'location') setLocationAddress(suggestion.label);
    setSuggestions([]);
    setSuggestionTarget(null);
  }

  async function pickImages() {
    if ((editing?.images.length || 0) + pickedImages.length >= 10) {
      notify(t('Mỗi tin trọ tối đa 10 ảnh.'));
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify(t('Cần cấp quyền thư viện ảnh để chọn ảnh.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 10 - ((editing?.images.length || 0) + pickedImages.length)),
      quality: 0.85
    });
    if (result.canceled) return;
    const files = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `lodging-${Date.now()}-${index}.jpg`,
      type: asset.mimeType || 'image/jpeg'
    }));
    setPickedImages(current => [...current, ...files].slice(0, 10 - (editing?.images.length || 0)));
  }

  async function captureImage() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      notify(t('Cần cấp quyền camera để chụp ảnh.'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({mediaTypes: ['images'], quality: 0.85});
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPickedImages(current => current.length + (editing?.images.length || 0) < 10 ? [...current, {
        uri: asset.uri,
        name: asset.fileName || `lodging-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg'
      }] : current);
    }
  }

  function buildListingInput() {
    const rent = Number(form.rentPrice.replace(',', '.'));
    if (!form.address.trim() || !Number.isFinite(rent) || rent < 0 || selectedLocationIds.length < 1) return null;
    const input = {
      address: form.address.trim(),
      rentPrice: rent,
      electricity: fee(form.electricityAmount, form.electricityUnit),
      water: fee(form.waterAmount, form.waterUnit),
      service: fee(form.serviceAmount, form.serviceUnit),
      parking: fee(form.parkingAmount, form.parkingUnit),
      facebookUrl: form.facebookUrl.trim() || null,
      phone: form.phone.trim() || null,
      videoUrl: form.videoUrl.trim() || null,
      note: form.note.trim() || null,
      referenceLocationIds: selectedLocationIds,
      version: editing ? editing.version : null,
    };
    const amounts = [form.electricityAmount, form.waterAmount, form.serviceAmount, form.parkingAmount];
    if (amounts.some(value => value.trim() && fee(value, 'MONTH') === null)) return null;
    return input;
  }

  async function saveListing() {
    const input = buildListingInput();
    if (!input) {
      setError(t('Vui lòng nhập địa chỉ, giá thuê hợp lệ, chi phí hợp lệ và ít nhất một địa điểm tham chiếu.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = editing ? await api.update(editing.id, input) : await api.create(input);
      let uploadFailed = 0;
      for (const file of pickedImages) {
        try {
          await api.uploadImage(saved.id, file);
        } catch {
          uploadFailed += 1;
        }
      }
      setModal(null);
      reload();
      notify(uploadFailed ? t('Đã lưu tin trọ nhưng có {{n}} ảnh chưa tải lên.', {n: uploadFailed}) : t('Đã lưu tin trọ.'));
    } catch (e) {
      setError(t(lodgingErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function saveLocation() {
    if (!locationName.trim() || !locationAddress.trim()) {
      setError(t('Vui lòng nhập tên và địa chỉ địa điểm.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input = {
        name: locationName.trim(),
        address: locationAddress.trim(),
        version: locationEditing ? locationEditing.version : null
      };
      const saved = locationEditing ? await api.updateLocation(locationEditing.id, input) : await api.createLocation(input);
      setLocations(current => [...current.filter(value => value.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
      if (!locationEditing) setSelectedLocationIds(current => current.includes(saved.id) ? current : [...current, saved.id]);
      setModal(returnToListing ? 'listing' : null);
      setSuggestions([]);
      setSuggestionTarget(null);
      notify(t(locationEditing ? 'Đã cập nhật địa điểm.' : 'Đã thêm địa điểm.'));
    } catch (e) {
      setError(t(lodgingErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function saveReview() {
    if (!reviewing || (reviewStatus === 'NOT_OK' && !reviewReason.trim())) {
      setError(t('Review Không OK cần nhập lý do.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.review(reviewing.id, reviewStatus, reviewReason.trim() || null);
      setModal(null);
      reload();
      notify(t('Đã lưu đánh giá.'));
    } catch (e) {
      setError(t(lodgingErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  function openReview(listing: LodgingListing) {
    setReviewing(listing);
    setReviewStatus(listing.reviewSummary.myStatus || 'OK');
    setReviewReason(listing.reviewSummary.myReason || '');
    setReviews([]);
    setError('');
    setModal('review');
    api.reviews(listing.id).then(setReviews).catch(e => setError(t(lodgingErrorMessage(e))));
  }

  async function recalculate(listing: LodgingListing) {
    setSaving(true);
    setError('');
    try {
      await api.recalculate(listing.id);
      reload();
      notify(t('Đã gửi yêu cầu tính lại khoảng cách.'));
    } catch (e) {
      setError(t(lodgingErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function removeListing(listing: LodgingListing) {
    try {
      await api.remove(listing.id);
      reload();
      notify(t('Đã xóa tin trọ.'));
    } catch (e) {
      setError(t(lodgingErrorMessage(e)));
    }
  }

  async function removeLocation(location: ReferenceLocation) {
    try {
      await api.removeLocation(location.id);
      setLocations(current => current.filter(value => value.id !== location.id));
      notify(t('Đã xóa địa điểm.'));
    } catch (e) {
      setError(t(lodgingErrorMessage(e)));
    }
  }

  async function geocodeLocation(location: ReferenceLocation) {
    try {
      const saved = await api.geocodeLocation(location.id);
      setLocations(current => current.map(value => value.id === saved.id ? saved : value));
      notify(t('Đã gửi yêu cầu định vị địa điểm.'));
    } catch (e) {
      setError(t(lodgingErrorMessage(e)));
    }
  }

  function removeImage(listing: LodgingListing, attachmentId: number) {
    ask({
      title: t('Xóa ảnh?'), message: t('Ảnh này sẽ được gỡ khỏi tin trọ.'), run: async () => {
        try {
          await api.removeImage(listing.id, attachmentId);
          setEditing(current => current?.id === listing.id ? {
            ...current,
            images: current.images.filter(image => image.attachmentId !== attachmentId)
          } : current);
          reload();
        } catch (e) {
          setError(t(lodgingErrorMessage(e)));
        }
      }
    });
  }

  const unitValues = (values: string[]) => values.map(value => ({value, label: value.replaceAll('_', ' ')}));
  const imageCount = (editing?.images.length || 0) + pickedImages.length;
  return <Screen title={t('Chỗ ở')} subtitle={t('Theo dõi tin trọ, chi phí, khoảng cách và đánh giá cộng đồng.')} back>
    {error ? <Info tone="error">{error}</Info> : null}
    <Card tint><Row><View style={{flex: 1}}><T size={12} color={c.primary} bold>{t('QUẢN LÝ CHỖ Ở')}</T><T size={20}
                                                                                                           bold>{t('Danh sách tin trọ')}</T></View><Icon
      name="home-outline" size={30}/></Row><T size={12}
                                              color={c.muted}>{t('Ảnh được lưu riêng tư trên Cloudflare R2; địa chỉ và khoảng cách được cập nhật qua Mapbox khi cấu hình sẵn sàng.')}</T><Field
      label={t('Tìm tin trọ')} value={search} onChangeText={setSearch} onSubmitEditing={() => {
      setPage(0);
      setAppliedSearch(search.trim());
    }} placeholder={t('Địa chỉ hoặc ghi chú')} returnKeyType="search"/><Row><Button label={t('Tìm kiếm')}
                                                                                    icon="search-outline"
                                                                                    onPress={() => {
                                                                                      setPage(0);
                                                                                      setAppliedSearch(search.trim());
                                                                                    }}/><Button
      label={t('Thêm tin trọ')} kind="secondary" icon="add-outline" onPress={openCreate}/></Row></Card>
    {loading ?
      <Card><T color={c.muted}>{t('Đang tải danh sách chỗ ở…')}</T></Card> : listings.length ? listings.map(listing =>
          <ListingCard key={listing.id} listing={listing} authHeader={authHeader()} lang={lang} t={t}
                       onEdit={() => openEdit(listing)} onDelete={() => ask({
            title: t('Xóa tin trọ?'),
            message: t('Tin trọ và liên kết ảnh sẽ được ẩn khỏi danh sách.'),
            run: () => removeListing(listing)
          })} onReview={() => openReview(listing)} onRecalculate={() => void recalculate(listing)}/>) :
        <Empty title={t('Chưa có tin trọ')}
               description={t('Thêm tin trọ đầu tiên để theo dõi giá thuê, tiện ích và khoảng cách.')}
               action={t('Thêm tin trọ')} onPress={openCreate}/>}
    {totalPages > 1 ? <Row style={{justifyContent: 'space-between'}}><Button label={t('Trang trước')} kind="secondary"
                                                                             disabled={page < 1}
                                                                             onPress={() => setPage(value => Math.max(0, value - 1))}/><T
      size={12} color={c.muted}>{page + 1} / {totalPages}</T><Button label={t('Trang sau')} kind="secondary"
                                                                     disabled={page + 1 >= totalPages}
                                                                     onPress={() => setPage(value => value + 1)}/></Row> : null}
    <Section title={t('Địa điểm tham chiếu')} action={t('Thêm')} onPress={() => openLocation()}/>
    {locations.length ? locations.map(location => <Card key={location.id} style={{padding: 13}}><Row><View
        style={{flex: 1, gap: 3}}><T bold>{location.name}</T><T size={11}
                                                                color={c.muted}>{location.formattedAddress || location.address}</T></View><Badge
        tone={statusTone(location.geocodeStatus)}>{statusLabel(location.geocodeStatus, t)}</Badge></Row><Row
        style={{flexWrap: 'wrap', gap: 8}}>{location.canEdit ?
        <Button label={t('Sửa')} kind="secondary" icon="create-outline"
                onPress={() => openLocation(false, location)}/> : null}{location.canEdit && location.geocodeStatus !== 'READY' ?
        <Button label={t('Định vị lại')} kind="secondary" icon="locate-outline"
                onPress={() => void geocodeLocation(location)}/> : null}{location.canDelete ?
        <Button label={t('Xóa')} kind="danger" icon="trash-outline" onPress={() => ask({
          title: t('Xóa địa điểm?'),
          message: t('Chỉ có thể xóa địa điểm chưa được dùng trong tin trọ.'),
          run: () => removeLocation(location)
        })}/> : null}</Row></Card>) :
      <Info>{t('Chưa có địa điểm tham chiếu. Hãy thêm nơi làm việc, trường học hoặc mốc thường đi để tính khoảng cách.')}</Info>}
    <Modal visible={modal === 'listing'} animationType="slide" onRequestClose={closeModal}>
      <View style={{flex: 1, backgroundColor: c.bg}}><ScrollView keyboardShouldPersistTaps="handled"
                                                                 contentContainerStyle={{
                                                                   padding: 18,
                                                                   gap: 15,
                                                                   paddingBottom: 40
                                                                 }}>
        <Row><View style={{flex: 1}}><T size={20} bold>{editing ? t('Sửa tin trọ') : t('Thêm tin trọ')}</T><T size={11}
                                                                                                              color={c.muted}>{t('Lưu địa chỉ, chi phí và tối đa 10 ảnh cho mỗi tin.')}</T></View><Pressable
          accessibilityRole="button" accessibilityLabel={t('Đóng')} onPress={closeModal}><Icon
          name="close-circle-outline" size={28} color={c.muted}/></Pressable></Row>
        {error ? <Info tone="error">{error}</Info> : null}
        <Card><Field label={t('Địa chỉ *')} value={form.address} onChangeText={value => changeAddress('listing', value)}
                     placeholder={t('Nhập địa chỉ chỗ ở')}/><Suggestions target="listing" targetValue={suggestionTarget}
                                                                         values={suggestions}
                                                                         onChoose={chooseSuggestion} t={t}/><Field
          label={t('Giá thuê / tháng *')} value={form.rentPrice}
          onChangeText={value => setForm(current => ({...current, rentPrice: value}))} keyboardType="decimal-pad"
          placeholder="0"/><Field label={t('Số điện thoại')} value={form.phone}
                                  onChangeText={value => setForm(current => ({...current, phone: value}))}
                                  keyboardType="phone-pad"/><Field label="Facebook URL" value={form.facebookUrl}
                                                                   onChangeText={value => setForm(current => ({
                                                                     ...current,
                                                                     facebookUrl: value
                                                                   }))} autoCapitalize="none"/><Field label="Video URL"
                                                                                                      value={form.videoUrl}
                                                                                                      onChangeText={value => setForm(current => ({
                                                                                                        ...current,
                                                                                                        videoUrl: value
                                                                                                      }))}
                                                                                                      autoCapitalize="none"/></Card>
        <Card><Section title={t('Chi phí khác')}/><FeeEditor label={t('Điện')} amount={form.electricityAmount}
                                                             unit={form.electricityUnit}
                                                             units={unitValues(['KWH', 'MONTH'])}
                                                             onAmount={value => setForm(current => ({
                                                               ...current,
                                                               electricityAmount: value
                                                             }))} onUnit={value => setForm(current => ({
          ...current,
          electricityUnit: value
        }))}/><FeeEditor label={t('Nước')} amount={form.waterAmount} unit={form.waterUnit}
                         units={unitValues(['CUBIC_METER', 'PERSON_MONTH', 'MONTH'])}
                         onAmount={value => setForm(current => ({...current, waterAmount: value}))}
                         onUnit={value => setForm(current => ({...current, waterUnit: value}))}/><FeeEditor
          label={t('Dịch vụ')} amount={form.serviceAmount} unit={form.serviceUnit}
          units={unitValues(['PERSON_MONTH', 'MONTH'])}
          onAmount={value => setForm(current => ({...current, serviceAmount: value}))}
          onUnit={value => setForm(current => ({...current, serviceUnit: value}))}/><FeeEditor label={t('Giữ xe')}
                                                                                               amount={form.parkingAmount}
                                                                                               unit={form.parkingUnit}
                                                                                               units={unitValues(['VEHICLE_MONTH', 'MONTH'])}
                                                                                               onAmount={value => setForm(current => ({
                                                                                                 ...current,
                                                                                                 parkingAmount: value
                                                                                               }))}
                                                                                               onUnit={value => setForm(current => ({
                                                                                                 ...current,
                                                                                                 parkingUnit: value
                                                                                               }))}/></Card>
        <Card><Section title={t('Địa điểm để tính khoảng cách')}/><T size={11}
                                                                     color={c.muted}>{t('Chọn ít nhất một địa điểm. Khoảng cách chỉ là thông tin tham khảo.')}</T>{locations.map(location => {
          const selected = selectedLocationIds.includes(location.id);
          return <Pressable key={location.id} accessibilityRole="checkbox" accessibilityState={{checked: selected}}
                            onPress={() => setSelectedLocationIds(current => selected ? current.filter(id => id !== location.id) : [...current, location.id])}
                            style={{flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8}}><Icon
            name={selected ? 'checkbox' : 'square-outline'} color={selected ? c.primary : c.muted} size={23}/><View
            style={{flex: 1}}><T bold>{location.name}</T><T size={11}
                                                            color={c.muted}>{location.address}</T></View></Pressable>;
        })}<Button label={t('Thêm địa điểm mới')} kind="secondary" icon="add-outline"
                   onPress={() => openLocation(true)}/></Card>
        <Card><Section title={t('Ảnh tin trọ')}/><T size={11} color={c.muted}>{imageCount}/10
          · {t('Ảnh sẽ được kiểm tra định dạng và lưu riêng tư trên R2.')}</T><Row><Button label={t('Thư viện ảnh')}
                                                                                           kind="secondary"
                                                                                           icon="images-outline"
                                                                                           onPress={() => void pickImages()}/><Button
          label={t('Chụp ảnh')} kind="secondary" icon="camera-outline"
          onPress={() => void captureImage()}/></Row>{editing?.images.length ?
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap: 8}}>{editing.images.map(image => <View key={image.attachmentId}
                                                                                          style={{
                                                                                            width: 90,
                                                                                            gap: 4
                                                                                          }}><Image
            source={{uri: lodgingImageUri(image.contentUrl), headers: authHeader()}}
            style={{width: 90, height: 70, borderRadius: 10}}/><Pressable accessibilityRole="button"
                                                                          accessibilityLabel={t('Xóa ảnh')}
                                                                          onPress={() => removeImage(editing, image.attachmentId)}><T
            size={10} color={c.error}
            style={{textAlign: 'center'}}>{t('Xóa ảnh')}</T></Pressable></View>)}</ScrollView> : null}{pickedImages.length ?
          <View style={{gap: 3}}>{pickedImages.map(file => <Row key={file.uri}><Icon name="image-outline" size={16}/><T
            size={11} style={{flex: 1}}>{file.name}</T><Pressable accessibilityRole="button"
                                                                  accessibilityLabel={t('Bỏ ảnh')}
                                                                  onPress={() => setPickedImages(current => current.filter(value => value.uri !== file.uri))}><Icon
            name="close-circle-outline" size={18} color={c.error}/></Pressable></Row>)}</View> : null}</Card>
        <Card><Field label={t('Ghi chú')} value={form.note}
                     onChangeText={value => setForm(current => ({...current, note: value}))} multiline maxLength={4000}
                     placeholder={t('Thông tin thêm về tin trọ')}/><Button label={t('Lưu tin trọ')}
                                                                           icon="checkmark-circle-outline"
                                                                           onPress={() => void saveListing()}
                                                                           loading={saving}/></Card>
      </ScrollView></View>
    </Modal>
    <Modal visible={modal === 'location'} animationType="slide" transparent onRequestClose={closeModal}>
      <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end'}}><View
        style={{maxHeight: '88%', backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28}}><ScrollView
        keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 18, gap: 15, paddingBottom: 36}}>
        <Row><View style={{flex: 1}}><T size={20} bold>{locationEditing ? t('Sửa địa điểm') : t('Thêm địa điểm')}</T><T
          size={11} color={c.muted}>{t('Địa điểm dùng để tính khoảng cách tới chỗ ở.')}</T></View><Pressable
          accessibilityRole="button" accessibilityLabel={t('Đóng')} onPress={closeModal}><Icon
          name="close-circle-outline" size={28} color={c.muted}/></Pressable></Row>
        {error ? <Info tone="error">{error}</Info> : null}<Field label={t('Tên địa điểm *')} value={locationName}
                                                                 onChangeText={setLocationName}
                                                                 placeholder={t('Ví dụ: Văn phòng')}/><Field
        label={t('Địa chỉ *')} value={locationAddress} onChangeText={value => changeAddress('location', value)}
        placeholder={t('Nhập địa chỉ địa điểm')}/><Suggestions target="location" targetValue={suggestionTarget}
                                                               values={suggestions} onChoose={chooseSuggestion}
                                                               t={t}/><Row><Button label={t('Hủy bỏ')} kind="secondary"
                                                                                   onPress={closeModal}/><Button
        label={locationEditing ? t('Lưu địa điểm') : t('Thêm địa điểm')} icon="checkmark-circle-outline"
        onPress={() => void saveLocation()} loading={saving}/></Row>
      </ScrollView></View></View>
    </Modal>
    <Modal visible={modal === 'review'} animationType="slide" transparent onRequestClose={closeModal}>
      <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end'}}><View
        style={{maxHeight: '90%', backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28}}><ScrollView
        contentContainerStyle={{padding: 18, gap: 15, paddingBottom: 36}}>
        <Row><View style={{flex: 1}}><T size={20} bold>{t('Đánh giá tin trọ')}</T><T size={11}
                                                                                     color={c.muted}>{reviewing?.formattedAddress || reviewing?.address}</T></View><Pressable
          accessibilityRole="button" accessibilityLabel={t('Đóng')} onPress={closeModal}><Icon
          name="close-circle-outline" size={28} color={c.muted}/></Pressable></Row>
        {error ? <Info tone="error">{error}</Info> : null}<Chips value={reviewStatus}
                                                                 onChange={value => setReviewStatus(value as LodgingReviewStatus)}
                                                                 values={[{value: 'OK', label: 'OK'}, {
                                                                   value: 'NOT_OK',
                                                                   label: t('Không OK')
                                                                 }]}/><Field label={t('Lý do')} value={reviewReason}
                                                                             onChangeText={setReviewReason} multiline
                                                                             maxLength={1000}
                                                                             placeholder={t('Nêu lý do nếu tin trọ không phù hợp')}/><Section
        title={t('Đánh giá gần đây')}/>{reviews.length ? reviews.map(review => <Card
          key={`${review.userId}-${review.updatedAt}`} style={{padding: 12}}><Row><T bold
                                                                                     style={{flex: 1}}>{review.fullName || t('Không xác định')}</T><Badge
          tone={review.status === 'OK' ? 'success' : 'error'}>{review.status}</Badge></Row><T size={11}
                                                                                              color={c.muted}>{review.reason || '—'} · {dateLabel(review.updatedAt, lang)}</T></Card>) :
        <T size={12} color={c.muted}>{t('Chưa có đánh giá nào.')}</T>}<Button label={t('Lưu đánh giá')}
                                                                              icon="checkmark-circle-outline"
                                                                              onPress={() => void saveReview()}
                                                                              loading={saving}/></ScrollView></View></View>
    </Modal>
    <Dialog visible={!!pending} title={pending?.title || ''} message={pending?.message || ''}
            onClose={() => setPending(null)} onConfirm={() => {
      const action = pending?.run;
      setPending(null);
      if (action) void action();
    }}/>
    {dialog}
  </Screen>;
}

function Suggestions({target, targetValue, values, onChoose, t}: {
  target: 'listing' | 'location';
  targetValue: 'listing' | 'location' | null;
  values: AddressSuggestion[];
  onChoose: (value: AddressSuggestion) => void;
  t: ReturnType<typeof useT>
}) {
  const {colors: c} = useTheme();
  if (target !== targetValue || !values.length) return null;
  return <Card style={{padding: 8, gap: 0}}>{values.map(value => <Pressable key={value.mapboxId || value.label}
                                                                            onPress={() => onChoose(value)} style={{
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border
  }}><T size={12}>{value.label}</T></Pressable>)}</Card>;
}

function FeeEditor({label, amount, unit, units, onAmount, onUnit}: {
  label: string;
  amount: string;
  unit: string;
  units: { value: string; label: string }[];
  onAmount: (value: string) => void;
  onUnit: (value: string) => void
}) {
  return <View style={{gap: 8}}><Field label={`${label} · VND`} value={amount} onChangeText={onAmount}
                                       keyboardType="decimal-pad" placeholder="—"/><Chips value={unit} onChange={onUnit}
                                                                                          values={units}/></View>;
}
