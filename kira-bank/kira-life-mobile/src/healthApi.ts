import {ApiError, useAuth} from './auth';

export type HealthProfile = {
  heightCm: number;
  birthDate: string;
  formulaSex: 'MALE' | 'FEMALE';
  goal: 'LOSE' | 'MAINTAIN' | 'GAIN';
  timezone: string;
  activityFactor: number;
  calorieAdjustment: number;
  foodPreferences: string;
  allergies: string;
  avoidedFoods: string;
  preparationMinutes: number;
  exerciseExperience: string;
  equipment: string;
  availability: string;
  movementRestrictions: string;
};
export type HealthProfileView = { data: HealthProfile; version: number };
export type HealthWeight = { date: string; kg: number };
export type HealthPlanItem = {
  date: string;
  kind: 'MEAL' | 'WORKOUT' | 'REST';
  title: string;
  portion: string;
  calories: number;
  minutes: number;
  notes: string;
  completed: boolean;
};
export type HealthPlanData = { title: string; items: HealthPlanItem[]; warnings: string[] };
export type HealthPlan = {
  id: string;
  weekStart: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  data: HealthPlanData;
  version: number
};
export type HealthJournalData = {
  kind: 'MEAL' | 'WORKOUT';
  title: string;
  calories: number;
  minutes: number;
  notes: string
};
export type HealthJournal = { id: string; date: string; data: HealthJournalData; version: number };
export type HealthWorkout = {
  id: string;
  start: string;
  end: string;
  type: string;
  calories: number | null;
  source: string
};
export type HealthSummary = {
  date: string;
  bmi: number | null;
  restingEstimate: number | null;
  eatenCalories: number;
  targetCalories: number | null;
  activeCalories: number | null;
  restingCalories: number | null;
  totalBurned: number | null;
  netCalories: number | null;
  targetSource: string;
  provisional: boolean;
  steps: number | null;
  workouts: HealthWorkout[];
};
export type HealthDevice =
  { deviceId: string; generation: string; timezone: string; lastRevision: number; lastSyncedAt: string | null }
  | null;
export type HealthAiJob = {
  id: string;
  status: 'RUNNING' | 'READY' | 'FAILED';
  planId: string | null;
  errorCode: string | null
};

const messages: Record<string, string> = {
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
  HEALTH_PROFILE_REQUIRED: 'Hãy hoàn tất hồ sơ sức khỏe trước.',
  HEALTH_PROFILE_CHANGED: 'Hồ sơ sức khỏe đã thay đổi trong lúc tạo kế hoạch. Vui lòng tải lại.',
  HEALTH_VERSION_CONFLICT: 'Dữ liệu sức khỏe đã thay đổi ở nơi khác. Vui lòng tải lại.',
  HEALTH_VALIDATION_FAILED: 'Dữ liệu sức khỏe không hợp lệ.',
  HEALTH_ADULT_PROFILE_REQUIRED: 'Tính năng này chỉ hỗ trợ hồ sơ người trưởng thành từ 20 tuổi.',
  HEALTH_GOAL_ADJUSTMENT_MISMATCH: 'Điều chỉnh năng lượng không khớp với mục tiêu.',
  HEALTH_DISCONNECT_BEFORE_TIMEZONE_CHANGE: 'Hãy ngắt kết nối thiết bị trước khi đổi múi giờ.',
  HEALTH_FUTURE_WEIGHT: 'Không thể ghi cân nặng trong tương lai.',
  HEALTH_WEIGHT_REQUIRED: 'Cần có cân nặng để tính BMI và tạo kế hoạch.',
  HEALTH_PLAN_NOT_FOUND: 'Không tìm thấy kế hoạch sức khỏe.',
  HEALTH_WEEK_MUST_START_MONDAY: 'Tuần kế hoạch phải bắt đầu từ thứ Hai.',
  HEALTH_PLAN_RESTRICTION_CONFLICT: 'Kế hoạch có nội dung xung đột với hạn chế sức khỏe.',
  HEALTH_FUTURE_JOURNAL: 'Không thể ghi nhật ký cho ngày trong tương lai.',
  HEALTH_TIMEZONE_MISMATCH: 'Múi giờ thiết bị phải khớp hồ sơ sức khỏe.',
  HEALTH_DEVICE_ALREADY_CONNECTED: 'Đã có thiết bị khác đang được kết nối.',
  HEALTH_DEVICE_DISCONNECTED: 'Thiết bị đã ngắt kết nối. Hãy kết nối lại.',
  HEALTH_RANGE_MAX_91_DAYS: 'Khoảng thống kê tối đa là 91 ngày.',
  HEALTH_AI_DATE_INVALID: 'Ngày bắt đầu kế hoạch AI không hợp lệ.',
  HEALTH_AI_ALREADY_RUNNING: 'Đang có một kế hoạch AI được tạo.',
  HEALTH_AI_UNAVAILABLE: 'AI sức khỏe hiện không khả dụng.',
  HEALTH_AI_INVALID_RESPONSE: 'AI trả về kế hoạch không hợp lệ.',
  DEFAULT: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
};

