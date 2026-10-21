import type {EnglishCategory} from '../../shared/models/api.models';
import type {LocalizedText} from './english-speaking.data';

/** Mock interview bank for a Java full-stack developer. `[placeholders]` in PROJECT answers are personal facts to replace. */
export interface InterviewQuestion {
  category: EnglishCategory;
  question: string;
  questionVi: string;
  outline: LocalizedText[];
  answer: string;
  keyPhrases: string[];
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // ---------- JAVA_CORE ----------
  {
    category: 'JAVA_CORE',
    question: "Can you explain how JVM memory is organized?",
    questionVi: "Bạn có thể giải thích bộ nhớ của JVM được tổ chức như thế nào không?",
    outline: [
      {en: "Heap: young and old generation, shared by all threads", vi: "Heap: young và old generation, dùng chung cho mọi thread"},
      {en: "Stack per thread: frames, local variables", vi: "Stack riêng mỗi thread: frame, biến cục bộ"},
      {en: "Metaspace: class metadata, outside the heap", vi: "Metaspace: metadata của class, nằm ngoài heap"}
    ],
    answer: "The JVM splits memory into a few areas. The heap holds all objects, and it's shared by every thread. It's divided into a young generation, where new objects start, and an old generation for long-lived ones. Each thread also has its own stack, which stores method frames and local variables, so it's very fast and cleaned up automatically. Class metadata lives in Metaspace, which is native memory, not the heap. In practice, an OutOfMemoryError on the heap usually means a leak or a heap that's too small, while a StackOverflowError points to very deep or infinite recursion.",
    keyPhrases: ["young and old generation", "method frames", "Metaspace", "StackOverflowError", "shared by every thread"]
  },
  {
    category: 'JAVA_CORE',
    question: "How does garbage collection work in Java, and which collector would you choose?",
    questionVi: "Garbage collection trong Java hoạt động thế nào, và bạn sẽ chọn collector nào?",
    outline: [
      {en: "Objects unreachable from GC roots are collected; generational hypothesis", vi: "Object không còn truy cập được từ GC root sẽ bị thu hồi; giả thuyết phân thế hệ"},
      {en: "G1 is the default: region-based, predictable pauses", vi: "G1 là mặc định: chia region, thời gian dừng dự đoán được"},
      {en: "ZGC for very low latency and large heaps", vi: "ZGC cho độ trễ rất thấp và heap lớn"}
    ],
    answer: "The garbage collector frees objects that are no longer reachable from GC roots, like thread stacks and static fields. Most objects die young, so the JVM collects the young generation often and cheaply. Since Java 9, G1 is the default. It splits the heap into regions and tries to meet a pause-time goal, which suits most web services. For very large heaps or strict latency needs, I'd consider ZGC, which is now generational. Before changing anything, I'd read the GC logs and measure, because most problems come from allocation patterns, not from the collector itself.",
    keyPhrases: ["reachable from GC roots", "pause-time goal", "G1 is the default", "ZGC", "allocation patterns"]
  },
  {
    category: 'JAVA_CORE',
    question: "Why do we need to override equals and hashCode together?",
    questionVi: "Vì sao cần override equals và hashCode cùng nhau?",
    outline: [
      {en: "Contract: equal objects must have equal hash codes", vi: "Quy ước: hai object bằng nhau phải có cùng hash code"},
      {en: "HashMap and HashSet use hashCode first, then equals", vi: "HashMap và HashSet dùng hashCode trước, rồi mới equals"},
      {en: "Use immutable fields; records do it for you", vi: "Dùng field bất biến; record tự làm việc này"}
    ],
    answer: "The contract says that if two objects are equal, they must return the same hash code. Hash-based collections like HashMap and HashSet use the hash code to find the bucket, and then equals to compare inside it. If I override only equals, two equal objects can land in different buckets, so a lookup fails and a Set can contain duplicates. I base both methods on the same fields, and I prefer immutable fields, because changing a field after the object is in a map can make it impossible to find. For simple data classes, a record generates both correctly.",
    keyPhrases: ["the contract says", "land in different buckets", "immutable fields", "a record generates both", "hash-based collections"]
  },
  {
    category: 'JAVA_CORE',
    question: "How does HashMap work internally?",
    questionVi: "HashMap hoạt động bên trong như thế nào?",
    outline: [
      {en: "Array of buckets; index from the key's hash", vi: "Mảng các bucket; chỉ số lấy từ hash của key"},
      {en: "Collisions: linked list, treeified at 8 entries", vi: "Va chạm: linked list, chuyển thành cây đỏ-đen khi có 8 phần tử"},
      {en: "Resize at 0.75 load factor; not thread-safe", vi: "Resize khi đạt load factor 0.75; không thread-safe"}
    ],
    answer: "A HashMap is an array of buckets. When I put a key, Java computes its hash code, maps it to a bucket index, and stores the entry there. If two keys land in the same bucket, they form a linked list, and when a bucket gets long, around eight entries, it turns into a red-black tree, so the worst case is O(log n) instead of O(n). When the map is about 75 percent full, it doubles the array and redistributes the entries. HashMap isn't thread-safe, so for concurrent access I'd use ConcurrentHashMap.",
    keyPhrases: ["array of buckets", "red-black tree", "load factor", "redistributes the entries", "ConcurrentHashMap"]
  },
  {
    category: 'JAVA_CORE',
    question: "What is the difference between checked and unchecked exceptions?",
    questionVi: "Checked exception và unchecked exception khác nhau thế nào?",
    outline: [
      {en: "Checked: compiler forces handling, for recoverable cases", vi: "Checked: compiler bắt buộc xử lý, dùng cho tình huống có thể phục hồi"},
      {en: "Unchecked: RuntimeException, programming errors", vi: "Unchecked: RuntimeException, lỗi lập trình"},
      {en: "Spring rolls back on unchecked by default", vi: "Spring mặc định rollback với unchecked"}
    ],
    answer: "Checked exceptions are checked at compile time. The compiler forces you to catch them or declare them, so they suit recoverable situations, like a file that is missing. Unchecked exceptions extend RuntimeException. They usually mean a programming error, like a null pointer or an illegal argument, and you don't have to declare them. In modern code I mostly use unchecked exceptions with clear domain names, because checked ones clutter method signatures and don't work well with lambdas. One thing to remember is that Spring's @Transactional rolls back on unchecked exceptions by default, but not on checked ones.",
    keyPhrases: ["recoverable situations", "programming error", "clutter method signatures", "domain exceptions", "rolls back by default"]
  },
  {
    category: 'JAVA_CORE',
    question: "What is the difference between platform threads and virtual threads?",
    questionVi: "Platform thread và virtual thread khác nhau thế nào?",
    outline: [
      {en: "Platform thread maps 1:1 to an OS thread; expensive", vi: "Platform thread ánh xạ 1:1 với thread hệ điều hành; tốn tài nguyên"},
      {en: "Virtual threads (Java 21) are cheap and managed by the JVM", vi: "Virtual thread (Java 21) nhẹ và do JVM quản lý"},
      {en: "Good for blocking I/O, not for CPU-bound work", vi: "Phù hợp I/O chặn, không phù hợp việc tính toán nặng CPU"}
    ],
    answer: "A platform thread is a thin wrapper around an OS thread, so it's expensive, and we usually limit it with a pool. Virtual threads, final in Java 21, are scheduled by the JVM, so we can create millions of them. When a virtual thread blocks on I/O, the JVM unmounts it and the carrier thread does other work. That's great for services with many blocking calls, like database or HTTP requests, and the code stays simple and synchronous. They don't help CPU-bound work, and I'd avoid pooling them or holding long locks around blocking calls, because that can pin the carrier thread.",
    keyPhrases: ["thin wrapper around an OS thread", "scheduled by the JVM", "blocking I/O", "CPU-bound work", "pin the carrier thread"]
  },
  {
    category: 'JAVA_CORE',
    question: "What does final mean, and how do you design an immutable class?",
    questionVi: "final nghĩa là gì, và bạn thiết kế một class bất biến như thế nào?",
    outline: [
      {en: "final variable can be assigned once; final class cannot be extended", vi: "Biến final chỉ gán một lần; class final không thể kế thừa"},
      {en: "Immutable: final fields, no setters, defensive copies", vi: "Bất biến: field final, không setter, sao chép phòng vệ"},
      {en: "Benefits: thread-safe, safe as map keys; use records", vi: "Lợi ích: thread-safe, an toàn làm key; dùng record"}
    ],
    answer: "The final keyword means different things depending on where it is. A final variable can be assigned only once, a final method can't be overridden, and a final class can't be extended. Note that a final reference can still point to a mutable object. To make a class immutable, I make it final, make all fields private and final, add no setters, and make defensive copies of mutable inputs like lists or dates. Immutable objects are thread-safe without locking and are safe to use as map keys. Since Java 16, a record gives me this for simple data carriers in one line.",
    keyPhrases: ["assigned only once", "defensive copies", "thread-safe without locking", "data carriers", "can't be overridden"]
  },

