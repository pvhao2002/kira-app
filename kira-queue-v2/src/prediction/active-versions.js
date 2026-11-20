const TTL_MS = 15 * 60 * 1000;

const SQL_ACTIVE_VERSIONS = `
  select prediction_version_id, code
  from prediction_version
  where is_active = 1
  order by sort_order, prediction_version_id
`;

/** Port of ActivePredictionVersionCache: 15 min TTL, an empty result is never cached. */
export function createActiveVersionCache({ db, now = Date.now }) {
  let cached = [];
  let expiresAt = 0;
  let inflight = null;

  const fresh = () => now() < expiresAt && cached.length > 0;

  async function getActiveVersions() {
    if (fresh()) return cached;
    // Concurrent callers share one reload (v1 used a synchronized block).
    // Clear inflight in a .finally() so it always runs after the assignment, even if db.query throws synchronously.
    inflight ??= Promise.resolve()
      .then(() => db.query(SQL_ACTIVE_VERSIONS))
      .then((rows) => {
        cached = rows.map((r) => ({ predictionVersionId: Number(r.prediction_version_id), code: r.code }));
        expiresAt = now() + TTL_MS;
        return cached;
      })
      .finally(() => { inflight = null; });
    return inflight;
  }

  return { getActiveVersions };
}
