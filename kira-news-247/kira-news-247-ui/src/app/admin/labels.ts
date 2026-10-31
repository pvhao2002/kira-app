import { ArticleStatus, WorkflowAction } from '../gen/kira/news/v1/news_pb';

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  [ArticleStatus.ARTICLE_STATUS_UNSPECIFIED]: 'Tất cả',
  [ArticleStatus.DRAFT]: 'Nháp',
  [ArticleStatus.IN_REVIEW]: 'Chờ duyệt',
  [ArticleStatus.CHANGES_REQUESTED]: 'Cần sửa',
  [ArticleStatus.PUBLISHED]: 'Đã đăng',
  [ArticleStatus.REJECTED]: 'Từ chối',
  [ArticleStatus.ARCHIVED]: 'Đã gỡ',
};

/** Badge colours by status (also exposed as data-status for automation). */
export const STATUS_CLASS: Record<ArticleStatus, string> = {
  [ArticleStatus.ARTICLE_STATUS_UNSPECIFIED]: 'bg-muted text-foreground',
  [ArticleStatus.DRAFT]: 'bg-muted text-foreground',
  [ArticleStatus.IN_REVIEW]: 'bg-amber-100 text-amber-900',
  [ArticleStatus.CHANGES_REQUESTED]: 'bg-orange-100 text-orange-900',
  [ArticleStatus.PUBLISHED]: 'bg-emerald-100 text-emerald-900',
  [ArticleStatus.REJECTED]: 'bg-red-100 text-red-900',
  [ArticleStatus.ARCHIVED]: 'bg-stone-200 text-stone-800',
};

export const ACTION_LABEL: Record<WorkflowAction, string> = {
  [WorkflowAction.WORKFLOW_ACTION_UNSPECIFIED]: '',
  [WorkflowAction.SUBMIT]: 'Gửi duyệt',
  [WorkflowAction.REQUEST_CHANGES]: 'Yêu cầu sửa',
  [WorkflowAction.PUBLISH]: 'Duyệt & xuất bản',
  [WorkflowAction.REJECT]: 'Từ chối',
  [WorkflowAction.UNPUBLISH]: 'Gỡ bài',
};

/** Stable English ids for data-testid, so an automation agent never depends on Vietnamese copy. */
export const ACTION_ID: Record<WorkflowAction, string> = {
  [WorkflowAction.WORKFLOW_ACTION_UNSPECIFIED]: 'none',
  [WorkflowAction.SUBMIT]: 'submit',
  [WorkflowAction.REQUEST_CHANGES]: 'request-changes',
  [WorkflowAction.PUBLISH]: 'publish',
  [WorkflowAction.REJECT]: 'reject',
  [WorkflowAction.UNPUBLISH]: 'unpublish',
};

export const ADMIN_STATUS_TABS: readonly ArticleStatus[] = [
  ArticleStatus.IN_REVIEW,
  ArticleStatus.CHANGES_REQUESTED,
  ArticleStatus.DRAFT,
  ArticleStatus.PUBLISHED,
  ArticleStatus.REJECTED,
  ArticleStatus.ARCHIVED,
  ArticleStatus.ARTICLE_STATUS_UNSPECIFIED,
];