  // ---------- SPRING ----------
  {
    category: 'SPRING',
    question: "What are Inversion of Control and Dependency Injection in Spring?",
    questionVi: "Inversion of Control và Dependency Injection trong Spring là gì?",
    outline: [
      {en: "IoC: the container creates and manages objects", vi: "IoC: container tạo và quản lý các object"},
      {en: "DI: dependencies are provided from outside, ideally by constructor", vi: "DI: dependency được cung cấp từ bên ngoài, tốt nhất qua constructor"},
      {en: "Benefits: loose coupling, easy testing", vi: "Lợi ích: giảm phụ thuộc chặt, dễ test"}
    ],
    answer: "Inversion of Control means that my code doesn't create its collaborators. The Spring container creates the beans, wires them together, and manages their lifecycle. Dependency Injection is how that happens: the container passes the dependencies into my class. I prefer constructor injection, because the fields can be final, the dependencies are explicit, and I can write a unit test with plain objects or mocks, without starting Spring. It also makes missing dependencies fail at startup instead of at runtime. The main benefit is loose coupling, because I depend on interfaces, and I can swap an implementation without changing the caller.",
    keyPhrases: ["constructor injection", "wires them together", "loose coupling", "fail at startup", "depend on interfaces"]
  },
  {
    category: 'SPRING',
    question: "What bean scopes does Spring have, and which one is the default?",
    questionVi: "Spring có những bean scope nào, và scope nào là mặc định?",
    outline: [
      {en: "Singleton is the default: one instance per container", vi: "Singleton là mặc định: một instance cho mỗi container"},
      {en: "Prototype, request, session, application", vi: "Prototype, request, session, application"},
      {en: "Singletons must be stateless or thread-safe", vi: "Singleton phải không giữ state hoặc phải thread-safe"}
    ],
    answer: "The default scope is singleton, which means the container creates one instance and shares it everywhere. Because many threads use it at the same time, a singleton bean should be stateless or thread-safe. A prototype bean creates a new instance every time it's requested. In web applications, we also have request scope, one instance per HTTP request, and session scope, one per user session. A common trap is injecting a prototype or request-scoped bean into a singleton, because it gets injected only once. In that case I'd use a scoped proxy or ObjectProvider to get a fresh instance when needed.",
    keyPhrases: ["singleton", "stateless or thread-safe", "request scope", "scoped proxy", "ObjectProvider"]
  },
  {
    category: 'SPRING',
    question: "How does @Transactional work, including propagation and self-invocation?",
    questionVi: "@Transactional hoạt động thế nào, gồm propagation và self-invocation?",
    outline: [
      {en: "Proxy-based: begins and commits around the method", vi: "Dựa trên proxy: mở và commit transaction quanh method"},
      {en: "REQUIRED joins the current one; REQUIRES_NEW starts a new one", vi: "REQUIRED tham gia transaction hiện tại; REQUIRES_NEW tạo transaction mới"},
      {en: "Self-invocation bypasses the proxy, so no transaction", vi: "Tự gọi trong cùng class bỏ qua proxy nên không có transaction"}
    ],
    answer: "Spring implements @Transactional with a proxy. The proxy opens a transaction before the method, and commits or rolls back after it, by default on unchecked exceptions. The default propagation is REQUIRED, which joins the existing transaction or creates one. REQUIRES_NEW suspends the current one and starts an independent transaction, which is useful for audit logs. The classic pitfall is self-invocation. If one method calls another @Transactional method in the same class, the call doesn't go through the proxy, so the annotation is ignored. I fix it by moving the method to another bean or by restructuring the code.",
    keyPhrases: ["proxy", "REQUIRED joins the existing transaction", "REQUIRES_NEW", "self-invocation", "rolls back on unchecked exceptions"]
  },
  {
    category: 'SPRING',
    question: "How does the Spring Security filter chain work with JWT authentication?",
    questionVi: "Filter chain của Spring Security hoạt động thế nào khi xác thực bằng JWT?",
    outline: [
      {en: "Requests pass through an ordered SecurityFilterChain", vi: "Request đi qua SecurityFilterChain theo thứ tự"},
      {en: "A JWT filter validates the token and sets the SecurityContext", vi: "Filter JWT kiểm tra token và gán SecurityContext"},
      {en: "Stateless sessions, short-lived access token plus refresh token", vi: "Không dùng session, access token ngắn hạn kèm refresh token"}
    ],
    answer: "In Spring Security, every request goes through an ordered chain of filters before it reaches my controller. For JWT, I add a filter before the authentication filter. It reads the Bearer token from the Authorization header, verifies the signature and expiry, and puts an Authentication object into the SecurityContext. After that, authorization rules, like requiring a role, are applied. I configure the session as stateless, so the server stores nothing. I keep the access token short-lived, around fifteen minutes, and use a refresh token to get a new one. I never log tokens, and I return 401 for invalid ones.",
    keyPhrases: ["ordered chain of filters", "verifies the signature and expiry", "SecurityContext", "stateless", "short-lived access token"]
  },
  {
    category: 'SPRING',
    question: "How does Spring Boot auto-configuration work?",
    questionVi: "Auto-configuration của Spring Boot hoạt động thế nào?",
    outline: [
      {en: "@SpringBootApplication enables @EnableAutoConfiguration", vi: "@SpringBootApplication bật @EnableAutoConfiguration"},
      {en: "Configuration classes registered in AutoConfiguration.imports", vi: "Các configuration class khai báo trong AutoConfiguration.imports"},
      {en: "Conditional annotations; your own bean wins", vi: "Annotation điều kiện; bean của bạn được ưu tiên"}
    ],
    answer: "Spring Boot looks at the dependencies on the classpath and configures sensible defaults for them. The @SpringBootApplication annotation includes @EnableAutoConfiguration, which loads the configuration classes listed in the AutoConfiguration.imports file inside each starter. Each of those classes uses conditional annotations, such as @ConditionalOnClass or @ConditionalOnMissingBean. So if I define my own DataSource bean, the auto-configured one backs off. If something behaves unexpectedly, I start the app with the debug flag, which prints a conditions report that shows what was applied and why. That is my first step when debugging configuration.",
    keyPhrases: ["classpath", "conditional annotations", "backs off", "conditions report", "starter"]
  },
  {
    category: 'SPRING',
    question: "How do you handle exceptions in a Spring Boot REST API?",
    questionVi: "Bạn xử lý exception trong REST API Spring Boot như thế nào?",
    outline: [
      {en: "@RestControllerAdvice with @ExceptionHandler", vi: "@RestControllerAdvice kèm @ExceptionHandler"},
      {en: "Consistent error body, such as ProblemDetail, with a stable error code", vi: "Body lỗi thống nhất, như ProblemDetail, có mã lỗi ổn định"},
      {en: "Never expose stack traces; log server-side", vi: "Không để lộ stack trace; ghi log phía server"}
    ],
    answer: "I centralize error handling in a class annotated with @RestControllerAdvice. Inside, @ExceptionHandler methods map each exception type to an HTTP status and a consistent response body. Spring 6 supports the ProblemDetail format, and I add a stable error code so that the front end can show a clear message or translate it. Validation errors return 400 with the invalid fields, a missing resource returns 404, and unexpected errors return a generic 500. I never expose stack traces or SQL details to the client. I log the full exception on the server, without sensitive data, so I can investigate.",
    keyPhrases: ["@RestControllerAdvice", "ProblemDetail", "stable error code", "consistent response body", "never expose stack traces"]
  },
  {
    category: 'SPRING',
    question: "What is the difference between @Component, @Service and @Repository, and when do you use @Bean?",
    questionVi: "@Component, @Service, @Repository khác nhau thế nào, và khi nào dùng @Bean?",
    outline: [
      {en: "All are stereotypes detected by component scanning", vi: "Đều là stereotype được component scanning phát hiện"},
      {en: "@Repository adds exception translation", vi: "@Repository thêm chuyển đổi exception"},
      {en: "@Bean in a @Configuration class for third-party objects", vi: "@Bean trong class @Configuration cho object của thư viện bên ngoài"}
    ],
    answer: "@Component is the generic stereotype, and Spring finds these classes through component scanning. @Service and @Repository are specializations. @Service doesn't add behavior, but it documents the business layer. @Repository marks the persistence layer and enables exception translation, so database-specific exceptions become Spring's DataAccessException. I use @Bean in a @Configuration class when I can't annotate the class, for example an object from a third-party library, or when the creation needs custom logic. For my own classes, I use stereotypes, because they are shorter and easier to read.",
    keyPhrases: ["component scanning", "stereotype", "exception translation", "third-party library", "business layer"]
  },

