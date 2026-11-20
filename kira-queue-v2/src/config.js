// Env -> defaults, identical names/defaults to kira-queue application.yml.
const bool = (v, d) => (v === undefined || v === '' ? d : /^(true|1|yes|on)$/i.test(String(v)));
// Consumer flags mirror @ConditionalOnProperty(havingValue = "true"): only "true" (any case) enables.
const flag = (v, d) => (v === undefined || v === '' ? d : /^true$/i.test(String(v)));
const int = (v, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const str = (v, d) => (v === undefined ? d : v);

export function loadConfig(env = process.env) {
  const all = flag(env.KIRA_QUEUE_CONSUMER_ENABLED, false);
  const port = 2323;
  const instance = str(env.PLAYWRIGHT_INSTANCE_ID, str(env.KIRA_CRAWL_INSTANCE_ID, ''));
  return {
    server: { port, contextPath: '/queue' },
    db: {
      host: str(env.DB_PRIMARY_HOST, 'localhost'),
      port: int(env.DB_PRIMARY_PORT, 3310),
      database: str(env.DB_NAME, 'kira'),
      user: str(env.DB_APP_USER, 'kira_user'),
      password: str(env.DB_APP_PASSWORD, 'kira_password'),
    },
    rabbit: {
      host: str(env.RABBIT_HOST, '127.0.0.1'),
      port: int(env.RABBIT_PORT, 5672),
      username: str(env.RABBIT_USERNAME, 'guest'),
      password: str(env.RABBIT_PASSWORD, 'guest'),
      vhost: str(env.RABBIT_VHOST, '/'),
      connectionTimeoutMs: 60000,
      heartbeat: 30,
    },
    extension: { tokenSha256: str(env.KIRA_EXTENSION_TOKEN_SHA256, '') },
    consumer: {
      dateEnabled: flag(env.KIRA_QUEUE_CONSUMER_DATE_ENABLED, all),
      eventEnabled: flag(env.KIRA_QUEUE_CONSUMER_EVENT_ENABLED, all),
      predictEnabled: flag(env.KIRA_QUEUE_CONSUMER_PREDICT_ENABLED, all),
      settleEnabled: flag(env.KIRA_QUEUE_CONSUMER_SETTLE_ENABLED, all),
      predictConcurrency: int(env.KIRA_QUEUE_PREDICT_CONCURRENCY, 8),
    },
    playwright: {
      headless: bool(env.PLAYWRIGHT_HEADLESS, true),
      channel: str(env.PLAYWRIGHT_CHANNEL, '') || 'chrome',
      browserTimeoutMs: int(env.AISCORE_BROWSER_TIMEOUT_MS, 30000),
      verificationTimeoutMs: int(env.AISCORE_VERIFICATION_TIMEOUT_MS, 120000),
      acceptLanguage: str(env.AISCORE_ACCEPT_LANGUAGE, 'en-US,en;q=0.9'),
      profileBaseDir: str(env.AISCORE_PROFILE_BASE_DIR, '.playwright') || '.playwright',
      profileInstanceId: instance && instance.trim() ? instance : `port${port}`,
    },
  };
}
