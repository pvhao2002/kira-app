export const fileStorageEnglish = {
  'fileStorage.title': 'File storage', 'fileStorage.eyebrow': 'HUGGING FACE · R2',
  'fileStorage.description': 'Upload files to your preferred provider and track usage against each free plan.',
  'fileStorage.refresh': 'Refresh', 'fileStorage.usageTitle': 'Storage usage', 'fileStorage.loading': 'Loading…',
  'fileStorage.loadFailed': 'Unable to load storage data. Please retry.',
  'fileStorage.used': 'Used', 'fileStorage.freeLimit': 'Free plan', 'fileStorage.exceeded': 'Over free plan',
  'fileStorage.withinFree': 'Within free plan', 'fileStorage.notConfigured': 'Not configured',
  'fileStorage.usageUnavailable': 'Usage unavailable', 'fileStorage.uploadTitle': 'Upload file',
  'fileStorage.preferred': 'Preferred provider', 'fileStorage.fallbackHint': 'If the preferred provider fails or is not configured, the file goes to the other one.',
  'fileStorage.file': 'File', 'fileStorage.maxSize': 'Max 10 MB.', 'fileStorage.upload': 'Upload', 'fileStorage.uploading': 'Uploading…',
  'fileStorage.uploaded': 'Uploaded to {provider}.', 'fileStorage.uploadedFallback': 'Preferred provider unavailable, uploaded to {provider}.',
  'fileStorage.uploadFailed': 'Upload failed.', 'fileStorage.tooLarge': 'File must be at most 10 MB.',
  'fileStorage.filesTitle': 'Uploaded files', 'fileStorage.empty': 'No files uploaded yet.',
  'fileStorage.name': 'Name', 'fileStorage.provider': 'Provider', 'fileStorage.size': 'Size', 'fileStorage.uploadedAt': 'Uploaded',
  'fileStorage.download': 'Download', 'fileStorage.downloadFailed': 'Unable to download file.',
  'fileStorage.previous': 'Previous', 'fileStorage.next': 'Next',
  'fileStorage.delete': 'Delete', 'fileStorage.deleteConfirm': 'Delete "{name}"? The file is removed from the provider and cannot be restored.',
  'fileStorage.deleted': 'File deleted.', 'fileStorage.deleteFailed': 'Unable to delete file.'
} as const;

export const fileStorageVietnamese: Record<keyof typeof fileStorageEnglish, string> = {
  'fileStorage.title': 'Lưu trữ file', 'fileStorage.eyebrow': 'HUGGING FACE · R2',
  'fileStorage.description': 'Upload file lên provider ưu tiên và theo dõi dung lượng so với free plan của từng provider.',
  'fileStorage.refresh': 'Làm mới', 'fileStorage.usageTitle': 'Dung lượng đã dùng', 'fileStorage.loading': 'Đang tải…',
  'fileStorage.loadFailed': 'Không tải được dữ liệu lưu trữ. Vui lòng thử lại.',
  'fileStorage.used': 'Đã dùng', 'fileStorage.freeLimit': 'Free plan', 'fileStorage.exceeded': 'Vượt free plan',
  'fileStorage.withinFree': 'Trong free plan', 'fileStorage.notConfigured': 'Chưa cấu hình',
  'fileStorage.usageUnavailable': 'Không đo được dung lượng', 'fileStorage.uploadTitle': 'Upload file',
  'fileStorage.preferred': 'Provider ưu tiên', 'fileStorage.fallbackHint': 'Nếu provider ưu tiên lỗi hoặc chưa cấu hình, file sẽ được lưu sang provider còn lại.',
  'fileStorage.file': 'File', 'fileStorage.maxSize': 'Tối đa 10 MB.', 'fileStorage.upload': 'Upload', 'fileStorage.uploading': 'Đang upload…',
  'fileStorage.uploaded': 'Đã upload lên {provider}.', 'fileStorage.uploadedFallback': 'Provider ưu tiên không khả dụng, đã upload lên {provider}.',
  'fileStorage.uploadFailed': 'Upload thất bại.', 'fileStorage.tooLarge': 'File tối đa 10 MB.',
  'fileStorage.filesTitle': 'File đã upload', 'fileStorage.empty': 'Chưa có file nào.',
  'fileStorage.name': 'Tên', 'fileStorage.provider': 'Provider', 'fileStorage.size': 'Dung lượng', 'fileStorage.uploadedAt': 'Ngày upload',
  'fileStorage.download': 'Tải về', 'fileStorage.downloadFailed': 'Không tải được file.',
  'fileStorage.previous': 'Trước', 'fileStorage.next': 'Sau',
  'fileStorage.delete': 'Xóa', 'fileStorage.deleteConfirm': 'Xóa "{name}"? File sẽ bị xóa khỏi provider và không thể khôi phục.',
  'fileStorage.deleted': 'Đã xóa file.', 'fileStorage.deleteFailed': 'Không xóa được file.'
};