  // ---------- DATABASE ----------
  {
    category: 'DATABASE',
    question: "How do database indexes work, and when can they hurt?",
    questionVi: "Index trong database hoạt động thế nào, và khi nào chúng gây hại?",
    outline: [
      {en: "B-tree index: fast lookup instead of full table scan", vi: "Index B-tree: tìm nhanh thay vì quét toàn bảng"},
      {en: "Composite index order and the leftmost prefix rule", vi: "Thứ tự composite index và quy tắc tiền tố bên trái"},
      {en: "Cost: slower writes and more storage", vi: "Chi phí: ghi chậm hơn và tốn thêm dung lượng"}
    ],
    answer: "Most indexes are B-trees, which let the database find rows in logarithmic time instead of scanning the whole table. For a composite index, the column order matters: the index helps queries that use the leftmost columns, so I put the most selective, most used filter columns first. I check the execution plan with EXPLAIN to confirm an index is really used. Indexes aren't free. Every insert and update must maintain them, so too many indexes slow down writes and use storage. Also, wrapping an indexed column in a function can prevent the database from using it.",
    keyPhrases: ["B-tree", "full table scan", "leftmost columns", "execution plan", "slow down writes"]
  },
  {
    category: 'DATABASE',
    question: "What is the N+1 query problem and how do you fix it?",
    questionVi: "Vấn đề N+1 query là gì và bạn khắc phục thế nào?",
    outline: [
      {en: "One query for the list, then one per row for lazy relations", vi: "Một query lấy danh sách, rồi mỗi dòng thêm một query cho quan hệ lazy"},
      {en: "Fix with fetch join, @EntityGraph or batch fetching", vi: "Sửa bằng fetch join, @EntityGraph hoặc batch fetching"},
      {en: "Detect with SQL logging or query counts in tests", vi: "Phát hiện bằng log SQL hoặc đếm query trong test"}
    ],
    answer: "The N+1 problem happens when I load a list of N entities with one query, and then access a lazy relation on each one, which triggers N extra queries. With a hundred orders, that becomes a hundred and one queries, and the page gets slow. I fix it by loading the data I need in one query, using a fetch join, an @EntityGraph, or batch fetching. For read-only screens, a DTO projection is often the cleanest option. To find the problem, I enable SQL logging in development and watch the number of queries per request, and sometimes I assert the count in a test.",
    keyPhrases: ["lazy relation", "fetch join", "@EntityGraph", "DTO projection", "number of queries per request"]
  },
  {
    category: 'DATABASE',
    question: "What are the transaction isolation levels, and which one do you use?",
    questionVi: "Các mức isolation của transaction là gì, và bạn dùng mức nào?",
    outline: [
      {en: "Read uncommitted, read committed, repeatable read, serializable", vi: "Read uncommitted, read committed, repeatable read, serializable"},
      {en: "Anomalies: dirty read, non-repeatable read, phantom read", vi: "Hiện tượng: dirty read, non-repeatable read, phantom read"},
      {en: "Higher isolation means more safety but less concurrency", vi: "Isolation càng cao càng an toàn nhưng giảm khả năng đồng thời"}
    ],
    answer: "Isolation levels decide how much concurrent transactions can see of each other. Read committed prevents dirty reads, repeatable read also prevents non-repeatable reads, and serializable prevents phantom reads too, but it reduces concurrency the most. The defaults differ: PostgreSQL uses read committed, and MySQL InnoDB uses repeatable read. I usually keep the default, because it's enough for most cases. When I need stronger guarantees for a specific operation, like a balance update, I prefer explicit locking or a unique constraint instead of raising the isolation level for the whole application.",
    keyPhrases: ["dirty reads", "phantom reads", "concurrent transactions", "stronger guarantees", "reduces concurrency"]
  },
  {
    category: 'DATABASE',
    question: "What is the difference between optimistic and pessimistic locking?",
    questionVi: "Optimistic locking và pessimistic locking khác nhau thế nào?",
    outline: [
      {en: "Optimistic: version column, detect conflict at update time", vi: "Optimistic: cột version, phát hiện xung đột lúc cập nhật"},
      {en: "Pessimistic: lock rows up front with SELECT FOR UPDATE", vi: "Pessimistic: khóa dòng từ đầu bằng SELECT FOR UPDATE"},
      {en: "Choose by how often conflicts happen", vi: "Chọn tùy theo tần suất xung đột"}
    ],
    answer: "With optimistic locking, I add a version column, and in JPA that's the @Version annotation. Nothing is locked while I work. At update time, the database checks that the version hasn't changed, and if it has, the update fails and I retry or tell the user. It works well when conflicts are rare. With pessimistic locking, I lock the rows up front, for example with SELECT FOR UPDATE, so other transactions wait. It's safer when conflicts are frequent, like updating a balance, but it reduces throughput, and I must keep the transaction short to avoid deadlocks.",
    keyPhrases: ["version column", "@Version", "conflicts are rare", "SELECT FOR UPDATE", "avoid deadlocks"]
  },
  {
    category: 'DATABASE',
    question: "How do you implement pagination, and what are the trade-offs?",
    questionVi: "Bạn triển khai phân trang như thế nào, và đánh đổi là gì?",
    outline: [
      {en: "Offset pagination: simple, but slow on deep pages", vi: "Offset pagination: đơn giản nhưng chậm ở các trang sâu"},
      {en: "Keyset (cursor) pagination: stable and fast", vi: "Keyset (cursor): ổn định và nhanh"},
      {en: "Always add a stable ORDER BY and a maximum page size", vi: "Luôn có ORDER BY ổn định và giới hạn kích thước trang"}
    ],
    answer: "The simplest way is offset pagination with LIMIT and OFFSET, which Spring Data supports through Pageable. It's easy and lets users jump to any page, but on deep pages the database still scans and skips all earlier rows, so it gets slow. It can also show duplicates when data changes between requests. For large or infinite-scroll lists, I use keyset pagination: I filter with the last seen id or timestamp, ordered by an indexed column, so every page is fast. In both cases, I use a stable ORDER BY and cap the maximum page size on the server.",
    keyPhrases: ["offset pagination", "keyset pagination", "stable ORDER BY", "cap the maximum page size", "infinite-scroll"]
  },
  {
    category: 'DATABASE',
    question: "How do you manage database schema changes in production?",
    questionVi: "Bạn quản lý thay đổi schema database trên production như thế nào?",
    outline: [
      {en: "Versioned migrations with Flyway or Liquibase", vi: "Migration có đánh phiên bản bằng Flyway hoặc Liquibase"},
      {en: "Never edit an applied migration; add a new one", vi: "Không bao giờ sửa migration đã chạy; thêm migration mới"},
      {en: "Expand and contract for zero-downtime changes", vi: "Mở rộng rồi thu hẹp để thay đổi không downtime"}
    ],
    answer: "I keep every schema change in a versioned migration script, using Flyway, and the scripts live in the repository and run automatically at startup. The golden rule is that I never edit a migration that was already applied. If something is wrong, I add a new migration. For zero-downtime releases, I use the expand and contract pattern. First I add the new column as nullable and deploy code that writes both. Then I backfill the data, and only in a later release I remove the old column. That keeps the previous application version working during the rollout.",
    keyPhrases: ["versioned migration", "never edit an applied migration", "expand and contract", "backfill the data", "zero-downtime"]
  },
  {
    category: 'DATABASE',
    question: "How do you decide between a relational database and NoSQL, or add a cache like Redis?",
    questionVi: "Bạn chọn giữa database quan hệ và NoSQL, hoặc thêm cache như Redis, như thế nào?",
    outline: [
      {en: "Relational by default: transactions, joins, constraints", vi: "Mặc định dùng quan hệ: transaction, join, ràng buộc"},
      {en: "NoSQL for specific access patterns or scale", vi: "NoSQL cho mẫu truy cập cụ thể hoặc quy mô lớn"},
      {en: "Cache read-heavy data, plan invalidation", vi: "Cache dữ liệu đọc nhiều, tính trước cách invalidation"}
    ],
    answer: "My default is a relational database, because most business data needs transactions, constraints and flexible queries. I'd consider NoSQL only for a clear reason, like a very high write volume, a flexible document structure, or a simple key-based access pattern. For performance, I first check the queries and indexes. If the data is read often and changes rarely, I add a cache like Redis with a time-to-live. The hard part of caching is invalidation, so I decide up front how stale the data may be. I also make sure the system still works, only slower, when the cache is down.",
    keyPhrases: ["transactions and constraints", "access pattern", "time-to-live", "invalidation", "how stale the data may be"]
  },