export function healthErrorMessage(error: unknown) {
  const code = error instanceof ApiError ? error.code : 'NETWORK';
  return messages[code] || messages.DEFAULT;
}

export function healthErrorMessageForCode(code: string | null | undefined) {
  return messages[code || ''] || messages.DEFAULT;
}

const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

export function useHealthApi() {
  const {requestJson} = useAuth();
  return {
    getProfile: () => requestJson<HealthProfileView | null>('/api/v1/health/profile'),
    saveProfile: (data: HealthProfile, version: number) => requestJson<HealthProfileView>('/api/v1/health/profile', {
      method: 'PUT',
      body: JSON.stringify({data, version})
    }),
    listWeights: () => requestJson<HealthWeight[]>('/api/v1/health/weights'),
    saveWeight: (date: string, kg: number) => requestJson<void>('/api/v1/health/weights', {
      method: 'PUT',
      body: JSON.stringify({date, kg})
    }),
    deleteWeight: (date: string) => requestJson<void>(`/api/v1/health/weights/${encodeURIComponent(date)}`, {method: 'DELETE'}),
    getSummary: (date: string) => requestJson<HealthSummary>(`/api/v1/health/summary?${query({date})}`),
    getStatistics: (from: string, to: string) => requestJson<HealthSummary[]>(`/api/v1/health/statistics?${query({
      from,
      to
    })}`),
    listPlans: (weekStart: string) => requestJson<HealthPlan[]>(`/api/v1/health/plans?${query({weekStart})}`),
    createPlan: (weekStart: string, data: HealthPlanData) => requestJson<HealthPlan>('/api/v1/health/plans', {
      method: 'POST',
      body: JSON.stringify({weekStart, data, version: -1})
    }),
    approvePlan: (id: string, version: number) => requestJson<HealthPlan>(`/api/v1/health/plans/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({version, restrictionsReviewed: true})
    }),
    completePlanItem: (id: string, index: number, version: number, completed: boolean) => requestJson<HealthPlan>(`/api/v1/health/plans/${encodeURIComponent(id)}/items/${index}/completion?${query({
      version: String(version),
      completed: String(completed)
    })}`, {method: 'PUT'}),
    listJournals: (from: string, to: string) => requestJson<HealthJournal[]>(`/api/v1/health/journals?${query({
      from,
      to
    })}`),
    createJournal: (date: string, data: HealthJournalData) => requestJson<HealthJournal>('/api/v1/health/journals', {
      method: 'POST',
      body: JSON.stringify({date, data, version: -1})
    }),
    updateJournal: (id: string, date: string, data: HealthJournalData, version: number) => requestJson<HealthJournal>(`/api/v1/health/journals/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({date, data, version})
    }),
    deleteJournal: (id: string, version: number) => requestJson<void>(`/api/v1/health/journals/${encodeURIComponent(id)}?${query({version: String(version)})}`, {method: 'DELETE'}),
    getConnection: () => requestJson<HealthDevice>('/api/v1/health/connection'),
    disconnect: (deleteData: boolean) => requestJson<void>(`/api/v1/health/connection?${query({deleteData: String(deleteData)})}`, {method: 'DELETE'}),
    generateAiPlan: (weekStart: string, fromDate: string, language: 'vi' | 'en') => requestJson<HealthAiJob>('/api/v1/health/ai-jobs', {
      method: 'POST',
      body: JSON.stringify({weekStart, fromDate, consent: true, language})
    }),
    listAiJobs: () => requestJson<HealthAiJob[]>('/api/v1/health/ai-jobs'),
  };
}
