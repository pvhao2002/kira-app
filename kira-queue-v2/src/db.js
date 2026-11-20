import mysql from 'mysql2/promise';

const LOCK_CODES = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);
export const isLockError = (e) => !!e && LOCK_CODES.has(e.code);

/**
 * Db facade: query(sql, params) -> rows, update(sql, params) -> affectedRows,
 * batchInsertSafe(sql, rows), withTx(fn(txDb)). Parameterized SQL only; SQL/params are never logged.
 * `exec` is a mysql2 pool or connection; `inTx` marks a transaction.
 */
export function createDb(exec, inTx = false, pool = exec) {
  const db = {
    async query(sql, params = {}) {
      const [rows] = await exec.query(sql, params);
      return rows;
    },
    async update(sql, params = {}) {
      const [res] = await exec.query(sql, params);
      return res.affectedRows ?? 0;
    },
    async batchInsertSafe(sql, rows) {
      await batchInsertSafe(db, sql, rows, inTx);
    },
    async withTx(fn) {
      if (inTx) return fn(db);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const result = await fn(createDb(conn, true, pool));
        await conn.commit();
        return result;
      } catch (e) {
        try {
          await conn.rollback();
        } catch {
          /* connection already lost */
        }
        throw e;
      } finally {
        conn.release();
      }
    },
  };
  return db;
}

/**
 * Port of JdbcBatchUtils.batchInsertSafe: a failed row is retried once, then skipped (params never logged).
 * Inside a transaction a lock failure propagates (a rolled-back tx must not be half re-applied).
 */
export async function batchInsertSafe(db, sql, rows, inTx = false) {
  // ponytail: one statement per row, not JDBC rewriteBatchedStatements; use multi-row VALUES if throughput matters.
  for (const row of rows ?? []) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await db.update(sql, row);
        break;
      } catch (e) {
        if (inTx && isLockError(e)) throw e;
      }
    }
  }
}

export function createPool(cfg) {
  const pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    namedPlaceholders: true,
    charset: 'utf8mb4',
    connectionLimit: 10,
    supportBigNumbers: true,
    bigNumberStrings: false,
  });
  return { pool, db: createDb(pool, false, pool) };
}