  // ---------- ANGULAR ----------
  {
    category: 'ANGULAR',
    question: "How does change detection work in Angular, and why use OnPush?",
    questionVi: "Change detection trong Angular hoạt động thế nào, và vì sao dùng OnPush?",
    outline: [
      {en: "Default: checks the whole component tree after events", vi: "Mặc định: kiểm tra toàn bộ cây component sau mỗi sự kiện"},
      {en: "OnPush: only when inputs change, events fire or signals update", vi: "OnPush: chỉ khi input đổi, có sự kiện hoặc signal cập nhật"},
      {en: "Immutable data and the async pipe fit OnPush", vi: "Dữ liệu bất biến và async pipe phù hợp với OnPush"}
    ],
    answer: "Change detection is how Angular updates the DOM when data changes. By default, after every event, such as a click or an HTTP response, Angular checks the whole component tree. With OnPush, a component is checked only when an input reference changes, an event fires inside it, an async pipe emits, or a signal it reads changes. That reduces unnecessary work in large screens. To use OnPush safely, I treat data as immutable, so I replace objects instead of mutating them, and I prefer signals or the async pipe in templates.",
    keyPhrases: ["component tree", "OnPush", "input reference changes", "immutable", "async pipe"]
  },
  {
    category: 'ANGULAR',
    question: "When would you use Signals, and when RxJS?",
    questionVi: "Khi nào bạn dùng Signals, khi nào dùng RxJS?",
    outline: [
      {en: "Signals: synchronous local state, computed values", vi: "Signals: state cục bộ đồng bộ, giá trị computed"},
      {en: "RxJS: async streams, debounce, cancellation, websockets", vi: "RxJS: luồng bất đồng bộ, debounce, hủy request, websocket"},
      {en: "Convert with toSignal and toObservable", vi: "Chuyển đổi bằng toSignal và toObservable"}
    ],
    answer: "I use both, for different jobs. Signals are great for component state. They're synchronous, easy to read, and computed values update automatically, so templates stay simple and change detection is efficient. RxJS is better for asynchronous streams over time, such as search-as-you-type with debounce, canceling an outdated request with switchMap, or combining several event sources. At the boundary, I convert with toSignal, so a template can read an HTTP result as a signal. My rule of thumb is: state in signals, event streams in RxJS.",
    keyPhrases: ["component state", "computed values", "asynchronous streams", "switchMap", "toSignal"]
  },
  {
    category: 'ANGULAR',
    question: "How does lazy loading work in Angular, and why does it matter?",
    questionVi: "Lazy loading trong Angular hoạt động thế nào, và vì sao quan trọng?",
    outline: [
      {en: "loadComponent or loadChildren with dynamic import", vi: "loadComponent hoặc loadChildren với dynamic import"},
      {en: "Smaller initial bundle, faster first load", vi: "Bundle ban đầu nhỏ hơn, tải lần đầu nhanh hơn"},
      {en: "@defer for lazy parts of a template; preloading strategies", vi: "@defer cho phần template tải trễ; chiến lược preloading"}
    ],
    answer: "Lazy loading means the code for a feature is downloaded only when the user navigates to it. In the router, I use loadComponent or loadChildren with a dynamic import, and the build tool splits that code into a separate chunk. This keeps the initial bundle small, so the first page loads faster, especially on slow mobile networks. Inside a template, I can also use @defer to load a heavy part, like a chart, when it becomes visible. If a lazy route should feel instant, I can add a preloading strategy that fetches it in the background.",
    keyPhrases: ["loadComponent", "dynamic import", "initial bundle", "@defer", "preloading strategy"]
  },
  {
    category: 'ANGULAR',
    question: "What are HTTP interceptors, and how do you use them?",
    questionVi: "HTTP interceptor là gì và bạn dùng chúng như thế nào?",
    outline: [
      {en: "Functional interceptors with provideHttpClient(withInterceptors)", vi: "Interceptor dạng hàm với provideHttpClient(withInterceptors)"},
      {en: "Attach the token; handle 401 with refresh and retry", vi: "Gắn token; xử lý 401 bằng refresh rồi thử lại"},
      {en: "Central error handling, loading and logging", vi: "Xử lý lỗi, loading và logging tập trung"}
    ],
    answer: "An interceptor sits between my code and the network, so it can change every outgoing request or incoming response in one place. In modern Angular, I write a functional interceptor and register it with provideHttpClient and withInterceptors. The most common one attaches the access token to API calls. Another one handles a 401 response: it calls the refresh endpoint once, then retries the original request, and if refresh fails, it signs the user out. I also use interceptors for consistent error mapping. I only attach the token to my own API, never to third-party domains.",
    keyPhrases: ["functional interceptor", "withInterceptors", "attaches the access token", "retries the original request", "error mapping"]
  },
  {
    category: 'ANGULAR',
    question: "What are standalone components, and why did Angular move away from NgModules?",
    questionVi: "Standalone component là gì, và vì sao Angular chuyển khỏi NgModule?",
    outline: [
      {en: "Component declares its own imports; no NgModule needed", vi: "Component tự khai báo imports; không cần NgModule"},
      {en: "Less boilerplate, easier lazy loading and tree-shaking", vi: "Ít code lặp, lazy loading và tree-shaking dễ hơn"},
      {en: "Bootstrap with bootstrapApplication and provide functions", vi: "Khởi động bằng bootstrapApplication và các hàm provide"}
    ],
    answer: "A standalone component declares its own dependencies in the imports array, so it doesn't need to belong to an NgModule. That removes a lot of boilerplate, and it's easier to understand what a component needs just by reading it. It also makes lazy loading and tree-shaking simpler, because the dependency graph is explicit. The app starts with bootstrapApplication, and global services are registered with provide functions, like provideRouter and provideHttpClient. In recent Angular versions, standalone is the default, and I use it for all new code.",
    keyPhrases: ["imports array", "boilerplate", "tree-shaking", "bootstrapApplication", "dependency graph"]
  },
  {
    category: 'ANGULAR',
    question: "How do you build and validate forms in Angular?",
    questionVi: "Bạn xây dựng và validate form trong Angular như thế nào?",
    outline: [
      {en: "Reactive forms: FormGroup, typed controls, validators", vi: "Reactive form: FormGroup, control có kiểu, validator"},
      {en: "Show errors after touched; custom and async validators", vi: "Hiện lỗi sau khi touched; validator tùy chỉnh và bất đồng bộ"},
      {en: "Server-side validation is still the source of truth", vi: "Validate phía server vẫn là nguồn sự thật"}
    ],
    answer: "For anything non-trivial, I use reactive forms. I build a typed FormGroup with FormControls, and attach validators such as required, email, or custom ones for rules like matching passwords. I show errors only after a field is touched, so the user isn't distracted too early, and I disable the submit button while the request is running. For checks that need the server, like a unique username, I use an async validator with debounce. Client validation is only for user experience. The backend validates everything again, because it's the real source of truth.",
    keyPhrases: ["reactive forms", "typed FormGroup", "custom validators", "async validator", "source of truth"]
  },
  {
    category: 'ANGULAR',
    question: "How do you structure state and API calls in an Angular feature?",
    questionVi: "Bạn tổ chức state và gọi API trong một tính năng Angular như thế nào?",
    outline: [
      {en: "Page component holds signals; a service wraps HttpClient", vi: "Page component giữ signals; service bọc HttpClient"},
      {en: "Explicit loading, empty and error states", vi: "Trạng thái loading, rỗng và lỗi rõ ràng"},
      {en: "Typed models; avoid duplicated requests and unsubscribed streams", vi: "Model có kiểu; tránh request trùng và stream không hủy đăng ký"}
    ],
    answer: "I keep the structure simple. A service wraps HttpClient and returns typed models, so components never build URLs. The page component holds its state in signals: the data, a loading flag, and an error. The template always renders one of three clear states: loading, empty, or error with a retry button, so the user is never staring at a blank screen. I disable buttons while a request is running to prevent double submits, and I use takeUntilDestroyed for subscriptions so nothing leaks when the user leaves the page.",
    keyPhrases: ["typed models", "loading flag", "retry button", "double submits", "takeUntilDestroyed"]
  },

