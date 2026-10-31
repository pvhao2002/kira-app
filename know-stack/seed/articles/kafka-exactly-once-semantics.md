---
title: "Kafka Exactly-Once Semantics (EOS): Producer Idempotence to Transactions"
summary: How idempotent producers, transactional writes and read_committed consumers combine into exactly-once processing.
category: microservices-architecture
difficulty: senior
tags: Kafka, Distributed Systems
views: 73500
daysAgo: 11
---
## 01 Three delivery guarantees

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
> EOS ends at Kafka's boundary. Writing to a database or calling an HTTP API inside the loop needs its own idempotency (keys or upserts).

## Interview Q&A

**Q: What does `transactional.id` protect against?** Zombie producers: a restarted instance fences the old one by epoch.

**Q: Cost of EOS?** Extra round trips for commit markers; latency rises with smaller transactions.

**Q: Is the consumer side exactly-once by default?** No, it needs `read_committed` and offsets committed in the transaction.
