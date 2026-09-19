import {ApiError, useAuth} from './auth';
import type {PageResponse} from './investmentApi';

export type FavoriteSong = {
  id: number;
  title: string;
  artist: string | null;
  genre: string | null;
  karaokeCode: string | null;
  tone: string | null;
  link: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type FavoriteSongInput = Omit<FavoriteSong, 'id' | 'createdAt' | 'updatedAt' | 'version'>;

export type JobApplication = {
  id: number;
  companyName: string;
  positionTitle: string;
  location: string | null;
  jobUrl: string | null;
  salary: string | null;
  employmentType: string | null;
  status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  deadline: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type JobApplicationInput = Omit<JobApplication, 'id' | 'createdAt' | 'updatedAt' | 'version'>;

const query = (params: Record<string, string | number | undefined>) => {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') values.append(key, String(value));
  });
  const encoded = values.toString();
  return encoded ? `?${encoded}` : '';
};

const errors: Record<string, string> = {
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
  KARAOKE_SONG_NOT_FOUND: 'Không tìm thấy bài hát yêu thích.',
  KARAOKE_VERSION_CONFLICT: 'Bài hát đã thay đổi ở nơi khác. Vui lòng tải lại.',
  KARAOKE_LINK_INVALID: 'Link bài hát phải bắt đầu bằng http:// hoặc https://.',
  JOB_NOT_FOUND: 'Không tìm thấy job.',
  JOB_VERSION_CONFLICT: 'Job đã thay đổi ở nơi khác. Vui lòng tải lại.',
  JOB_URL_INVALID: 'Link công việc phải bắt đầu bằng http:// hoặc https://.',
  JOB_STATUS_INVALID: 'Trạng thái job không hợp lệ.',
  JOB_PRIORITY_INVALID: 'Độ ưu tiên job không hợp lệ.',
  VALIDATION_ERROR: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.',
  DEFAULT: 'Không thể hoàn tất thao tác. Vui lòng thử lại.'
};

export function personalErrorMessage(error: unknown) {
  const code = error instanceof ApiError ? error.code : 'NETWORK';
  return errors[code] || errors.DEFAULT;
}

export function usePersonalApi() {
  const {requestJson} = useAuth();
  async function listAll<T>(load: (page: number) => Promise<PageResponse<T>>) {
    const rows: T[] = [];
    let page = 0;
    let totalPages = 1;
    do {
      const response = await load(page);
      rows.push(...response.data);
      totalPages = Math.max(response.meta.totalPages, page + 1);
      page += 1;
    } while (page < totalPages);
    return rows;
  }
  return {
    listSongs: (search = '', page = 0, size = 100) => requestJson<PageResponse<FavoriteSong>>(`/api/v1/karaoke/favorite-songs${query({search, page, size})}`),
    listAllSongs: (search = '') => listAll(page => requestJson<PageResponse<FavoriteSong>>(`/api/v1/karaoke/favorite-songs${query({search, page, size: 100})}`)),
    createSong: (body: FavoriteSongInput) => requestJson<FavoriteSong>('/api/v1/karaoke/favorite-songs', {
      method: 'POST', body: JSON.stringify(body)
    }),
    updateSong: (id: number, body: FavoriteSongInput & {version: number}) => requestJson<FavoriteSong>(`/api/v1/karaoke/favorite-songs/${id}`, {
      method: 'PUT', body: JSON.stringify(body)
    }),
    deleteSong: (id: number, version: number) => requestJson<void>(`/api/v1/karaoke/favorite-songs/${id}?version=${version}`, {
      method: 'DELETE'
    }),
    listJobs: (search = '', page = 0, size = 100) => requestJson<PageResponse<JobApplication>>(`/api/v1/jobs${query({search, page, size})}`),
    listAllJobs: (search = '') => listAll(page => requestJson<PageResponse<JobApplication>>(`/api/v1/jobs${query({search, page, size: 100})}`)),
    createJob: (body: JobApplicationInput) => requestJson<JobApplication>('/api/v1/jobs', {
      method: 'POST', body: JSON.stringify(body)
    }),
    updateJob: (id: number, body: JobApplicationInput & {version: number}) => requestJson<JobApplication>(`/api/v1/jobs/${id}`, {
      method: 'PUT', body: JSON.stringify(body)
    }),
    deleteJob: (id: number, version: number) => requestJson<void>(`/api/v1/jobs/${id}?version=${version}`, {
      method: 'DELETE'
    })
  };
}