  // ---------- SYSTEM_DESIGN ----------
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a URL shortener?",
    questionVi: "Bạn sẽ thiết kế một dịch vụ rút gọn URL như thế nào?",
    outline: [
      {en: "Clarify: read-heavy, ID generation with base62", vi: "Làm rõ yêu cầu: đọc nhiều, sinh ID bằng base62"},
      {en: "Store code to URL mapping; cache hot links; 301 or 302 redirect", vi: "Lưu ánh xạ code sang URL; cache link nóng; redirect 301 hoặc 302"},
      {en: "Scale: stateless servers, partition by code, analytics async", vi: "Mở rộng: server không giữ state, phân vùng theo code, analytics bất đồng bộ"}
    ],
    answer: "First I'd clarify the requirements: it's very read-heavy, because redirects far outnumber creations. For creation, I generate a unique numeric ID, for example from a sequence or a distributed ID generator, and encode it in base62 to get a short code. The database stores the code, the long URL and an optional expiry. For reads, I put a Redis cache in front, since a few links are very popular, and return a redirect. To scale, the API servers are stateless behind a load balancer, and the data is partitioned by code. Click analytics are sent asynchronously through a queue, so they don't slow down redirects.",
    keyPhrases: ["read-heavy", "base62", "distributed ID generator", "stateless", "asynchronously through a queue"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a rate limiter?",
    questionVi: "Bạn sẽ thiết kế một rate limiter như thế nào?",
    outline: [
      {en: "Algorithms: token bucket, sliding window", vi: "Thuật toán: token bucket, sliding window"},
      {en: "Shared counters in Redis with atomic operations", vi: "Bộ đếm dùng chung trong Redis với thao tác nguyên tử"},
      {en: "Return 429 with Retry-After; decide fail-open or fail-closed", vi: "Trả 429 kèm Retry-After; quyết định fail-open hay fail-closed"}
    ],
    answer: "I'd start by deciding what we limit: per user, per API key, or per IP. For the algorithm, I like the token bucket, because it allows short bursts while enforcing an average rate. With several servers, the counters must be shared, so I store them in Redis and update them atomically with a Lua script or an atomic increment. The limiter can run in the API gateway, before the request reaches the application. When a client goes over the limit, I return 429 with a Retry-After header. I'd also decide what happens if Redis is down. For most APIs, I'd fail open and raise an alert.",
    keyPhrases: ["token bucket", "short bursts", "update them atomically", "429 with a Retry-After header", "fail open"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a notification system for email, push and in-app messages?",
    questionVi: "Bạn sẽ thiết kế hệ thống thông báo cho email, push và in-app như thế nào?",
    outline: [
      {en: "Producer publishes an event; queue decouples delivery", vi: "Producer phát sự kiện; queue tách rời việc gửi"},
      {en: "Per-channel workers with retries, backoff, dead-letter queue", vi: "Worker riêng cho từng kênh, có retry, backoff, dead-letter queue"},
      {en: "User preferences, templates, idempotency to avoid duplicates", vi: "Tùy chọn người dùng, template, idempotency để tránh gửi trùng"}
    ],
    answer: "I'd decouple sending from the business action. When something happens, the service publishes an event to a message queue, like RabbitMQ or Kafka, so the user's request returns quickly. Separate workers consume messages for each channel, such as email, push and in-app, and they call the provider. Failures are retried with exponential backoff, and messages that keep failing go to a dead-letter queue for investigation. Each notification has an idempotency key, so a redelivered message doesn't send a duplicate. A preference service checks the user's settings and quiet hours, and I track delivery status for monitoring.",
    keyPhrases: ["decouple sending", "exponential backoff", "dead-letter queue", "idempotency key", "delivery status"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How do you make a payment API idempotent?",
    questionVi: "Bạn làm cho một API thanh toán có tính idempotent như thế nào?",
    outline: [
      {en: "Client sends an Idempotency-Key header", vi: "Client gửi header Idempotency-Key"},
      {en: "Unique constraint on the key; store and replay the first response", vi: "Ràng buộc unique trên key; lưu và trả lại response đầu tiên"},
      {en: "Handle concurrent duplicates and use BigDecimal; append-only ledger", vi: "Xử lý trùng đồng thời, dùng BigDecimal; sổ cái chỉ ghi thêm"}
    ],
    answer: "Networks fail, so clients retry, and a retry must not charge the customer twice. The client sends a unique Idempotency-Key with each payment request. On the server, I insert that key into a table with a unique constraint, together with the request fingerprint, in the same transaction as the payment. If the same key arrives again, I don't process it again. I return the stored response of the first request. The unique constraint also handles two concurrent duplicates, because only one insert wins. I also keep the ledger append-only, store money as BigDecimal, and keep keys for a limited time.",
    keyPhrases: ["Idempotency-Key", "unique constraint", "same transaction", "stored response", "append-only ledger"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What caching strategy would you use for a read-heavy service?",
    questionVi: "Bạn sẽ dùng chiến lược caching nào cho một service đọc nhiều?",
    outline: [
      {en: "Cache-aside with TTL; layers: browser, CDN, application, database", vi: "Cache-aside kèm TTL; các tầng: trình duyệt, CDN, ứng dụng, database"},
      {en: "Invalidation on write; avoid stale data", vi: "Invalidation khi ghi; tránh dữ liệu cũ"},
      {en: "Cache stampede protection and monitoring hit rate", vi: "Chống cache stampede và theo dõi tỉ lệ hit"}
    ],
    answer: "I'd start with the cache-aside pattern. The application checks Redis first, and on a miss it reads from the database and stores the result with a time-to-live. On a write, I update the database and then delete the cache entry, so the next read loads fresh data. Static content goes to a CDN and browser cache. The main risks are stale data and a cache stampede, when a popular key expires and many requests hit the database together. I reduce that with random TTL jitter and a lock so that only one request rebuilds the value. I also monitor the hit rate.",
    keyPhrases: ["cache-aside", "time-to-live", "stale data", "cache stampede", "hit rate"]
  },

  // ---------- PROJECT ----------
  {
    category: 'PROJECT',
    question: "Tell me about yourself.",
    questionVi: "Hãy giới thiệu về bản thân.",
    outline: [
      {en: "Present: current role and stack", vi: "Hiện tại: vai trò và công nghệ đang dùng"},
      {en: "Past: one key achievement with a result", vi: "Quá khứ: một thành tích chính kèm kết quả"},
      {en: "Future: why this role", vi: "Tương lai: vì sao ứng tuyển vị trí này"}
    ],
    answer: "I'm a full-stack developer with [number] years of experience, mainly in Java, Spring Boot and Angular. Right now I work at [company], where I build [type of product], and I'm responsible for both the REST APIs and the front end. One project I'm proud of is [project name]. I [key action], and as a result, [measurable result]. I enjoy working across the whole stack, from database design to the user interface. I'm interested in this role because [reason linked to the company], and I'd like to take more ownership of architecture decisions.",
    keyPhrases: ["full-stack developer", "I'm responsible for", "I'm proud of", "measurable result", "take more ownership"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about the most challenging bug you have fixed.",
    questionVi: "Hãy kể về con bug khó nhất mà bạn từng sửa.",
    outline: [
      {en: "Situation: symptom and impact", vi: "Bối cảnh: triệu chứng và ảnh hưởng"},
      {en: "Action: how you investigated and found the root cause", vi: "Hành động: cách điều tra và tìm nguyên nhân gốc"},
      {en: "Result and prevention", vi: "Kết quả và cách phòng ngừa"}
    ],
    answer: "In [project name], users sometimes saw [symptom], but only in production, about [number] times a day. I couldn't reproduce it locally, so I added structured logging around the suspicious flow and compared the logs of failing and successful requests. The root cause was [root cause, for example a race condition between two requests]. I fixed it by [fix], and I added a regression test. After the release, the errors dropped to zero. What I learned is to make the system observable early, because good logs saved me days of guessing.",
    keyPhrases: ["I couldn't reproduce it", "structured logging", "the root cause was", "regression test", "observable"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you improved performance.",
    questionVi: "Hãy kể về một lần bạn cải thiện hiệu năng.",
    outline: [
      {en: "Measure first: the baseline and the bottleneck", vi: "Đo trước: số liệu ban đầu và điểm nghẽn"},
      {en: "Action: index, query, cache or batching", vi: "Hành động: index, query, cache hoặc batching"},
      {en: "Result with numbers", vi: "Kết quả bằng số liệu"}
    ],
    answer: "In [project name], the [page or API name] took about [number] seconds to load during peak hours. Before changing anything, I measured it, and the profiling showed that most of the time went to [bottleneck, for example an N+1 query]. I fixed it with [action, for example a fetch join and a composite index], and I cached the data that rarely changes. After the change, the response time dropped from [number] seconds to [number] milliseconds. I also added a performance test so that the problem can't come back unnoticed.",
    keyPhrases: ["I measured it first", "bottleneck", "peak hours", "dropped from", "can't come back unnoticed"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a disagreement with a teammate and how you handled it.",
    questionVi: "Hãy kể về một lần bất đồng ý kiến với đồng nghiệp và cách bạn xử lý.",
    outline: [
      {en: "Situation: the technical disagreement, kept neutral", vi: "Bối cảnh: bất đồng kỹ thuật, nói trung lập"},
      {en: "Action: listen, use data, try a small experiment", vi: "Hành động: lắng nghe, dùng dữ liệu, thử nghiệm nhỏ"},
      {en: "Result: decision and relationship", vi: "Kết quả: quyết định và mối quan hệ"}
    ],
    answer: "On [project name], a teammate and I disagreed about [topic, for example whether to use a message queue or direct REST calls]. I started by listening, to understand his concerns, which were [concern]. Then I suggested we compare both options against our real requirements, and we ran a small spike for two days. The data showed that [result], so we chose [decision]. Even though it wasn't my first idea, I was happy because the decision was based on facts. We kept a good relationship, and we still use that approach for similar discussions today.",
    keyPhrases: ["we disagreed about", "to understand his concerns", "a small spike", "based on facts", "I started by listening"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a mistake you made and what you learned.",
    questionVi: "Hãy kể về một sai lầm bạn từng mắc và bài học rút ra.",
    outline: [
      {en: "Own the mistake clearly, without blaming others", vi: "Nhận sai rõ ràng, không đổ lỗi cho người khác"},
      {en: "Action: fix quickly, communicate, do a blameless review", vi: "Hành động: sửa nhanh, thông báo, rút kinh nghiệm không đổ lỗi"},
      {en: "Lesson: a process change that prevents it", vi: "Bài học: thay đổi quy trình để không lặp lại"}
    ],
    answer: "In [project name], I released a change that [mistake, for example ran a migration without testing it on production-size data]. It caused [impact] for about [number] minutes. I told my team immediately, rolled back the release, and then fixed the problem properly. It was my mistake, and I said so clearly. Afterwards, we wrote a short post-mortem and made a process change: [change, for example every migration is tested on a copy of production data first]. Since then, I always ask myself what could go wrong before I release, and I think this mistake made me a more careful engineer.",
    keyPhrases: ["it was my mistake", "rolled back the release", "post-mortem", "process change", "a more careful engineer"]
  },
  {
    category: 'PROJECT',
    question: "Which project are you most proud of, and why?",
    questionVi: "Dự án nào bạn tự hào nhất, và vì sao?",
    outline: [
      {en: "What the project is and your role", vi: "Dự án là gì và vai trò của bạn"},
      {en: "A technical decision you made and why", vi: "Một quyết định kỹ thuật bạn đưa ra và lý do"},
      {en: "Impact for users or the business", vi: "Tác động đến người dùng hoặc doanh nghiệp"}
    ],
    answer: "I'm most proud of [project name], a [type of product] used by [number] users. I was the [role], and I was responsible for [area]. The biggest decision was [technical decision, for example choosing a modular monolith with Spring Boot and Angular], because [reason]. It was challenging, since [challenge], but we delivered it on time, and [measurable result]. I'm proud of it because it solved a real problem for users, and I also grew a lot technically and as a team member, especially in [skill].",
    keyPhrases: ["I was responsible for", "the biggest decision was", "delivered it on time", "solved a real problem", "I grew a lot"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you worked under a tight deadline.",
    questionVi: "Hãy kể về một lần bạn làm việc với deadline gấp.",
    outline: [
      {en: "Situation: the deadline and what was at stake", vi: "Bối cảnh: deadline và điều đang bị đe dọa"},
      {en: "Action: prioritize, cut scope, communicate risks early", vi: "Hành động: ưu tiên, cắt giảm phạm vi, báo rủi ro sớm"},
      {en: "Result and what you would do differently", vi: "Kết quả và điều bạn sẽ làm khác đi"}
    ],
    answer: "On [project name], we had only [number] days to deliver [feature] before [event, for example a customer demo]. First, I talked with the product owner to separate must-have items from nice-to-have ones, and we agreed to move [item] to the next release. I flagged the main risk early, which was [risk], and I split the work into small pull requests so reviews were quick. We delivered the core scope on time, with no critical bugs. Looking back, I would raise the estimate earlier, because early communication is what made the difference.",
    keyPhrases: ["must-have", "cut the scope", "flagged the risk early", "small pull requests", "on time"]
  }
];
