---
title: "Spring @Transactional Propagation: REQUIRES_NEW Rollback Traps"
summary: Thread-bound transaction resources, physical vs logical commits, self-invocation, and UnexpectedRollbackException.
category: java-and-spring-boot
difficulty: senior
tags: Spring Boot, Databases, Concurrency
views: 39800
daysAgo: 18
---
## 01 Logical vs physical transactions

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

**Q: When is REQUIRES_NEW right?** For work that must persist regardless of the caller: audit trails, outbox retries.
