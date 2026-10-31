---
title: "Garbage Collection Under Load: G1 vs Generational ZGC"
summary: Region-based evacuation, concurrent relocation with load barriers, and choosing a collector by latency budget.
category: core-cs-and-systems
difficulty: senior
tags: Garbage Collection, JVM Internals
views: 28700
daysAgo: 26
---
## 01 G1 in one paragraph

G1 splits the heap into equal regions and collects the ones with the most garbage first. Young collections are stop-the-world evacuations; old regions are reclaimed by mixed collections after a concurrent marking cycle. `-XX:MaxGCPauseMillis` (default 200 ms) is a goal, not a guarantee.

## 02 ZGC: pauses that don't grow with the heap

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

**Q: What is an evacuation failure in G1?** No free regions to copy survivors into, triggering an expensive full GC.
