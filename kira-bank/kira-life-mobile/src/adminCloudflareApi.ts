import {ApiError, useAuth} from './auth';

export type CloudflareProviderStatus = 'PENDING_TEST' | 'VERIFIED' | 'COOLDOWN' | 'BLOCKED';
export type AiCapabilityResponse = {
  tokenConfigured: boolean;
  model: string;
  priority: number;
  enabled: boolean;
  status: CloudflareProviderStatus;
  cooldownUntil: string | null;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
};
export type R2CapabilityResponse = {
  accessKeyConfigured: boolean;
  secretKeyConfigured: boolean;
  maskedBucketName: string | null;
  maskedPublicUrl: string | null;
  primary: boolean;
  status: CloudflareProviderStatus;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  attachmentCount: number;
};
export type CloudflareAccountResponse = {
  id: number; displayName: string; maskedAccountId: string; ai: AiCapabilityResponse; r2: R2CapabilityResponse;
  legacyAttachmentCount: number; version: number;
};
export type CloudflareAccountWrite = {
  displayName: string; accountId?: string; apiToken?: string; aiModel?: string; priority: number;
  r2AccessKeyId?: string; r2SecretAccessKey?: string; r2BucketName?: string; r2PublicUrl?: string;
};

const errorMessages: Record<string, string> = {
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Tài khoản hiện tại không có quyền Admin.',
  CLOUDFLARE_ACCOUNT_NOT_FOUND: 'Không tìm thấy Cloudflare account.',
  CLOUDFLARE_ACCOUNT_ID_EXISTS: 'Cloudflare Account ID đã tồn tại.',
  CLOUDFLARE_ACCOUNT_VERSION_CONFLICT: 'Cloudflare account đã được cập nhật, vui lòng tải lại.',
  CLOUDFLARE_ACCOUNT_IN_USE: 'Không thể thay đổi hoặc xóa account đang chứa file R2.',
  R2_BUCKET_IN_USE: 'Không thể đổi bucket đang chứa file.',
  AI_ACCOUNT_TEST_FAILED: 'Không thể xác minh Workers AI credential hoặc model.',
  R2_ACCOUNT_TEST_FAILED: 'Không thể upload, đọc và xóa object kiểm tra trên R2.',
  AI_ACCOUNT_NOT_VERIFIED: 'Cần Test AI thành công trước khi kích hoạt.',
  R2_ACCOUNT_NOT_VERIFIED: 'Cần Test R2 thành công trước khi chọn primary hoặc gán file cũ.',
  AI_TOKEN_REQUIRED: 'Chưa có AI API token.',
  R2_ACCESS_KEY_REQUIRED: 'Chưa có R2 access key.',
  R2_SECRET_KEY_REQUIRED: 'Chưa có R2 secret key.',
  R2_BUCKET_REQUIRED: 'Chưa có tên R2 bucket.',
  CLOUDFLARE_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED: 'Máy chủ chưa cấu hình khóa mã hóa Cloudflare credential.',
  DEFAULT: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
};

export function cloudflareErrorMessage(error: unknown) {
  return error instanceof ApiError ? errorMessages[error.code] || errorMessages.DEFAULT : errorMessages.NETWORK;
}

const query = (version: number) => JSON.stringify({version});

export function useAdminCloudflareApi() {
  const {requestJson} = useAuth();
  return {
    list: () => requestJson<CloudflareAccountResponse[]>('/api/v1/admin/cloudflare-accounts'),
    create: (body: CloudflareAccountWrite) => requestJson<CloudflareAccountResponse>('/api/v1/admin/cloudflare-accounts', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    update: (id: number, body: CloudflareAccountWrite & {
      version: number
    }) => requestJson<CloudflareAccountResponse>(`/api/v1/admin/cloudflare-accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
    remove: (id: number, version: number) => requestJson<void>(`/api/v1/admin/cloudflare-accounts/${id}`, {
      method: 'DELETE',
      body: query(version)
    }),
    testAi: (id: number, body: {
      version: number;
      apiToken?: string;
      model?: string
    }) => requestJson<CloudflareAccountResponse>(`/api/v1/admin/cloudflare-accounts/${id}/ai/test`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    enableAi: (id: number, version: number) => requestJson<CloudflareAccountResponse>(`/api/v1/admin/cloudflare-accounts/${id}/ai/enable`, {
      method: 'POST',
      body: query(version)
    }),
    disableAi: (id: number, version: number) => requestJson<CloudflareAccountResponse>(`/api/v1/admin/cloudflare-accounts/${id}/ai/disable`, {
      method: 'POST',
      body: query(version)
    }),
    testR2: (id: number, body: {
      version: number;
      accessKeyId?: string;
      secretAccessKey?: string;
      bucketName?: string;
      publicUrl?: string
    }) => requestJson<CloudflareAccountResponse>(`/api/v1/admin/cloudflare-accounts/${id}/r2/test`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    makeR2Primary: (id: number, version: number) => requestJson<CloudflareAccountResponse>(`/api/v1/admin/cloudflare-accounts/${id}/r2/make-primary`, {
      method: 'POST',
      body: query(version)
    }),
    stopR2Uploads: (id: number, version: number) => requestJson<CloudflareAccountResponse>(`/api/v1/admin/cloudflare-accounts/${id}/r2/stop-uploads`, {
      method: 'POST',
      body: query(version)
    }),
    adoptLegacy: (id: number, version: number) => requestJson<CloudflareAccountResponse>(`/api/v1/admin/cloudflare-accounts/${id}/r2/adopt-legacy-attachments`, {
      method: 'POST',
      body: query(version)
    }),
  };
}
