/**
 * Notification deep links are stored in the mobile slug format ("/statement-import?id=5"). This maps them to web
 * routes; unknown links return null so the "Open" action stays hidden.
 */
export interface NotificationRoute {
  commands: unknown[];
  queryParams?: Record<string, unknown>
}

export function notificationRoute(deepLink: unknown): NotificationRoute | null {
  if (typeof deepLink !== 'string' || !deepLink.startsWith('/')) return null;
  const [path, query = ''] = deepLink.slice(1).split('?');
  const params = new URLSearchParams(query.split('#')[0]);
  const id = Number(params.get('id'));
  const validId = Number.isSafeInteger(id) && id > 0;
  switch (path.split('#')[0]) {
    case 'statement-import':
      return validId ? {commands: ['/app/credit-card/statement-import'], queryParams: {importId: id}} : null;
    case 'billing-cycle':
    case 'statement-pay':
    case 'statements':
    case 'cards':
      return {commands: ['/app/credit-cards']};
    case 'ai-result':
    case 'queue':
      return {commands: ['/app/investment/ai-queue']};
    case 'credit-stats':
      return {commands: ['/app/credit-card/dashboard']};
    default:
      return null;
  }
}
