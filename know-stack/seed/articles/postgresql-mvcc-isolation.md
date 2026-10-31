---
title: PostgreSQL MVCC & Isolation Levels Under High Write Contention
summary: Tuple headers (xmin, xmax, t_ctid), phantom read prevention, vacuum freeze wraparound risks, and lock conflicts.
category: databases-and-caching
difficulty: mid
tags: PostgreSQL, Concurrency, Databases
views: 62900
daysAgo: 14
---
## 01 Every row is a version

PostgreSQL never updates a row in place. An `UPDATE` writes a new tuple version and marks the old one dead. Each tuple header stores:

- `xmin`: the transaction that inserted it
- `xmax`: the transaction that deleted or replaced it
- `t_ctid`: a pointer to the newer version

A snapshot decides visibility: a tuple is visible if `xmin` committed before the snapshot and `xmax` did not.

## 02 Isolation levels in practice

| Level | Dirty read | Non-repeatable | Phantom | Serialization anomaly |
|---|---|---|---|---|
| Read Committed | no | possible | possible | possible |
| Repeatable Read | no | no | no (in PG) | possible |
| Serializable (SSI) | no | no | no | no |

```sql
begin isolation level serializable;
select sum(balance) from accounts where owner_id = 7;
update accounts set balance = balance - 100 where id = 42;
commit; -- may fail with 40001: retry the whole transaction
```

> [!TIP]
> Under `SERIALIZABLE`, treat SQLSTATE `40001` as a normal outcome and retry the transaction from the start.

## 03 Vacuum and wraparound

Transaction IDs are 32-bit. `VACUUM FREEZE` marks old tuples as frozen so their `xmin` no longer matters. If autovacuum falls behind, PostgreSQL stops accepting writes to prevent wraparound.

> [!CAUTION]
> Long-running transactions hold back the xmin horizon, so vacuum cannot remove dead tuples. Watch `pg_stat_activity` for old `xact_start`.

## Interview Q&A

**Q: Why can't readers block writers in PG?** Readers see an older version; writers create a new one.

**Q: What causes table bloat?** Dead tuples that vacuum cannot reclaim yet, often due to long transactions.

**Q: When pick Serializable over Repeatable Read?** When correctness depends on reads of rows you don't write (write skew).
