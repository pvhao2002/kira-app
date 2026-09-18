import {API_URL, ApiError, useAuth} from './auth';

export type TravelMember = { id: string; name: string };
export type TravelActivity = { id: string; date: string; time: string; title: string; location: string; notes: string };
export type TravelPacking = { id: string; name: string; category: string; quantity: number; packed: boolean };
export type TravelShoppingItem = { id: string; name: string; category: string; quantity: number; purchased: boolean };
export type TravelPreparationItem = {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  completed: boolean
};
export type TravelChecklistItem = { id: string; title: string; category: string; completed: boolean };
export type TravelPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  notes: string;
  visited: boolean
};
export type TravelExpense = {
  id: string;
  title: string;
  date: string;
  amount: number;
  paidBy: string;
  participants: string[]
};
export type TravelBooking = {
  id: string;
  title: string;
  type: string;
  reference: string;
  date: string;
  notes: string;
  url: string
};
export type TravelData = {
  name: string; destination: string; startDate: string; endDate: string; timezone: string; currency: string;
  budget: number; notes: string; members: TravelMember[]; activities: TravelActivity[]; packing: TravelPacking[];
  shopping: TravelShoppingItem[]; preparations: TravelPreparationItem[]; checklist: TravelChecklistItem[];
  expenses: TravelExpense[]; bookings: TravelBooking[]; places: TravelPlace[];
};
export type TravelBalance = { memberId: string; paid: number; share: number; net: number };
export type TravelTransfer = { from: string; to: string; amount: number };
export type TravelSummary = { total: number; balances: TravelBalance[]; transfers: TravelTransfer[] };
export type TravelTrip = { id: string; data: TravelData; version: number; summary: TravelSummary };
export type TravelFile = { id: string; name: string; contentType: string; size: number };

export const travelErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.';
  if (error.code === 'TRAVEL_NOT_FOUND') return 'Không tìm thấy kế hoạch du lịch.';
  if (error.code === 'TRAVEL_VERSION_CONFLICT') return 'Kế hoạch đã được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.';
  if (error.code === 'TRAVEL_INVALID') return 'Dữ liệu kế hoạch du lịch không hợp lệ.';
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
};

export const emptyTravelData = (): TravelData => ({
  name: '', destination: '', startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), timezone: 'Asia/Ho_Chi_Minh',
  currency: 'VND', budget: 0, notes: '', members: [{id: 'self', name: 'Tôi'}], activities: [], packing: [],
  shopping: [], preparations: [], checklist: [], expenses: [], bookings: [], places: [],
});

export function useTravelApi() {
  const {requestJson} = useAuth();
  return {
    listTrips: () => requestJson<TravelTrip[]>('/api/v1/travel/trips'),
    getTrip: (id: string) => requestJson<TravelTrip>(`/api/v1/travel/trips/${encodeURIComponent(id)}`),
    createTrip: (data: TravelData) => requestJson<TravelTrip>('/api/v1/travel/trips', {
      method: 'POST',
      body: JSON.stringify({data, version: -1})
    }),
    updateTrip: (id: string, data: TravelData, version: number) => requestJson<TravelTrip>(`/api/v1/travel/trips/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({data, version})
    }),
    deleteTrip: (id: string, version: number) => requestJson<void>(`/api/v1/travel/trips/${encodeURIComponent(id)}?version=${version}`, {method: 'DELETE'}),
    listFiles: (id: string) => requestJson<TravelFile[]>(`/api/v1/travel/trips/${encodeURIComponent(id)}/files`),
    uploadFile: (id: string, file: { uri: string; name: string; type: string }) => {
      const form = new FormData();
      form.append('file', {uri: file.uri, name: file.name, type: file.type} as unknown as Blob);
      return requestJson<TravelFile>(`/api/v1/travel/trips/${encodeURIComponent(id)}/files`, {
        method: 'POST',
        body: form
      });
    },
    deleteFile: (id: string, fileId: string) => requestJson<void>(`/api/v1/travel/trips/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}`, {method: 'DELETE'}),
  };
}

export const travelFileUri = (tripId: string, fileId: string) => `${API_URL}/api/v1/travel/trips/${encodeURIComponent(tripId)}/files/${encodeURIComponent(fileId)}`;
