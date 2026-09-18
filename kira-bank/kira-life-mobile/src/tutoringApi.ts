import {ApiError, useAuth} from './auth';

export type TutoringTeachingMode = 'ONLINE' | 'IN_PERSON';
export type TutoringLessonExceptionAction = 'MOVE' | 'CANCEL';
export type TutoringStudent = {
  id: number;
  name: string;
  phone: string | null;
  color: string;
  note: string | null;
  version: number
};
export type TutoringLesson = {
  seriesId: number;
  seriesVersion: number;
  studentId: number;
  studentName: string;
  studentPhone: string | null;
  studentColor: string;
  originalDate: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  teachingMode: TutoringTeachingMode;
  location: string | null;
  fee: number;
  note: string | null;
  exceptionAction: TutoringLessonExceptionAction | null;
  exceptionVersion: number | null;
  cancelled: boolean;
  conflict: boolean;
};
export type TutoringConflict = {
  firstSeriesId: number;
  secondSeriesId: number;
  date: string;
  startTime: string;
  endTime: string;
  description: string
};
export type TutoringWeek = {
  weekStart: string;
  weekEnd: string;
  timeZone: string;
  readOnly: boolean;
  lessonCount: number;
  totalHours: number;
  totalFee: number;
  conflicts: TutoringConflict[];
  lessons: TutoringLesson[]
};
export type TutoringStudentInput = {
  name: string;
  phone?: string | null;
  color: string;
  note?: string | null;
  version?: number | null
};
export type TutoringSeriesInput = {
  studentId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  teachingMode: TutoringTeachingMode;
  location?: string | null;
  fee: number;
  note?: string | null;
  effectiveFrom: string;
  version?: number | null;
  confirmConflict: boolean
};

const messages: Record<string, string> = {
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
  TUTOR_SCHEDULE_CONFLICT: 'Buổi học mới bị trùng lịch.',
  TUTOR_VERSION_CONFLICT: 'Lịch dạy hoặc học viên đã thay đổi ở nơi khác. Vui lòng tải lại.',
  TUTOR_STUDENT_NOT_FOUND: 'Không tìm thấy học viên.',
  TUTOR_SERIES_NOT_FOUND: 'Không tìm thấy lịch học.',
  TUTORING_STUDENT_IN_USE: 'Học viên vẫn còn lịch dạy hiện tại hoặc tương lai.',
  TUTORING_PAST_READ_ONLY: 'Tuần trước chỉ được xem.',
  TUTORING_SERIES_VERSION_CONFLICT: 'Lịch lặp đã thay đổi ở nơi khác. Vui lòng tải lại.',
  TUTORING_STUDENT_VERSION_CONFLICT: 'Học viên đã thay đổi ở nơi khác. Vui lòng tải lại.',
  TUTORING_EXCEPTION_VERSION_CONFLICT: 'Thay đổi riêng của buổi học đã thay đổi ở nơi khác. Vui lòng tải lại.',
  TUTORING_INVALID_TIME: 'Thời gian buổi học không hợp lệ.',
  TUTORING_INVALID_TIME_STEP: 'Thời gian phải theo khoảng 30 phút.',
  TUTORING_MOVE_OUTSIDE_WEEK: 'Buổi học chỉ được đổi trong tuần đang xem.',
  TUTORING_MOVE_REQUIRED: 'Cần nhập ngày và giờ mới khi đổi buổi học.',
  TUTORING_EXCEPTION_NOT_FOUND: 'Không tìm thấy thay đổi riêng của buổi học.',
  TUTORING_OCCURRENCE_NOT_FOUND: 'Không tìm thấy buổi học.',
  TUTORING_SERIES_NOT_ACTIVE: 'Lịch lặp không còn hoạt động.',
  TUTORING_WEEK_START_INVALID: 'Ngày bắt đầu tuần không hợp lệ.',
  DEFAULT: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
};

export function tutoringErrorMessage(error: unknown) {
  return messages[error instanceof ApiError ? error.code : 'NETWORK'] || messages.DEFAULT;
}

export function isTutoringConflict(error: unknown) {
  return error instanceof ApiError && error.code === 'TUTOR_SCHEDULE_CONFLICT';
}

export function useTutoringApi() {
  const {requestJson} = useAuth();
  return {
    getWeek: (weekStart: string) => requestJson<TutoringWeek>(`/api/v1/tutoring/week?weekStart=${encodeURIComponent(weekStart)}`),
    listStudents: () => requestJson<TutoringStudent[]>('/api/v1/tutoring/students'),
    createStudent: (input: TutoringStudentInput) => requestJson<TutoringStudent>('/api/v1/tutoring/students', {
      method: 'POST',
      body: JSON.stringify({...input, version: undefined})
    }),
    updateStudent: (id: number, input: TutoringStudentInput, version: number) => requestJson<TutoringStudent>(`/api/v1/tutoring/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify({...input, version})
    }),
    deleteStudent: (id: number, version: number) => requestJson<void>(`/api/v1/tutoring/students/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({version})
    }),
    createSeries: (input: TutoringSeriesInput) => requestJson<{
      id: number;
      version: number
    }>('/api/v1/tutoring/series', {method: 'POST', body: JSON.stringify({...input, version: undefined})}),
    updateSeries: (id: number, input: TutoringSeriesInput, version: number, confirmConflict: boolean) => requestJson<{
      id: number;
      version: number
    }>(`/api/v1/tutoring/series/${id}`, {method: 'PUT', body: JSON.stringify({...input, version, confirmConflict})}),
    deleteSeries: (id: number, effectiveFrom: string, version: number) => requestJson<void>(`/api/v1/tutoring/series/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({effectiveFrom, version})
    }),
    saveException: (seriesId: number, occurrenceDate: string, action: TutoringLessonExceptionAction, movedDate: string | null, movedStartTime: string | null, movedEndTime: string | null, version: number | null, confirmConflict: boolean) => requestJson<void>(`/api/v1/tutoring/series/${seriesId}/occurrences/${occurrenceDate}`, {
      method: 'PUT',
      body: JSON.stringify({action, movedDate, movedStartTime, movedEndTime, version, confirmConflict})
    }),
    restoreException: (seriesId: number, occurrenceDate: string, version: number, confirmConflict: boolean) => requestJson<void>(`/api/v1/tutoring/series/${seriesId}/occurrences/${occurrenceDate}`, {
      method: 'DELETE',
      body: JSON.stringify({version, confirmConflict})
    }),
  };
}
