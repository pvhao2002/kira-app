import {ApiError, useAuth} from './auth';

export type VaultModule = {
  id: number;
  name: string;
  websiteUrl: string | null;
  description: string | null;
  accountCount: number;
  version: number;
  createdAt: string;
  updatedAt: string
};
export type VaultAccount = {
  id: number;
  moduleId: number;
  displayName: string;
  passwordMasked: string;
  version: number;
  createdAt: string;
  updatedAt: string
};
export type VaultSecret = {
  username: string | null;
  password: string | null;
  loginUrl: string | null;
  note: string | null;
  value: string | null
};
export type VaultUnlock = { unlockToken: string; expiresAt: string };
export type VaultModuleInput = {
  name: string;
  websiteUrl?: string | null;
  description?: string | null;
  version?: number
};
export type VaultAccountInput = {
  displayName: string;
  username?: string | null;
  password: string;
  loginUrl?: string | null;
  note?: string | null;
  version?: number
};

const messages: Record<string, string> = {
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
  VAULT_BAD_CREDENTIALS: 'Mật khẩu đăng nhập hiện tại không đúng.',
  VAULT_LOCKED: 'Password Vault đang khóa hoặc phiên mở khóa đã hết hạn.',
  VAULT_UNLOCK_RATE_LIMITED: 'Bạn đã thử mở khóa quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  VAULT_VERSION_CONFLICT: 'Dữ liệu Password Vault đã thay đổi ở nơi khác. Vui lòng tải lại.',
  VAULT_MODULE_NOT_FOUND: 'Không tìm thấy nhóm Password Vault.',
  VAULT_ACCOUNT_NOT_FOUND: 'Không tìm thấy tài khoản Password Vault.',
  VAULT_VERSION_NOT_ALLOWED: 'Không được gửi version khi tạo dữ liệu mới.',
  VAULT_KEY_UNAVAILABLE: 'Máy chủ chưa cấu hình khóa mã hóa Password Vault.',
  VAULT_DECRYPTION_FAILED: 'Không thể giải mã dữ liệu Password Vault.',
  VAULT_CRYPTO_VERSION_UNSUPPORTED: 'Phiên bản mã hóa Password Vault chưa được hỗ trợ.',
  VAULT_SECRET_FIELD_REQUIRED: 'Cần chọn dữ liệu muốn copy.',
  DEFAULT: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
};

export function vaultErrorMessage(error: unknown) {
  return messages[error instanceof ApiError ? error.code : 'NETWORK'] || messages.DEFAULT;
}

function tokenHeader(token: string) {
  return {'X-Vault-Unlock-Token': token};
}

export function useVaultApi() {
  const {requestJson} = useAuth();
  return {
    listModules: (search = '') => requestJson<VaultModule[]>(`/api/v1/password-vault/modules?search=${encodeURIComponent(search)}`),
    createModule: (input: VaultModuleInput) => requestJson<VaultModule>('/api/v1/password-vault/modules', {
      method: 'POST',
      body: JSON.stringify({...input, version: undefined})
    }),
    updateModule: (id: number, input: VaultModuleInput, version: number) => requestJson<VaultModule>(`/api/v1/password-vault/modules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({...input, version})
    }),
    deleteModule: (id: number, version: number) => requestJson<void>(`/api/v1/password-vault/modules/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({version})
    }),
    listAccounts: (moduleId: number, search = '') => requestJson<VaultAccount[]>(`/api/v1/password-vault/modules/${moduleId}/accounts?search=${encodeURIComponent(search)}`),
    createAccount: (moduleId: number, input: VaultAccountInput) => requestJson<VaultAccount>(`/api/v1/password-vault/modules/${moduleId}/accounts`, {
      method: 'POST',
      body: JSON.stringify({...input, version: undefined})
    }),
    updateAccount: (id: number, input: VaultAccountInput, version: number, token: string) => requestJson<VaultAccount>(`/api/v1/password-vault/accounts/${id}`, {
      method: 'PUT',
      headers: tokenHeader(token),
      body: JSON.stringify({...input, version})
    }),
    deleteAccount: (id: number, version: number) => requestJson<void>(`/api/v1/password-vault/accounts/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({version})
    }),
    unlock: (currentPassword: string) => requestJson<VaultUnlock>('/api/v1/password-vault/unlock', {
      method: 'POST',
      body: JSON.stringify({currentPassword})
    }),
    lock: (token: string) => requestJson<void>('/api/v1/password-vault/unlock', {
      method: 'DELETE',
      headers: tokenHeader(token)
    }),
    reveal: (id: number, token: string) => requestJson<VaultSecret>(`/api/v1/password-vault/accounts/${id}/secret`, {
      method: 'POST',
      headers: tokenHeader(token),
      body: JSON.stringify({action: 'REVEAL'})
    }),
    copy: (id: number, token: string, field: 'USERNAME' | 'PASSWORD' | 'LOGIN_URL' | 'NOTE') => requestJson<VaultSecret>(`/api/v1/password-vault/accounts/${id}/secret`, {
      method: 'POST',
      headers: tokenHeader(token),
      body: JSON.stringify({action: 'COPY', field})
    }),
  };
}
