INSERT OR IGNORE INTO categories (slug, name, icon, sort) VALUES ('core-cs-and-systems', 'Core CS & Systems', 'terminal', 1);
INSERT OR IGNORE INTO categories (slug, name, icon, sort) VALUES ('java-and-spring-boot', 'Java & Spring Boot', 'code', 2);
INSERT OR IGNORE INTO categories (slug, name, icon, sort) VALUES ('databases-and-caching', 'Databases & Caching', 'database', 3);
INSERT OR IGNORE INTO categories (slug, name, icon, sort) VALUES ('cloud-and-devops', 'Cloud & DevOps', 'cloud', 4);
INSERT OR IGNORE INTO categories (slug, name, icon, sort) VALUES ('microservices-architecture', 'Microservices Architecture', 'hub', 5);
INSERT OR IGNORE INTO categories (slug, name, icon, sort) VALUES ('system-design', 'System Design', 'account_tree', 6);
INSERT OR IGNORE INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES ('g1-vs-zgc-garbage-collection', 'Garbage Collection Under Load: G1 vs Generational ZGC', 'Region-based evacuation, concurrent relocation with load barriers, and choosing a collector by latency budget.', '## 01 G1 in one paragraph

G1 splits the heap into equal regions and collects the ones with the most garbage first. Young collections are stop-the-world evacuations; old regions are reclaimed by mixed collections after a concurrent marking cycle. `-XX:MaxGCPauseMillis` (default 200 ms) is a goal, not a guarantee.

## 02 ZGC: pauses that don''t grow with the heap

ZGC marks and relocates objects concurrently. Load barriers fix up references when the application reads them, so pauses stay under a millisecond whether the heap is 1 GB or 1 TB. JDK 21 adds generational ZGC (`-XX:+ZGenerational`, default in JDK 23).

```bash
java -XX:+UseZGC -XX:+ZGenerational -Xmx16g -Xlog:gc*:file=gc.log -jar app.jar
```

> [!TIP]
> Size the heap for ZGC with headroom: it needs free memory to relocate into while the app keeps allocating. Allocation stalls show up as `Allocation Stall` in the GC log.

## 03 Picking a collector

| Need | Pick |
|---|---|
| Throughput, batch jobs | Parallel GC |
| Balanced default | G1 |
| p99.9 latency, large heaps | Generational ZGC |

## Interview Q&A

**Q: Why do ZGC pauses not scale with heap size?** Only root scanning happens in pauses; marking and relocation are concurrent.

**Q: What does a load barrier cost?** A small check on every reference load, a few percent of throughput.

**Q: What is an evacuation failure in G1?** No free regions to copy survivors into, triggering an expensive full GC.', 'core-cs-and-systems', 'senior', '["Garbage Collection","JVM Internals"]', 2, 'published', 'human', 28700, 1791214931, 1791214931, 1791214931);
INSERT OR IGNORE INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES ('idempotent-apis-redis-redlock', 'Designing Idempotent APIs with Distributed Locks & Redis Redlock', 'Clock drift vulnerabilities, Kleppmann''s critique, fencing tokens with monotonic sequence IDs, and Stripe-style idempotency keys.', '## 01 The problem: retries create duplicates

Clients retry on timeouts, load balancers retry on resets, and queues redeliver. Any non-idempotent `POST /payments` will eventually charge someone twice.

## 02 Idempotency keys

The client sends an `Idempotency-Key` header. The server stores the key with the request hash and the final response; a repeat returns the stored response.

```sql
create table idempotency_keys (
  key text primary key,
  request_hash text not null,
  response jsonb,
  locked_at timestamptz
);
```

> [!NOTE]
> Insert the key **inside the same transaction** as the side effect. If they commit separately you are back to the dual-write problem.

## 03 Why Redlock is not enough

Redlock acquires a lock on a majority of Redis nodes with a TTL. Martin Kleppmann showed that a GC pause or clock jump can let the TTL expire while the holder still believes it owns the lock, so two clients write at once.

```mermaid
sequenceDiagram
  participant A as Client A
  participant R as Redis
  participant S as Storage
  A->>R: acquire lock (token 33)
  Note over A: GC pause, lease expires
  participant B as Client B
  B->>R: acquire lock (token 34)
  B->>S: write (token 34)
  A->>S: write (token 33) rejected
```

## 04 Fencing tokens

Every lock grant carries a monotonically increasing token. The storage layer rejects writes whose token is lower than the last one it accepted. That makes correctness independent of timing.

> [!ANTIPATTERN]
> Using a distributed lock as the only guard for money movement. Locks are an efficiency tool; the database constraint is the correctness tool.

## Interview Q&A

**Q: Where do you store idempotency keys?** In the same database as the side effect, with a unique constraint.

**Q: How long do you keep them?** At least as long as the longest client retry window, commonly 24 hours.

**Q: What if two requests with the same key arrive at once?** The unique insert lets one proceed; the other waits or gets `409 Conflict`.', 'system-design', 'senior', '["Redis","Concurrency","API Design"]', 2, 'published', 'human', 84210, 1792683731, 1792683731, 1792683731);
INSERT OR IGNORE INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES ('java-21-virtual-threads-loom', 'Deep Dive into Java 21 Virtual Threads & Loom Concurrency', 'Carrier thread scheduling, continuations in HotSpot, stack segment resizing, and how pinning occurs under synchronized blocks.', '## 01 Why platform threads stop scaling

Before JDK 21 and Project Loom (JEP 444), every `java.lang.Thread` mapped 1:1 to an OS kernel thread. Each one reserves roughly **1 MB** of stack and costs a kernel context switch to schedule. Somewhere around a few thousand concurrent blocking requests, the machine runs out of memory or spends its time switching instead of working.

> [!TIP]
> Virtual threads do **not** make CPU-bound work faster. They maximize **I/O-bound throughput**. For heavy computation, keep platform workers and `ForkJoinPool.commonPool()`.

## 02 The M:N scheduler

A virtual thread is a continuation scheduled onto a small pool of *carrier* threads (a `ForkJoinPool` sized to the CPU count). When it blocks on I/O, the JDK unmounts it: its stack frames are copied to the heap and the carrier picks up another virtual thread.

```mermaid
graph LR
  R1[Request 1] --> V1[Virtual thread]
  R2[Request 2] --> V2[Virtual thread]
  R3[Request N] --> V3[Virtual thread]
  V1 --> C[Carrier pool = CPU cores]
  V2 --> C
  V3 --> C
  C --> OS[OS threads]
```

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 50_000).forEach(i -> executor.submit(() -> {
        Thread.sleep(Duration.ofMillis(100)); // unmounts, carrier is freed
        return i;
    }));
} // close() waits for all tasks
```

## 03 Pinning: when unmounting fails

A virtual thread is **pinned** to its carrier when it blocks inside a `synchronized` block (fixed in JDK 24 by JEP 491) or during a native/JNI call. A pinned thread holds the carrier for the whole blocking call, so a handful of pinned threads can starve the pool.

> [!CAUTION]
> Diagnose pinning with `-Djdk.tracePinnedThreads=full` on JDK 21–23, or the `jdk.VirtualThreadPinned` JFR event.

> [!ANTIPATTERN]
> Pooling virtual threads. They are cheap to create; a pool only adds a bottleneck. Limit concurrency with a `Semaphore` instead.

## Interview Q&A

**Q: Why can a JNI call pin a virtual thread?** The native frame lives on the carrier''s OS stack, which the JVM cannot copy to the heap, so it cannot unmount.

**Q: Should you replace a `ThreadLocal` cache?** Yes, with care: a million virtual threads means a million copies. Prefer scoped values (JEP 446) or explicit caches.

**Q: What limits throughput once threads are cheap?** The downstream: connection pools, rate limits and database capacity. Bound them explicitly.', 'java-and-spring-boot', 'staff', '["Concurrency","Java 21","JVM Internals"]', 2, 'published', 'ai', 128420, 1793202131, 1793202131, 1793202131);
INSERT OR IGNORE INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES ('kafka-exactly-once-semantics', 'Kafka Exactly-Once Semantics (EOS): Producer Idempotence to Transactions', 'How idempotent producers, transactional writes and read_committed consumers combine into exactly-once processing.', '## 01 Three delivery guarantees

At-most-once loses messages, at-least-once duplicates them, and exactly-once makes the *effect* happen once. Kafka EOS covers read-process-write loops that stay inside Kafka.

## 02 Idempotent producer

With `enable.idempotence=true` (default since 3.0), each producer gets an ID and every batch a sequence number per partition. The broker drops duplicates from retries.

## 03 Transactions

```java
producer.initTransactions();
producer.beginTransaction();
producer.send(new ProducerRecord<>("payments-out", key, value));
producer.sendOffsetsToTransaction(offsets, consumer.groupMetadata());
producer.commitTransaction();
```

Output records and consumed offsets commit atomically. Consumers with `isolation.level=read_committed` never see aborted records.

> [!CAUTION]
> EOS ends at Kafka''s boundary. Writing to a database or calling an HTTP API inside the loop needs its own idempotency (keys or upserts).

## Interview Q&A

**Q: What does `transactional.id` protect against?** Zombie producers: a restarted instance fences the old one by epoch.

**Q: Cost of EOS?** Extra round trips for commit markers; latency rises with smaller transactions.

**Q: Is the consumer side exactly-once by default?** No, it needs `read_committed` and offsets committed in the transaction.', 'microservices-architecture', 'senior', '["Kafka","Distributed Systems"]', 1, 'published', 'human', 73500, 1792510931, 1792510931, 1792510931);
INSERT OR IGNORE INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES ('postgresql-mvcc-isolation', 'PostgreSQL MVCC & Isolation Levels Under High Write Contention', 'Tuple headers (xmin, xmax, t_ctid), phantom read prevention, vacuum freeze wraparound risks, and lock conflicts.', '## 01 Every row is a version

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

**Q: Why can''t readers block writers in PG?** Readers see an older version; writers create a new one.

**Q: What causes table bloat?** Dead tuples that vacuum cannot reclaim yet, often due to long transactions.

**Q: When pick Serializable over Repeatable Read?** When correctness depends on reads of rows you don''t write (write skew).', 'databases-and-caching', 'mid', '["PostgreSQL","Concurrency","Databases"]', 2, 'published', 'human', 62900, 1792251731, 1792251731, 1792251731);
INSERT OR IGNORE INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES ('saga-pattern-distributed-transactions', 'Deep Dive: Distributed Transaction Management with Saga Pattern & Eventual Consistency', 'Choreographing vs orchestrating microservice transactions, compensation mechanics, and zero-data-loss strategies.', '## Architectural executive summary

Two-Phase Commit guarantees ACID across stores at the cost of synchronous locking, cascading latency and a single coordinator. **Sagas replace one atomic transaction with a sequence of local transactions**, each with a compensating action, and accept eventual consistency to stay available.

## 01 The dual-write problem and the death of 2PC

Updating Postgres and publishing to Kafka "together" is not atomic. If the commit succeeds and the publish fails, downstream services never hear about it; publish first and a crash leaves an event for state that never existed.

> [!ANTIPATTERN]
> XA / 2PC across cloud microservices. Every participant holds row locks through the prepare phase; one slow node starves connection pools across the fleet.

The fix is the **transactional outbox**: write the event to an `outbox` table in the same local transaction, and let a relay (polling or CDC like Debezium) publish it.

## 02 Forward path vs compensation path

```mermaid
graph LR
  O[Order: PENDING] --> P[Payment: charge]
  P --> I[Inventory: reserve]
  I --> S[Shipping: schedule]
  S --> D[Order: CONFIRMED]
  I -. fails .-> CP[Payment: refund]
  CP --> CO[Order: CANCELLED]
```

- **Orchestration**: a coordinator (Temporal, Conductor, or a state machine) calls each step and, on failure, runs compensations in reverse order. Easy to reason about and observe.
- **Choreography**: each service reacts to events and emits the next. No central brain, but the flow is spread across services.

## 03 Compensations must be idempotent

Messages are delivered at least once, so every step and compensation must tolerate repeats.

```java
@Transactional
public void refund(UUID paymentId, UUID sagaId) {
    if (refunds.existsBySagaId(sagaId)) return; // already compensated
    refunds.save(new Refund(paymentId, sagaId));
    outbox.save(new PaymentRefunded(paymentId, sagaId));
}
```

> [!NOTE]
> Sagas give up isolation: other transactions can see intermediate states. Use semantic locks (a `PENDING` status) and design reads to tolerate them.

## Interview Q&A

**Q: Orchestration or choreography for 6+ steps?** Orchestration: the flow stays in one place and timeouts are explicit.

**Q: What if a compensation fails?** Retry with backoff; it must be idempotent. After a limit, park it for manual repair.

**Q: How do you avoid lost events?** Transactional outbox plus at-least-once relay and idempotent consumers.', 'microservices-architecture', 'staff', '["Microservices","Kafka","Distributed Systems"]', 2, 'published', 'ai', 76340, 1793029331, 1793029331, 1793029331);
INSERT OR IGNORE INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES ('spring-boot-aot-graalvm-native', 'Spring Boot 3.2 AOT Native Images & GraalVM Compilation Architecture', 'Reachability metadata, the closed-world assumption, dynamic proxy constraints, and trimming startup to milliseconds.', '## 01 What AOT changes

A native image is compiled ahead of time under a **closed-world assumption**: every class, method and resource reachable at runtime must be known at build time. Spring Boot''s AOT engine runs your application context during the build and generates plain Java code for bean definitions, so no classpath scanning happens at startup.

```bash
./mvnw -Pnative native:compile
./target/demo   # starts in ~50 ms
```

## 02 Reachability metadata

Reflection, resources, proxies and serialization need hints. Libraries ship them via the GraalVM reachability metadata repository; your own code registers them with `RuntimeHintsRegistrar`.

```java
class MyHints implements RuntimeHintsRegistrar {
    public void registerHints(RuntimeHints hints, ClassLoader cl) {
        hints.reflection().registerType(Invoice.class, MemberCategory.INVOKE_PUBLIC_METHODS);
        hints.resources().registerPattern("templates/*.html");
    }
}
```

> [!CAUTION]
> `@ConditionalOnProperty` is evaluated at **build time** in AOT. Profiles and conditions cannot change which beans exist at runtime.

## 03 When native is worth it

Native images win for scale-to-zero, CLIs and serverless: fast startup and low RSS. Long-running services often get better peak throughput from the JIT.

## Interview Q&A

**Q: Why do dynamic proxies need hints?** Proxy classes are generated at runtime on the JVM; in native they must be generated at build time.

**Q: What is the trade-off vs JIT?** Startup and memory vs peak throughput and build time.

**Q: How do you find missing hints?** Run tests with the tracing agent (`-agentlib:native-image-agent`).', 'java-and-spring-boot', 'mid', '["Spring Boot","GraalVM","JVM Internals"]', 2, 'published', 'human', 41200, 1791646931, 1791646931, 1791646931);
INSERT OR IGNORE INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES ('spring-transactional-propagation-traps', 'Spring @Transactional Propagation: REQUIRES_NEW Rollback Traps', 'Thread-bound transaction resources, physical vs logical commits, self-invocation, and UnexpectedRollbackException.', '## 01 Logical vs physical transactions

With `REQUIRED`, nested calls join one physical transaction. If an inner method throws and the exception is caught by the outer method, the transaction is already marked rollback-only, and the outer commit fails with `UnexpectedRollbackException`.

```java
@Transactional
public void checkout(long orderId) {
    try {
        payments.deduct(orderId);      // REQUIRED: joins, marks rollback-only on error
    } catch (PaymentException e) {
        log.warn("payment failed");    // swallowing does not undo the mark
    }
}                                      // commit -> UnexpectedRollbackException
```

## 02 REQUIRES_NEW suspends, it does not nest

`REQUIRES_NEW` suspends the outer transaction and opens a second physical one with **its own connection**. It commits independently, so an audit log survives an outer rollback, but it holds two pool connections at once.

> [!CAUTION]
> Under load, `REQUIRES_NEW` can deadlock the connection pool: every thread holds one connection and waits for a second.

## 03 Self-invocation skips the proxy

Calling a `@Transactional` method from the same class bypasses the Spring proxy, so its propagation setting is ignored.

> [!TIP]
> Move the inner method to another bean, or use `TransactionTemplate` for explicit boundaries.

## Interview Q&A

**Q: Why does a caught exception still roll back?** The inner participant marked the shared transaction rollback-only.

**Q: Which exceptions roll back by default?** Unchecked ones (`RuntimeException`, `Error`), not checked exceptions.

**Q: When is REQUIRES_NEW right?** For work that must persist regardless of the caller: audit trails, outbox retries.', 'java-and-spring-boot', 'senior', '["Spring Boot","Databases","Concurrency"]', 2, 'published', 'human', 39800, 1791906131, 1791906131, 1791906131);
