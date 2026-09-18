import {API_URL, ApiError, useAuth} from './auth';
import {PageResponse} from './investmentApi';

export type LodgingStatus = 'PENDING' | 'READY' | 'FAILED';
export type LodgingReviewStatus = 'OK' | 'NOT_OK';
export type LodgingFee = { amount: number; unit: string };
export type LodgingImage = { attachmentId: number; originalName: string; contentUrl: string; sortOrder: number };
export type LodgingDistance = {
  referenceLocationId: number; name: string; address: string; distanceMeters: number | null;
  status: LodgingStatus; errorCode: string | null; calculatedAt: string | null;
};
export type LodgingReviewSummary = {
  okCount: number;
  notOkCount: number;
  myStatus: LodgingReviewStatus | null;
  myReason: string | null
};
export type LodgingOwner = { userId: number; fullName: string };
export type LodgingListing = {
  id: number; address: string; formattedAddress: string | null; rentPrice: number;
  electricity: LodgingFee | null; water: LodgingFee | null; service: LodgingFee | null; parking: LodgingFee | null;
  facebookUrl: string | null; phone: string | null; videoUrl: string | null; note: string | null;
  geocodeStatus: LodgingStatus; geocodeError: string | null; owner: LodgingOwner;
  canEdit: boolean; canDelete: boolean; version: number; images: LodgingImage[]; distances: LodgingDistance[];
  reviewSummary: LodgingReviewSummary; createdAt: string; updatedAt: string;
};
export type ReferenceLocation = {
  id: number; name: string; address: string; formattedAddress: string | null; geocodeStatus: LodgingStatus;
  geocodeError: string | null; canEdit: boolean; canDelete: boolean; version: number;
};
export type AddressSuggestion = { mapboxId: string; label: string };
export type LodgingReview = {
  userId: number;
  fullName: string;
  status: LodgingReviewStatus;
  reason: string | null;
  updatedAt: string
};
export type FeeInput = { amount: number; unit: string } | null;
export type ListingInput = {
  address: string; rentPrice: number; electricity: FeeInput; water: FeeInput; service: FeeInput; parking: FeeInput;
  facebookUrl: string | null; phone: string | null; videoUrl: string | null; note: string | null;
  referenceLocationIds: number[]; version: number | null;
};
export type LocationInput = { name: string; address: string; version: number | null };

const q = (params: Record<string, string | number | undefined>) => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') usp.append(key, String(value));
  });
  const result = usp.toString();
  return result ? `?${result}` : '';
};

const errorMessages: Record<string, string> = {
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
  LODGING_VERSION_CONFLICT: 'Tin trọ đã được cập nhật ở nơi khác. Vui lòng tải lại và thử lại.',
  LOCATION_VERSION_CONFLICT: 'Địa điểm đã được cập nhật ở nơi khác. Vui lòng tải lại và thử lại.',
  LOCATION_IN_USE: 'Địa điểm đang được sử dụng trong một tin trọ khác.',
  IMAGE_LIMIT_EXCEEDED: 'Mỗi tin trọ tối đa 10 ảnh.',
  INVALID_IMAGE: 'Ảnh phải là JPEG, PNG hoặc WebP, tối đa 10 MB.',
  REVIEW_REASON_REQUIRED: 'Review Không OK cần nhập lý do.',
  INVALID_URL: 'Link phải bắt đầu bằng http:// hoặc https://.',
  FEE_UNIT_WITHOUT_AMOUNT: 'Đơn vị chi phí cần có số tiền.',
  INVALID_FEE_AMOUNT: 'Chi phí không được âm.',
  INVALID_FEE_UNIT: 'Đơn vị chi phí không hợp lệ.',
  DUPLICATE_LOCATION: 'Không được chọn trùng địa điểm.',
  LODGING_NOT_FOUND: 'Không tìm thấy tin trọ.',
  LOCATION_NOT_FOUND: 'Không tìm thấy địa điểm.',
  IMAGE_NOT_FOUND: 'Không tìm thấy ảnh.',
  LODGING_FORBIDDEN: 'Bạn không có quyền sửa tin trọ này.',
  LOCATION_FORBIDDEN: 'Bạn không có quyền sửa địa điểm này.',
  MAPBOX_NOT_CONFIGURED: 'Máy chủ chưa cấu hình Mapbox; vẫn có thể lưu địa chỉ để thử lại sau.',
  MAPBOX_LOCATION_NOT_READY: 'Địa điểm tham chiếu chưa có tọa độ; hãy thử tính lại sau.',
  MAPBOX_GEOCODE_FAILED: 'Không thể định vị địa chỉ lúc này; bạn có thể thử lại sau.',
  MAPBOX_DISTANCE_FAILED: 'Không thể tính khoảng cách lúc này; bạn có thể thử lại sau.',
  DEFAULT: 'Không thể hoàn tất thao tác chỗ ở. Vui lòng thử lại.',
};

export function lodgingErrorMessage(error: unknown) {
  const code = error instanceof ApiError ? error.code : 'NETWORK';
  return errorMessages[code] || errorMessages.DEFAULT;
}

export function lodgingImageUri(contentUrl: string) {
  return contentUrl.startsWith('http://') || contentUrl.startsWith('https://') ? contentUrl : `${API_URL}${contentUrl}`;
}

export function useLodgingApi() {
  const {requestJson} = useAuth();
  return {
    list: (search = '', page = 0, size = 20) => requestJson<PageResponse<LodgingListing>>(`/api/v1/lodgings${q({
      search,
      page,
      size
    })}`),
    detail: (id: number) => requestJson<LodgingListing>(`/api/v1/lodgings/${id}`),
    create: (body: ListingInput) => requestJson<LodgingListing>('/api/v1/lodgings', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    update: (id: number, body: ListingInput) => requestJson<LodgingListing>(`/api/v1/lodgings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
    remove: (id: number) => requestJson<void>(`/api/v1/lodgings/${id}`, {method: 'DELETE'}),
    recalculate: (id: number) => requestJson<LodgingListing>(`/api/v1/lodgings/${id}/distances/recalculate`, {method: 'POST'}),
    uploadImage: (id: number, file: { uri: string; name: string; type: string }) => {
      const form = new FormData();
      form.append('file', {uri: file.uri, name: file.name, type: file.type} as unknown as Blob);
      return requestJson<LodgingImage>(`/api/v1/lodgings/${id}/images`, {method: 'POST', body: form});
    },
    removeImage: (id: number, attachmentId: number) => requestJson<void>(`/api/v1/lodgings/${id}/images/${attachmentId}`, {method: 'DELETE'}),
    review: (id: number, status: LodgingReviewStatus, reason: string | null) => requestJson<LodgingReview>(`/api/v1/lodgings/${id}/reviews/me`, {
      method: 'PUT',
      body: JSON.stringify({status, reason})
    }),
    reviews: (id: number) => requestJson<LodgingReview[]>(`/api/v1/lodgings/${id}/reviews`),
    locations: () => requestJson<ReferenceLocation[]>('/api/v1/lodgings/reference-locations'),
    createLocation: (body: LocationInput) => requestJson<ReferenceLocation>('/api/v1/lodgings/reference-locations', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    updateLocation: (id: number, body: LocationInput) => requestJson<ReferenceLocation>(`/api/v1/lodgings/reference-locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
    removeLocation: (id: number) => requestJson<void>(`/api/v1/lodgings/reference-locations/${id}`, {method: 'DELETE'}),
    geocodeLocation: (id: number) => requestJson<ReferenceLocation>(`/api/v1/lodgings/reference-locations/${id}/geocode`, {method: 'POST'}),
    suggestions: (query: string) => requestJson<AddressSuggestion[]>(`/api/v1/lodgings/address-suggestions?q=${encodeURIComponent(query)}`),
  };
}
