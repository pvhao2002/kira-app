import type {EnglishCategory} from '../../shared/models/api.models';
import type {LocalizedText} from './english-speaking.data';

/** Mock interview bank for a Java full-stack developer. `[placeholders]` in PROJECT answers are personal facts to replace. */
export type InterviewRound = 1 | 2 | 3 | 4 | 5 | 6;

export const INTERVIEW_ROUNDS: InterviewRound[] = [1, 2, 3, 4, 5, 6];

export interface InterviewQuestion {
  category: EnglishCategory;
  /** Round of the PwC Java backend interview plan this question belongs to. */
  round?: InterviewRound;
  question: string;
  questionVi: string;
  outline: LocalizedText[];
  answer: string;
  /** A 30-second version for quick review; given for every question in the PwC rounds. */
  shortAnswer?: string;
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
    keyPhrases: ["a young generation", "method frames", "Metaspace", "StackOverflowError", "shared by every thread"]
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
    round: 1,
    question: "Why do we need to override equals and hashCode together?",
    questionVi: "Vì sao cần override equals và hashCode cùng nhau?",
    outline: [
      {en: "Contract: equal objects must have equal hash codes", vi: "Quy ước: hai object bằng nhau phải có cùng hash code"},
      {en: "HashMap and HashSet use hashCode first, then equals", vi: "HashMap và HashSet dùng hashCode trước, rồi mới equals"},
      {en: "Use immutable fields; records do it for you", vi: "Dùng field bất biến; record tự làm việc này"}
    ],
    answer: "The contract says that if two objects are equal, they must return the same hash code. Hash-based collections like HashMap and HashSet use the hash code to find the bucket, and then equals to compare inside it. If I override only equals, two equal objects can land in different buckets, so a lookup fails and a Set can contain duplicates. I base both methods on the same fields, and I prefer immutable fields, because changing a field after the object is in a map can make it impossible to find. For simple data classes, a record generates both correctly.",
    shortAnswer: "Because equal objects must have equal hash codes. HashMap and HashSet find the bucket with hashCode and then compare with equals, so if only equals is overridden, equal objects land in different buckets and lookups fail.",
    keyPhrases: ["the contract says", "land in different buckets", "immutable fields", "a record generates both", "hash-based collections"]
  },
  {
    category: 'JAVA_CORE',
    round: 1,
    question: "How does HashMap work internally?",
    questionVi: "HashMap hoạt động bên trong như thế nào?",
    outline: [
      {en: "Array of buckets; index from the key's hash", vi: "Mảng các bucket; chỉ số lấy từ hash của key"},
      {en: "Collisions: linked list, treeified at 8 entries", vi: "Va chạm: linked list, chuyển thành cây đỏ-đen khi có 8 phần tử"},
      {en: "Resize at 0.75 load factor; not thread-safe", vi: "Resize khi đạt load factor 0.75; không thread-safe"}
    ],
    answer: "A HashMap is an array of buckets. When I put a key, Java computes its hash code, maps it to a bucket index, and stores the entry there. If two keys land in the same bucket, they form a linked list, and when a bucket reaches eight entries and the table has at least sixty-four buckets, it turns into a red-black tree, otherwise the map resizes instead, so the worst case is O(log n) instead of O(n). When the map is about 75 percent full, which is the default load factor, it doubles the array and redistributes the entries. HashMap isn't thread-safe, so for concurrent access I'd use ConcurrentHashMap.",
    shortAnswer: "It's an array of buckets. The key's hash picks the bucket, collisions form a list that turns into a red-black tree when it gets long, and at the 0.75 load factor the array doubles. It isn't thread-safe.",
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
    keyPhrases: ["recoverable situations", "programming error", "clutter method signatures", "clear domain names", "rolls back on unchecked exceptions by default"]
  },
  {
    category: 'JAVA_CORE',
    round: 2,
    question: "What is the difference between platform threads and virtual threads?",
    questionVi: "Platform thread và virtual thread khác nhau thế nào?",
    outline: [
      {en: "Platform thread maps 1:1 to an OS thread; expensive", vi: "Platform thread ánh xạ 1:1 với thread hệ điều hành; tốn tài nguyên"},
      {en: "Virtual threads (Java 21) are cheap and managed by the JVM", vi: "Virtual thread (Java 21) nhẹ và do JVM quản lý"},
      {en: "Good for blocking I/O, not for CPU-bound work", vi: "Phù hợp I/O chặn, không phù hợp việc tính toán nặng CPU"}
    ],
    answer: "A platform thread is a thin wrapper around an OS thread, so it's expensive, and we usually limit it with a pool. Virtual threads, final in Java 21, are scheduled by the JVM, so we can create millions of them. When a virtual thread blocks on I/O, the JVM unmounts it and the carrier thread does other work. That's great for services with many blocking calls, like database or HTTP requests, and the code stays simple and synchronous. They don't help CPU-bound work, and I'd avoid pooling them. On Java 21 to 23, I'd also avoid synchronized blocks around blocking calls, because that can pin the carrier thread, although Java 24 removed that limitation.",
    shortAnswer: "A platform thread is a thin wrapper around a heavy OS thread, so we pool them. Virtual threads, final in Java 21, are cheap and managed by the JVM, so we can have millions of them, which is ideal for blocking I/O, not for CPU-heavy work.",
    keyPhrases: ["thin wrapper around an OS thread", "scheduled by the JVM", "blocks on I/O", "CPU-bound work", "pin the carrier thread"]
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
    round: 3,
    question: "What are Inversion of Control and Dependency Injection in Spring?",
    questionVi: "Inversion of Control và Dependency Injection trong Spring là gì?",
    outline: [
      {en: "IoC: the container creates and manages objects", vi: "IoC: container tạo và quản lý các object"},
      {en: "DI: dependencies are provided from outside, ideally by constructor", vi: "DI: dependency được cung cấp từ bên ngoài, tốt nhất qua constructor"},
      {en: "Benefits: loose coupling, easy testing", vi: "Lợi ích: giảm phụ thuộc chặt, dễ test"}
    ],
    answer: "Inversion of Control means that my code doesn't create its collaborators. The Spring container creates the beans, wires them together, and manages their lifecycle. Dependency Injection is how that happens: the container passes the dependencies into my class. I prefer constructor injection, because the fields can be final, the dependencies are explicit, and I can write a unit test with plain objects or mocks, without starting Spring. It also makes a missing dependency a compile error in a plain unit test, instead of a null field at runtime. The main benefit is loose coupling, because I depend on interfaces, and I can swap an implementation without changing the caller.",
    shortAnswer: "Inversion of Control means the container creates and wires our objects instead of our code. Dependency Injection is how it does it: Spring passes dependencies in, ideally through the constructor, which keeps classes loosely coupled and easy to test.",
    keyPhrases: ["constructor injection", "wires them together", "loose coupling", "a null field at runtime", "depend on interfaces"]
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
    answer: "The default scope is singleton, which means the container creates one instance and shares it everywhere. Because many threads use it at the same time, a singleton bean should be stateless or thread-safe. A prototype bean creates a new instance every time it's requested. In web applications, we also have request scope, one instance per HTTP request, and session scope, one per user session. A common trap is injecting a prototype bean into a singleton, because it gets injected only once. In that case I'd use a scoped proxy or ObjectProvider to get a fresh instance when needed.",
    keyPhrases: ["singleton", "stateless or thread-safe", "request scope", "scoped proxy", "ObjectProvider"]
  },
  {
    category: 'SPRING',
    round: 3,
    question: "How does @Transactional work, including propagation and self-invocation?",
    questionVi: "@Transactional hoạt động thế nào, gồm propagation và self-invocation?",
    outline: [
      {en: "Proxy-based: begins and commits around the method", vi: "Dựa trên proxy: mở và commit transaction quanh method"},
      {en: "REQUIRED joins the current one; REQUIRES_NEW starts a new one", vi: "REQUIRED tham gia transaction hiện tại; REQUIRES_NEW tạo transaction mới"},
      {en: "Self-invocation bypasses the proxy, so no transaction", vi: "Tự gọi trong cùng class bỏ qua proxy nên không có transaction"}
    ],
    answer: "Spring implements @Transactional with a proxy. The proxy opens a transaction before the method, and commits or rolls back after it, by default on unchecked exceptions. The default propagation is REQUIRED, which joins the existing transaction or creates one. REQUIRES_NEW suspends the current one and starts an independent transaction, which is useful for audit logs. The classic pitfall is self-invocation. If one method calls another @Transactional method in the same class, the call doesn't go through the proxy, so the annotation is ignored. I fix it by moving the method to another bean or by restructuring the code.",
    shortAnswer: "Spring wraps the bean in a proxy that opens a transaction before the method and commits or rolls back after it, by default on unchecked exceptions. The default propagation, REQUIRED, joins an existing transaction or starts a new one, and calling the method from the same class skips the proxy, so its @Transactional settings are ignored.",
    keyPhrases: ["proxy", "joins the existing transaction", "REQUIRES_NEW", "self-invocation", "by default on unchecked exceptions"]
  },
  {
    category: 'SPRING',
    round: 3,
    question: "How does the Spring Security filter chain work with JWT authentication?",
    questionVi: "Filter chain của Spring Security hoạt động thế nào khi xác thực bằng JWT?",
    outline: [
      {en: "Requests pass through an ordered SecurityFilterChain", vi: "Request đi qua SecurityFilterChain theo thứ tự"},
      {en: "A JWT filter validates the token and sets the SecurityContext", vi: "Filter JWT kiểm tra token và gán SecurityContext"},
      {en: "Stateless sessions, short-lived access token plus refresh token", vi: "Không dùng session, access token ngắn hạn kèm refresh token"}
    ],
    answer: "In Spring Security, every request goes through an ordered chain of filters before it reaches my controller. For JWT, I add a filter before the authentication filter. It reads the Bearer token from the Authorization header, verifies the signature and expiry, and puts an Authentication object into the SecurityContext. After that, authorization rules, like requiring a role, are applied. I configure the session as stateless, so the server stores nothing. I keep the access token short-lived, around fifteen minutes, and use a refresh token to get a new one. I never log tokens, and I return 401 for invalid ones.",
    shortAnswer: "The client sends the token in the Authorization header. A filter in the security chain validates the signature and expiry, builds the authentication and puts it in the SecurityContext, and then authorization rules decide access. The server stays stateless, with short-lived access tokens and refresh tokens.",
    keyPhrases: ["ordered chain of filters", "verifies the signature and expiry", "SecurityContext", "stateless", "the access token short-lived"]
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
    answer: "Spring Boot looks at the dependencies on the classpath and configures sensible defaults for them. The @SpringBootApplication annotation includes @EnableAutoConfiguration, which loads the configuration classes listed in the AutoConfiguration.imports files, which ship in spring-boot-autoconfigure and in third-party starters. Each of those classes uses conditional annotations, such as @ConditionalOnClass or @ConditionalOnMissingBean. So if I define my own DataSource bean, the auto-configured one backs off. If something behaves unexpectedly, I start the app with the debug flag, which prints a conditions report that shows what was applied and why. That is my first step when debugging configuration.",
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
    round: 3,
    question: "What is the difference between @Component, @Service and @Repository, and when do you use @Bean?",
    questionVi: "@Component, @Service, @Repository khác nhau thế nào, và khi nào dùng @Bean?",
    outline: [
      {en: "All are stereotypes detected by component scanning", vi: "Đều là stereotype được component scanning phát hiện"},
      {en: "@Repository adds exception translation", vi: "@Repository thêm chuyển đổi exception"},
      {en: "@Bean in a @Configuration class for third-party objects", vi: "@Bean trong class @Configuration cho object của thư viện bên ngoài"}
    ],
    answer: "@Component is the generic stereotype, and Spring finds these classes through component scanning. @Service and @Repository are specializations. @Service doesn't add behavior, but it documents the business layer. @Repository marks the persistence layer and enables exception translation, so database-specific exceptions become Spring's DataAccessException. I use @Bean in a @Configuration class when I can't annotate the class, for example an object from a third-party library, or when the creation needs custom logic. For my own classes, I use stereotypes, because they are shorter and easier to read.",
    shortAnswer: "All three register a bean through component scanning; @Service and @Repository just express the layer, and @Repository also translates database exceptions. I use @Bean in a configuration class when I need to create an object from a library I can't annotate.",
    keyPhrases: ["component scanning", "stereotype", "exception translation", "third-party library", "business layer"]
  },

  // ---------- DATABASE ----------
  {
    category: 'DATABASE',
    round: 4,
    question: "How do database indexes work, and when can they hurt?",
    questionVi: "Index trong database hoạt động thế nào, và khi nào chúng gây hại?",
    outline: [
      {en: "B-tree index: fast lookup instead of full table scan", vi: "Index B-tree: tìm nhanh thay vì quét toàn bảng"},
      {en: "Composite index order and the leftmost prefix rule", vi: "Thứ tự composite index và quy tắc tiền tố bên trái"},
      {en: "Cost: slower writes and more storage", vi: "Chi phí: ghi chậm hơn và tốn thêm dung lượng"}
    ],
    answer: "Most indexes are B-trees, which let the database find rows in logarithmic time instead of scanning the whole table. For a composite index, the column order matters: the index helps queries that use the leftmost columns, so I put the columns used with equality filters first and a range column, like a date, last. I check the execution plan with EXPLAIN to confirm an index is really used. Indexes aren't free. Every insert and update must maintain them, so too many indexes slow down writes and use storage. Also, wrapping an indexed column in a function can prevent the database from using it.",
    shortAnswer: "An index is usually a B-tree that lets the database find rows in logarithmic time instead of scanning the whole table. They hurt when there are too many, because every insert and update must maintain them, and they use extra space.",
    keyPhrases: ["B-tree", "scanning the whole table", "leftmost columns", "execution plan", "slow down writes"]
  },
  {
    category: 'DATABASE',
    round: 3,
    question: "What is the N+1 query problem and how do you fix it?",
    questionVi: "Vấn đề N+1 query là gì và bạn khắc phục thế nào?",
    outline: [
      {en: "One query for the list, then one per row for lazy relations", vi: "Một query lấy danh sách, rồi mỗi dòng thêm một query cho quan hệ lazy"},
      {en: "Fix with fetch join, @EntityGraph or batch fetching", vi: "Sửa bằng fetch join, @EntityGraph hoặc batch fetching"},
      {en: "Detect with SQL logging or query counts in tests", vi: "Phát hiện bằng log SQL hoặc đếm query trong test"}
    ],
    answer: "The N+1 problem happens when I load a list of N entities with one query, and then access a lazy relation on each one, which triggers N extra queries. With a hundred orders, that becomes a hundred and one queries, and the page gets slow. I fix it by loading the data I need up front, with a fetch join or an @EntityGraph in one query, or with batch fetching in a few batched queries instead of N. For read-only screens, a DTO projection is often the cleanest option. To find the problem, I enable SQL logging in development and watch the number of queries per request, and sometimes I assert the count in a test.",
    shortAnswer: "It's one query to load a list, then one more query per item to load a lazy relationship. I fix it by fetching what the use case needs in one go, with a join fetch, an entity graph or a DTO projection, and I check the SQL logs.",
    keyPhrases: ["lazy relation", "fetch join", "@EntityGraph", "DTO projection", "number of queries per request"]
  },
  {
    category: 'DATABASE',
    round: 4,
    question: "What are the transaction isolation levels, and which one do you use?",
    questionVi: "Các mức isolation của transaction là gì, và bạn dùng mức nào?",
    outline: [
      {en: "Read uncommitted, read committed, repeatable read, serializable", vi: "Read uncommitted, read committed, repeatable read, serializable"},
      {en: "Anomalies: dirty read, non-repeatable read, phantom read", vi: "Hiện tượng: dirty read, non-repeatable read, phantom read"},
      {en: "Higher isolation means more safety but less concurrency", vi: "Isolation càng cao càng an toàn nhưng giảm khả năng đồng thời"}
    ],
    answer: "Isolation levels decide how much concurrent transactions can see of each other. Read committed prevents dirty reads, repeatable read also prevents non-repeatable reads, and serializable prevents phantom reads too, but it reduces concurrency the most. The defaults differ: PostgreSQL uses read committed, and MySQL InnoDB uses repeatable read. I usually keep the default, because it's enough for most cases. When I need stronger guarantees for a specific operation, like a balance update, I prefer explicit locking or a unique constraint instead of raising the isolation level for the whole application.",
    shortAnswer: "Read uncommitted, read committed, repeatable read and serializable; higher levels prevent more anomalies but reduce concurrency. MySQL's default is repeatable read, and for conflicts like double spending I add optimistic locking or a locking read.",
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
    answer: "With optimistic locking, I add a version column, and in JPA that's the @Version annotation. Nothing is locked while I work. At update time, the database checks that the version hasn't changed, and if it has, the update fails and I retry or tell the user. It works well when conflicts are rare. With pessimistic locking, I lock the rows up front, for example with SELECT FOR UPDATE, so other transactions wait. It's safer when conflicts are frequent, like updating a balance, but it reduces throughput, and I must keep the transaction short and lock rows in a consistent order to avoid deadlocks.",
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
    answer: "I keep every schema change in a versioned migration script, using Flyway, and the scripts live in the repository and run automatically at startup. The golden rule is that I never edit a migration that was already applied. If something is wrong, I add a new migration. For zero-downtime releases, I use the expand and contract pattern. First I add the new column as nullable and deploy code that writes to both the old and the new column. Then I backfill the data, and only in a later release do I remove the old column. That keeps the previous application version working during the rollout.",
    keyPhrases: ["versioned migration", "never edit a migration that was already applied", "expand and contract", "backfill the data", "zero-downtime"]
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
    keyPhrases: ["transactions, constraints and flexible queries", "access pattern", "time-to-live", "invalidation", "how stale the data may be"]
  },

  // ---------- ANGULAR ----------
  {
    category: 'ANGULAR',
    question: "How does change detection work in Angular, and why use OnPush?",
    questionVi: "Change detection trong Angular hoạt động thế nào, và vì sao dùng OnPush?",
    outline: [
      {en: "With Zone.js: checks the whole component tree after events", vi: "Với Zone.js: kiểm tra toàn bộ cây component sau mỗi sự kiện"},
      {en: "OnPush: only when inputs change, events fire or signals update", vi: "OnPush: chỉ khi input đổi, có sự kiện hoặc signal cập nhật"},
      {en: "Immutable data and the async pipe fit OnPush", vi: "Dữ liệu bất biến và async pipe phù hợp với OnPush"}
    ],
    answer: "Change detection is how Angular updates the DOM when data changes. With Zone.js, which most existing apps still use, after every event, such as a click or an HTTP response, Angular checks the whole component tree. With OnPush, a component is checked only when an input reference changes, an event fires inside it, an async pipe emits, or a signal it reads changes. That reduces unnecessary work in large screens. To use OnPush safely, I treat data as immutable, so I replace objects instead of mutating them, and I prefer signals or the async pipe in templates.",
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
    keyPhrases: ["reactive forms", "typed FormGroup", "custom ones", "async validator", "source of truth"]
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
    answer: "I keep the structure simple. A service wraps HttpClient and returns typed models, so components never build URLs. The page component holds its state in signals: the data, a loading flag, and an error. Besides the data itself, the template has clear loading, empty and error states, with a retry button on errors, so the user is never staring at a blank screen. I disable buttons while a request is running to prevent double submits, and I use takeUntilDestroyed for subscriptions so nothing leaks when the user leaves the page.",
    keyPhrases: ["typed models", "loading flag", "retry button", "double submits", "takeUntilDestroyed"]
  },

  // ---------- SYSTEM_DESIGN ----------
  {
    category: 'SYSTEM_DESIGN',
    round: 5,
    question: "How would you design a URL shortener?",
    questionVi: "Bạn sẽ thiết kế một dịch vụ rút gọn URL như thế nào?",
    outline: [
      {en: "Clarify: read-heavy, ID generation with base62", vi: "Làm rõ yêu cầu: đọc nhiều, sinh ID bằng base62"},
      {en: "Store code to URL mapping; cache hot links; 301 or 302 redirect", vi: "Lưu ánh xạ code sang URL; cache link nóng; redirect 301 hoặc 302"},
      {en: "Scale: stateless servers, partition by code, analytics async", vi: "Mở rộng: server không giữ state, phân vùng theo code, analytics bất đồng bộ"}
    ],
    answer: "First I'd clarify the requirements: it's very read-heavy, because redirects far outnumber creations. For creation, I generate a unique numeric ID, for example from a sequence or a distributed ID generator, and encode it in base62 to get a short code. The database stores the code, the long URL and an optional expiry. For reads, I put a Redis cache in front, since a few links are very popular, and return a redirect. To scale, the API servers are stateless behind a load balancer, and the data is partitioned by code. Click analytics are sent asynchronously through a queue, so they don't slow down redirects.",
    shortAnswer: "Generate a short code, for example base62 of a unique ID, store the mapping, and redirect with a 301 or 302. Reads are much more frequent than writes, so I cache popular codes, and I add rate limiting and expiry.",
    keyPhrases: ["read-heavy", "base62", "distributed ID generator", "stateless", "asynchronously through a queue"]
  },
  {
    category: 'SYSTEM_DESIGN',
    round: 5,
    question: "How would you design a rate limiter?",
    questionVi: "Bạn sẽ thiết kế một rate limiter như thế nào?",
    outline: [
      {en: "Algorithms: token bucket, sliding window", vi: "Thuật toán: token bucket, sliding window"},
      {en: "Shared counters in Redis with atomic operations", vi: "Bộ đếm dùng chung trong Redis với thao tác nguyên tử"},
      {en: "Return 429 with Retry-After; decide fail-open or fail-closed", vi: "Trả 429 kèm Retry-After; quyết định fail-open hay fail-closed"}
    ],
    answer: "I'd start by deciding what we limit: per user, per API key, or per IP. For the algorithm, I like the token bucket, because it allows short bursts while enforcing an average rate. With several servers, the counters must be shared, so I store them in Redis and update them atomically with a Lua script or an atomic increment. The limiter can run in the API gateway, before the request reaches the application. When a client goes over the limit, I return 429 with a Retry-After header. I'd also decide what happens if Redis is down. For most APIs, I'd fail open and raise an alert.",
    shortAnswer: "I'd use a token bucket per user or API key, stored in Redis so all instances share it, with an atomic update. When the limit is reached, the API returns 429 with a Retry-After header.",
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
    keyPhrases: ["Idempotency-Key", "unique constraint", "same transaction", "stored response", "the ledger append-only"]
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
    round: 6,
    question: "Tell me about the most challenging bug you have fixed.",
    questionVi: "Hãy kể về con bug khó nhất mà bạn từng sửa.",
    outline: [
      {en: "Situation: symptom and impact", vi: "Bối cảnh: triệu chứng và ảnh hưởng"},
      {en: "Action: how you investigated and found the root cause", vi: "Hành động: cách điều tra và tìm nguyên nhân gốc"},
      {en: "Result and prevention", vi: "Kết quả và cách phòng ngừa"}
    ],
    answer: "In [project name], users sometimes saw [symptom], but only in production, about [number] times a day. I couldn't reproduce it locally, so I added structured logging around the suspicious flow and compared the logs of failing and successful requests. The root cause was [root cause, for example a race condition between two requests]. I fixed it by [fix], and I added a regression test. After the release, the errors dropped to zero. What I learned is to make the system observable early, because good logs saved me days of guessing.",
    shortAnswer: "In [project], [symptom] happened only in production. I couldn't reproduce it locally, so I added structured logging and compared failing and successful requests, found the root cause was [cause], fixed it with [fix], and added a regression test, so the errors dropped to zero.",
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
    keyPhrases: ["I measured it", "bottleneck", "peak hours", "dropped from", "can't come back unnoticed"]
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
    keyPhrases: ["disagreed about", "to understand his concerns", "a small spike", "based on facts", "I started by listening"]
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
    keyPhrases: ["I was responsible for", "the biggest decision was", "delivered it on time", "solved a real problem", "grew a lot"]
  },
  {
    category: 'PROJECT',
    round: 6,
    question: "Tell me about a time you worked under a tight deadline.",
    questionVi: "Hãy kể về một lần bạn làm việc với deadline gấp.",
    outline: [
      {en: "Situation: the deadline and what was at stake", vi: "Bối cảnh: deadline và hậu quả nếu bị trễ"},
      {en: "Action: prioritize, cut scope, communicate risks early", vi: "Hành động: ưu tiên, cắt giảm phạm vi, báo rủi ro sớm"},
      {en: "Result and what you would do differently", vi: "Kết quả và điều bạn sẽ làm khác đi"}
    ],
    answer: "On [project name], we had only [number] days to deliver [feature] before [event, for example a customer demo]. First, I talked with the product owner to separate must-have items from nice-to-have ones, and we agreed to move [item] to the next release. I flagged the main risk early, which was [risk], and I split the work into small pull requests so reviews were quick. We delivered the core scope on time, with no critical bugs. Looking back, I would raise the estimate earlier, because early communication is what made the difference.",
    shortAnswer: "We had [number] days to deliver [feature]. I agreed with the product owner on the must-haves, flagged the main risk early and split the work into small pull requests, and we delivered the core scope on time.",
    keyPhrases: ["must-have", "the core scope", "flagged the main risk early", "small pull requests", "on time"]
  },

  // ---------- PwC JAVA BACKEND ROUNDS (questions not covered above) ----------
  {
    category: 'JAVA_CORE',
    round: 1,
    question: "HashMap vs ConcurrentHashMap - what's the difference?",
    questionVi: "HashMap và ConcurrentHashMap khác nhau thế nào?",
    outline: [
      {en: "HashMap is not thread-safe and allows one null key", vi: "HashMap không thread-safe và cho phép một key null"},
      {en: "ConcurrentHashMap: CAS and per-bin locking, lock-free reads", vi: "ConcurrentHashMap: CAS và khóa theo từng bin, đọc không cần khóa"},
      {en: "No null keys or values; atomic compute and merge methods", vi: "Không cho key/value null; có compute và merge nguyên tử"}
    ],
    answer: "HashMap is not thread-safe. If two threads write at the same time, we can lose updates or corrupt the map, and its iterators are fail-fast. ConcurrentHashMap is designed for concurrent access. Since Java 8, it uses compare-and-swap for empty buckets and locks only a single bin when it needs to, so reads don't block and many writers can work in parallel. It doesn't allow null keys or values, because null would be ambiguous: you couldn't tell a missing key from a null value. It also gives atomic operations like computeIfAbsent and merge, which I use instead of a get-then-put check. I'd only use Collections.synchronizedMap when I need one lock around the whole map.",
    shortAnswer: "HashMap isn't thread-safe and allows a null key. ConcurrentHashMap is built for concurrent access: reads don't block, writes lock only a small part, it doesn't allow nulls, and it offers atomic methods like computeIfAbsent.",
    keyPhrases: ["not thread-safe", "compare-and-swap", "locks only a single bin", "null would be ambiguous", "atomic operations like computeIfAbsent"]
  },
  {
    category: 'JAVA_CORE',
    round: 1,
    question: "Why is String immutable in Java?",
    questionVi: "Vì sao String trong Java là bất biến?",
    outline: [
      {en: "String pool: literals are shared safely", vi: "String pool: các literal được dùng chung an toàn"},
      {en: "Security and thread safety: values can't change after checks", vi: "Bảo mật và thread-safe: giá trị không đổi sau khi đã kiểm tra"},
      {en: "Cached hash code makes it a good HashMap key", vi: "Hash code được cache nên là key tốt cho HashMap"}
    ],
    answer: "String is immutable for a few reasons. First, the string pool: many variables can point to the same literal, and that's only safe if nobody can change it. Second, security. Strings hold things like file paths, URLs and class names, and if they could change after a security check, someone could bypass that check. Third, immutable objects are thread-safe by design, so strings can be shared between threads without synchronization. And finally, String caches its hash code, which makes it a fast and reliable HashMap key. The trade-off is that every change creates a new object, so when I build a string in a loop, I use StringBuilder.",
    shortAnswer: "So it can be shared safely in the string pool, so values like paths and URLs can't change after a security check, and so it's thread-safe and can cache its hash code. The trade-off is that building strings in a loop needs StringBuilder.",
    keyPhrases: ["string pool", "bypass that check", "thread-safe by design", "caches its hash code", "StringBuilder"]
  },
  {
    category: 'JAVA_CORE',
    round: 2,
    question: "synchronized vs volatile",
    questionVi: "synchronized và volatile khác nhau thế nào?",
    outline: [
      {en: "volatile: visibility and ordering only, no atomicity", vi: "volatile: chỉ đảm bảo visibility và thứ tự, không nguyên tử"},
      {en: "synchronized: mutual exclusion plus visibility", vi: "synchronized: loại trừ lẫn nhau và cả visibility"},
      {en: "count++ needs synchronized or AtomicInteger", vi: "count++ cần synchronized hoặc AtomicInteger"}
    ],
    answer: "Both are about the Java memory model, but they solve different problems. volatile guarantees visibility: when one thread writes the variable, other threads see the latest value, and the write isn't reordered. But it doesn't make compound actions atomic, so count plus plus on a volatile field is still a race condition. synchronized gives mutual exclusion: only one thread can run the block for the same lock, and it also flushes changes when the lock is released. So I use volatile for a simple flag, like a stop signal that one thread writes and others read. For check-then-act or read-modify-write logic, I use synchronized, a ReentrantLock, or an atomic class like AtomicInteger.",
    shortAnswer: "volatile only guarantees visibility and ordering, so it's fine for a simple flag but not for count plus plus. synchronized gives mutual exclusion plus visibility, so I use it, a lock, or an atomic class for read-modify-write logic.",
    keyPhrases: ["guarantees visibility", "isn't reordered", "compound actions", "mutual exclusion", "read-modify-write"]
  },
  {
    category: 'JAVA_CORE',
    round: 2,
    question: "What is a deadlock, and how can you prevent it?",
    questionVi: "Deadlock là gì, và làm sao để phòng tránh?",
    outline: [
      {en: "Two threads each hold a lock and wait for the other's lock", vi: "Hai thread mỗi bên giữ một khóa và chờ khóa của bên kia"},
      {en: "Prevent: consistent lock ordering, tryLock with timeout", vi: "Phòng tránh: khóa theo thứ tự cố định, tryLock có timeout"},
      {en: "Detect: thread dump; same idea in database deadlocks", vi: "Phát hiện: thread dump; database deadlock cũng tương tự"}
    ],
    answer: "A deadlock happens when two or more threads wait for each other forever. For example, thread A holds lock one and waits for lock two, while thread B holds lock two and waits for lock one. To prevent it, the most practical rule is to always acquire locks in the same order, for example by account ID when transferring money between two accounts. I also keep lock scopes small, avoid calling external code while holding a lock, and use tryLock with a timeout when I can't guarantee the order. To detect one, I take a thread dump with jstack, which reports deadlocked threads. The same idea applies to databases: update rows in a consistent order and keep transactions short.",
    shortAnswer: "Two threads each hold a lock and wait forever for the other's lock. I prevent it by always acquiring locks in the same order, keeping lock scopes small and using tryLock with a timeout, and I find it with a thread dump.",
    keyPhrases: ["wait for each other forever", "acquire locks in the same order", "keep lock scopes small", "tryLock with a timeout", "thread dump"]
  },
  {
    category: 'JAVA_CORE',
    round: 2,
    question: "ExecutorService vs CompletableFuture",
    questionVi: "ExecutorService và CompletableFuture khác nhau thế nào?",
    outline: [
      {en: "ExecutorService manages a thread pool and runs tasks", vi: "ExecutorService quản lý thread pool và chạy task"},
      {en: "Future.get() blocks; CompletableFuture composes without blocking", vi: "Future.get() chặn luồng; CompletableFuture ghép các bước không chặn"},
      {en: "Pass your own executor; handle errors and timeouts", vi: "Truyền executor riêng; xử lý lỗi và timeout"}
    ],
    answer: "They work at different levels. ExecutorService is about execution: it manages a pool of threads, a queue, and the lifecycle, and when I submit a task I get a Future. But a plain Future is limited. I can only block on get, and I can't easily chain steps. CompletableFuture is about composition. I can chain steps with thenApply and thenCompose, run calls in parallel and join them with allOf, and handle errors with exceptionally or handle, plus timeouts with orTimeout. In practice I use both: I pass my own ExecutorService to supplyAsync, because the default common pool is shared and is meant for CPU work, not blocking I/O. With Java 21, a virtual-thread executor is often a good fit for that I/O.",
    shortAnswer: "ExecutorService runs tasks on a managed thread pool and gives a Future that I can only block on. CompletableFuture lets me chain, combine and handle errors without blocking, and I pass it my own executor instead of the common pool.",
    keyPhrases: ["it manages a pool of threads", "block on get", "chain steps", "join them with allOf", "the default common pool"]
  },
  {
    category: 'DATABASE',
    round: 4,
    question: "INNER JOIN vs LEFT JOIN",
    questionVi: "INNER JOIN và LEFT JOIN khác nhau thế nào?",
    outline: [
      {en: "INNER JOIN: only rows with a match on both sides", vi: "INNER JOIN: chỉ lấy các dòng khớp ở cả hai bảng"},
      {en: "LEFT JOIN: all left rows, NULLs when there is no match", vi: "LEFT JOIN: lấy mọi dòng bảng trái, NULL khi không khớp"},
      {en: "Trap: a WHERE on the right table turns it into an inner join", vi: "Bẫy: điều kiện WHERE trên bảng phải biến nó thành inner join"}
    ],
    answer: "An INNER JOIN returns only the rows that have a match in both tables. A LEFT JOIN returns every row from the left table, and when there's no match on the right, the right columns are NULL. For example, to list all customers with their orders, including customers who have never ordered, I use a LEFT JOIN. To find customers with no orders, I use a LEFT JOIN and filter where the order ID is NULL. One common mistake is putting a condition on the right table in the WHERE clause, because that removes the NULL rows and quietly turns it into an inner join. That condition belongs in the ON clause instead.",
    shortAnswer: "INNER JOIN returns only rows that match in both tables. LEFT JOIN returns every row from the left table, with NULLs when there's no match, and a condition on the right table belongs in the ON clause, not the WHERE.",
    keyPhrases: ["a match in both tables", "the right columns are NULL", "filter where the order ID is NULL", "quietly turns it into an inner join", "belongs in the ON clause"]
  },
  {
    category: 'DATABASE',
    round: 4,
    question: "Explain ACID properties.",
    questionVi: "Hãy giải thích các thuộc tính ACID.",
    outline: [
      {en: "Atomicity: all or nothing", vi: "Atomicity: hoặc tất cả, hoặc không gì cả"},
      {en: "Consistency: constraints stay valid", vi: "Consistency: các ràng buộc luôn hợp lệ"},
      {en: "Isolation: concurrent transactions don't interfere; Durability: committed data survives a crash", vi: "Isolation: giao dịch đồng thời không ảnh hưởng nhau; Durability: dữ liệu đã commit vẫn còn sau sự cố"}
    ],
    answer: "ACID describes what a reliable transaction guarantees. Atomicity means all or nothing: in a money transfer, the debit and the credit either both happen or neither does. Consistency means a transaction moves the database from one valid state to another, so constraints like foreign keys and unique keys always hold. Isolation means concurrent transactions don't see each other's half-finished work, and the isolation level controls how strict that is. Durability means that once a transaction is committed, it survives a crash, because the database writes it to a log on disk first. In Spring, I get these guarantees by wrapping the business operation in one @Transactional method.",
    shortAnswer: "Atomicity means all or nothing, consistency means constraints always hold, isolation means concurrent transactions don't see each other's half-finished work, and durability means committed data survives a crash.",
    keyPhrases: ["all or nothing", "from one valid state to another", "half-finished work", "survives a crash", "writes it to a log on disk"]
  },
  {
    category: 'DATABASE',
    round: 4,
    question: "How would you optimize a slow SQL query?",
    questionVi: "Bạn sẽ tối ưu một câu SQL chậm như thế nào?",
    outline: [
      {en: "Measure first: slow query log and EXPLAIN", vi: "Đo trước: slow query log và EXPLAIN"},
      {en: "Fix access: right index, no functions on indexed columns, select only needed columns", vi: "Sửa cách truy cập: đúng index, không bọc hàm quanh cột có index, chỉ lấy cột cần thiết"},
      {en: "Reduce work: pagination, rewrite, cache; verify with real data", vi: "Giảm khối lượng: phân trang, viết lại, cache; kiểm chứng trên dữ liệu thật"}
    ],
    answer: "First, I measure instead of guessing. I find the query in the slow query log or the APM tool, and I run EXPLAIN to see the plan: is it doing a full table scan, using the wrong index, or sorting a huge temporary result? The most common fix is an index that matches the WHERE and ORDER BY columns, often a composite index in the right column order. I also check that we don't wrap an indexed column in a function, select only the columns we need instead of SELECT star, and use keyset pagination instead of a big OFFSET. If the query is still heavy, I consider rewriting it, splitting it, or caching the result. Finally, I compare the plan and the timing again on production-sized data.",
    shortAnswer: "I measure first with the slow query log and EXPLAIN, then usually add or fix an index that matches the WHERE and ORDER BY, select only needed columns and use keyset pagination. Then I verify on production-sized data.",
    keyPhrases: ["measure instead of guessing", "run EXPLAIN", "full table scan", "composite index", "production-sized data"]
  },
  {
    category: 'SYSTEM_DESIGN',
    round: 5,
    question: "How would you implement Redis caching?",
    questionVi: "Bạn sẽ triển khai caching bằng Redis như thế nào?",
    outline: [
      {en: "Cache-aside with Spring Cache: @Cacheable, @CacheEvict", vi: "Cache-aside với Spring Cache: @Cacheable, @CacheEvict"},
      {en: "Key design, TTL per cache, JSON serialization", vi: "Thiết kế key, TTL cho từng cache, serialize bằng JSON"},
      {en: "Evict on write; stampede protection; Redis down must not break the API", vi: "Xóa cache khi ghi; chống stampede; Redis lỗi không được làm sập API"}
    ],
    answer: "In Spring Boot, I'd add the Redis starter and enable caching, then use the cache-aside pattern. A read method gets @Cacheable, so the first call loads from the database and stores the result in Redis, and later calls read from Redis. Write methods use @CacheEvict, so the next read loads fresh data. I design clear keys, like product colon ID, give each cache its own TTL, and serialize values as JSON instead of Java serialization. Only data that is read often and changes rarely goes in the cache, and never sensitive data without a reason. I also protect against a cache stampede with TTL jitter, and I make sure that if Redis is down, the request falls back to the database instead of failing. Then I monitor the hit rate and memory.",
    shortAnswer: "Cache-aside with Spring Cache: @Cacheable on reads, @CacheEvict on writes, clear keys and a TTL per cache. I protect against stampedes with TTL jitter and fall back to the database if Redis is down.",
    keyPhrases: ["cache-aside pattern", "@Cacheable", "@CacheEvict", "its own TTL", "falls back to the database"]
  },
  {
    category: 'SYSTEM_DESIGN',
    round: 5,
    question: "How would you prevent duplicate API requests?",
    questionVi: "Bạn sẽ ngăn chặn các request API bị trùng lặp như thế nào?",
    outline: [
      {en: "Client: disable the button, debounce, send an Idempotency-Key", vi: "Client: khóa nút, debounce, gửi Idempotency-Key"},
      {en: "Server: unique constraint on the key or a business key; replay the stored response", vi: "Server: ràng buộc unique trên key hoặc khóa nghiệp vụ; trả lại response đã lưu"},
      {en: "Messages: idempotent consumers with a processed-ID table", vi: "Message: consumer idempotent với bảng lưu ID đã xử lý"}
    ],
    answer: "I handle it on both sides. On the client, I disable the submit button while the request is running, so a double click doesn't send twice. But the client can't be trusted alone, because clients and proxies can retry after a timeout too. So for any request that creates something, the client sends an Idempotency-Key header. On the server, I store that key with a unique constraint, in the same transaction as the business change. If the same key comes again, I return the stored result instead of doing the work twice, and the unique constraint also stops two concurrent duplicates. Where possible, I add a natural unique key too, like one payment per invoice. For queue consumers, I record processed message IDs, because messages can be delivered more than once.",
    shortAnswer: "On the client, I disable the button during the request. On the server, the client sends an Idempotency-Key, and I store it with a unique constraint in the same transaction, so a repeat returns the stored result instead of doing the work twice.",
    keyPhrases: ["double click", "Idempotency-Key header", "same transaction as the business change", "return the stored result", "delivered more than once"]
  },
  {
    category: 'SYSTEM_DESIGN',
    round: 5,
    question: "How would you debug a slow production API?",
    questionVi: "Bạn sẽ debug một API chạy chậm trên production như thế nào?",
    outline: [
      {en: "Scope it: which endpoint, since when, all users or some; check recent deploys", vi: "Khoanh vùng: endpoint nào, từ khi nào, tất cả hay một số user; kiểm tra lần deploy gần nhất"},
      {en: "Find the time: tracing, metrics, slow query log, thread dump", vi: "Tìm chỗ tốn thời gian: tracing, metrics, slow query log, thread dump"},
      {en: "Mitigate first, then fix the root cause and add an alert", vi: "Giảm thiểu trước, rồi sửa nguyên nhân gốc và thêm cảnh báo"}
    ],
    answer: "First, I scope the problem with data: which endpoint, since when, for all users or only some, and whether it lines up with a deployment or a traffic spike. Then I look at the p95 and p99 latency, not the average. Next, I find where the time goes. Distributed tracing shows whether it's our code, the database, or a downstream service. From there I check the slow query log, connection pool usage, GC pauses, and a thread dump if threads are stuck waiting. Common causes are a missing index, an N+1 query, an exhausted connection pool, or a slow third-party call without a timeout. If users are affected, I mitigate first, for example by rolling back or scaling out. Then I fix the root cause, test it under load, and add an alert so we catch it earlier next time.",
    shortAnswer: "I scope it with metrics, looking at p95 and p99 and recent deployments, then use tracing to see whether the time is in our code, the database or a downstream call. I mitigate first if users are affected, then fix the root cause and add an alert.",
    keyPhrases: ["scope the problem with data", "p95 and p99 latency", "where the time goes", "connection pool", "mitigate first"]
  },
  {
    category: 'PROJECT',
    round: 6,
    question: "Why do you want to join PwC?",
    questionVi: "Vì sao bạn muốn gia nhập PwC?",
    outline: [
      {en: "The company: global reach, trusted brand, many industries", vi: "Công ty: quy mô toàn cầu, thương hiệu uy tín, nhiều ngành"},
      {en: "The role: large, regulated systems where quality matters", vi: "Vị trí: hệ thống lớn, nhiều quy định, đề cao chất lượng"},
      {en: "You: what you bring and how you want to grow", vi: "Bản thân: bạn mang lại gì và muốn phát triển ra sao"}
    ],
    answer: "There are three main reasons. First, PwC works with clients in many industries, like banking, insurance and the public sector, so I'd work on large, business-critical systems and learn a lot about different domains. Second, those systems need security, reliability and clean audit trails, and that matches my experience. In my current role, I build [type of system, for example financial APIs with Spring Boot], where correctness and data integrity really matter. Third, your values, like acting with integrity and working together, match how I like to work, and I value the culture of learning, with training, certifications and senior people to learn from. I'd like to grow into a role where I [goal, for example lead the technical design of a module], and I think PwC is the right place for that.",
    shortAnswer: "I want to work on large, business-critical systems for clients in many industries, where security and reliability really matter, which matches my experience. I also value the culture of learning, and I see it as the right place to grow into [goal].",
    keyPhrases: ["business-critical systems", "audit trails", "data integrity", "culture of learning", "the right place for that"]
  },
  {
    category: 'PROJECT',
    round: 6,
    question: "Explain a technical decision you made and its trade-offs",
    questionVi: "Hãy trình bày một quyết định kỹ thuật bạn đã đưa ra và các đánh đổi của nó",
    outline: [
      {en: "Context: the problem and the constraints", vi: "Bối cảnh: vấn đề và các ràng buộc"},
      {en: "Options you compared and why you chose one", vi: "Các phương án đã so sánh và lý do chọn"},
      {en: "Trade-off you accepted and the result", vi: "Đánh đổi bạn chấp nhận và kết quả"}
    ],
    answer: "On [project name], we had to decide how to [problem, for example send notifications after a payment]. One option was to call the notification service directly inside the request. The other was to publish an event to a message queue and process it asynchronously. The direct call was simpler, but if the notification service was slow or down, the payment request would also be slow or fail. So we chose the queue. The trade-off was more complexity: we had to make the consumer idempotent, handle retries and a dead-letter queue, and accept that notifications arrive a few seconds later. In the end, [result, for example payment latency dropped and we had no failed payments caused by notifications]. If a lost or late notification didn't matter, I would choose the simpler direct call.",
    shortAnswer: "On [project], we chose [option] over [alternative] because [main reason]. The trade-off was [cost], which we accepted and handled by [mitigation], and the result was [outcome].",
    keyPhrases: ["we had to decide", "process it asynchronously", "the trade-off was", "dead-letter queue", "I would choose the simpler"]
  },
  // ---------- MORE JAVA BACKEND TOPICS ----------
  {
    category: 'JAVA_CORE',
    question: "Which features from Java 17 to 21 do you use most?",
    questionVi: "Bạn hay dùng những tính năng nào từ Java 17 đến 21?",
    outline: [
      {en: "Records for immutable data carriers", vi: "Record cho các lớp chứa dữ liệu bất biến"},
      {en: "Sealed classes with pattern matching for switch", vi: "Sealed class kết hợp pattern matching cho switch"},
      {en: "Text blocks, virtual threads, sequenced collections", vi: "Text block, virtual thread, sequenced collection"}
    ],
    answer: "The one I use every day is records. They're perfect for DTOs and value objects, because equals, hashCode and toString are generated and the fields are final. I also like sealed interfaces together with pattern matching for switch. For example, a payment result can be Success, Declined or Failed, and the compiler checks that my switch handles every case. Text blocks make SQL and JSON in tests much easier to read. From Java 21, virtual threads simplify I/O-heavy code, and sequenced collections finally give us getFirst and getLast. I adopt these features step by step, together with the team's coding guidelines.",
    keyPhrases: ["records", "value objects", "sealed interfaces", "pattern matching for switch", "the compiler checks"]
  },
  {
    category: 'JAVA_CORE',
    question: "How do Java Streams work, and when would you avoid them?",
    questionVi: "Java Stream hoạt động thế nào, và khi nào bạn tránh dùng?",
    outline: [
      {en: "Source, lazy intermediate operations, one terminal operation", vi: "Nguồn, các thao tác trung gian lười, một thao tác kết thúc"},
      {en: "Declarative and readable for transformations", vi: "Viết theo kiểu khai báo, dễ đọc cho việc biến đổi dữ liệu"},
      {en: "Avoid for side effects, complex control flow, or blind parallel()", vi: "Tránh khi có side effect, luồng điều khiển phức tạp, hoặc parallel() tùy tiện"}
    ],
    answer: "A stream has a source, a chain of intermediate operations like filter and map, and one terminal operation like collect or sum. Intermediate operations are lazy: nothing runs until the terminal operation, and elements flow through the pipeline one by one, so short-circuiting operations like findFirst can stop early. I like streams for transformations because the code says what we want, not how to loop. But I avoid them when the logic needs complex control flow, checked exceptions, or side effects, because a plain loop is clearer. I'm also careful with parallel streams: they use the common pool and only help for large, CPU-bound work without shared state.",
    keyPhrases: ["intermediate operations", "terminal operation", "lazy", "short-circuiting", "a plain loop is clearer"]
  },
  {
    category: 'JAVA_CORE',
    question: "ArrayList vs LinkedList - which one do you choose and why?",
    questionVi: "ArrayList và LinkedList - bạn chọn cái nào và vì sao?",
    outline: [
      {en: "ArrayList: array-backed, fast random access, cache-friendly", vi: "ArrayList: dựa trên mảng, truy cập ngẫu nhiên nhanh, thân thiện với cache CPU"},
      {en: "LinkedList: nodes, fast insert only with an iterator at the position", vi: "LinkedList: các node, chèn nhanh chỉ khi đã có iterator ở vị trí đó"},
      {en: "In practice ArrayList; ArrayDeque for queues", vi: "Thực tế dùng ArrayList; dùng ArrayDeque cho hàng đợi"}
    ],
    answer: "ArrayList is backed by an array, so get by index is constant time and iteration is very fast, because the data sits together in memory. Adding at the end is amortized constant time. LinkedList stores separate nodes with pointers. In theory it inserts in the middle in constant time, but you first have to walk to that position, which is linear, and every node adds memory overhead and cache misses. So in real projects I almost always choose ArrayList. If I need a queue or a stack, I use ArrayDeque instead of LinkedList.",
    keyPhrases: ["backed by an array", "constant time", "amortized", "cache misses", "ArrayDeque"]
  },
  {
    category: 'SPRING',
    question: "How do you configure a Spring Boot application for different environments?",
    questionVi: "Bạn cấu hình ứng dụng Spring Boot cho nhiều môi trường như thế nào?",
    outline: [
      {en: "Profiles and application-{profile}.yml", vi: "Profile và application-{profile}.yml"},
      {en: "Environment variables override files; secrets never in Git", vi: "Biến môi trường ghi đè file; secret không bao giờ nằm trong Git"},
      {en: "@ConfigurationProperties with validation", vi: "@ConfigurationProperties kèm validation"}
    ],
    answer: "I keep shared defaults in application.yml and environment-specific values in profile files, like application-dev or application-prod, activated with spring.profiles.active. Spring Boot has a clear order of property sources, so environment variables and command-line arguments override the files. That's how we inject database URLs and secrets in production, from the container environment or a secret manager, never from Git. In the code, I bind related settings to a @ConfigurationProperties class with validation annotations, so the app fails fast at startup if a required value is missing, instead of failing later at runtime.",
    keyPhrases: ["profile files", "property sources", "override the files", "never from Git", "fails fast at startup"]
  },
  {
    category: 'SPRING',
    question: "How do you test a Spring Boot application?",
    questionVi: "Bạn kiểm thử một ứng dụng Spring Boot như thế nào?",
    outline: [
      {en: "Testing pyramid: many unit tests, fewer integration tests", vi: "Kim tự tháp kiểm thử: nhiều unit test, ít integration test hơn"},
      {en: "Unit: JUnit 5 + Mockito; slices: @WebMvcTest, @DataJpaTest", vi: "Unit: JUnit 5 + Mockito; test lát cắt: @WebMvcTest, @DataJpaTest"},
      {en: "Integration with Testcontainers against a real database", vi: "Integration với Testcontainers trên database thật"}
    ],
    answer: "I follow the testing pyramid. Most tests are fast unit tests with JUnit 5 and Mockito, focused on business rules in the service layer. For the web layer, I use @WebMvcTest with MockMvc to check request validation, status codes and the JSON shape. For the data layer, I prefer Testcontainers with the same database engine as production, like MySQL, because an in-memory database can hide real SQL and locking differences. I keep only a few full @SpringBootTest tests for the critical flows, because they're slower. And in a bug fix, I always write a test that reproduces the bug first.",
    keyPhrases: ["testing pyramid", "Mockito", "@WebMvcTest", "Testcontainers", "reproduces the bug first"]
  },
  {
    category: 'SPRING',
    question: "What is Spring AOP, and where have you used it?",
    questionVi: "Spring AOP là gì, và bạn đã dùng nó ở đâu?",
    outline: [
      {en: "Cross-cutting concerns: logging, security, transactions, metrics", vi: "Mối quan tâm cắt ngang: logging, bảo mật, transaction, metrics"},
      {en: "Proxies, advice, pointcuts", vi: "Proxy, advice, pointcut"},
      {en: "Limits: self-invocation and final or private methods", vi: "Giới hạn: tự gọi nội bộ và method final hoặc private"}
    ],
    answer: "AOP lets us handle cross-cutting concerns, like logging, security, transactions and metrics, in one place instead of repeating them in every method. Spring creates a proxy around the bean. A pointcut decides which methods are matched, and the advice runs before, after, or around them. In fact, @Transactional and @PreAuthorize are built on this. I've used a custom @Around aspect to measure the execution time of slow service methods and send it to our metrics. The main limitation is that it only works through the proxy, so self-invocation, private methods and final methods are not intercepted.",
    keyPhrases: ["cross-cutting concerns", "creates a proxy", "pointcut", "advice", "self-invocation"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "Monolith or microservices - how do you decide?",
    questionVi: "Monolith hay microservices - bạn quyết định thế nào?",
    outline: [
      {en: "Start with a well-structured modular monolith", vi: "Bắt đầu với một modular monolith có cấu trúc tốt"},
      {en: "Split when teams, scaling or release cycles really differ", vi: "Tách khi các nhóm, nhu cầu scale hoặc chu kỳ release thật sự khác nhau"},
      {en: "Cost: network failures, distributed data, operations", vi: "Chi phí: lỗi mạng, dữ liệu phân tán, vận hành"}
    ],
    answer: "I don't think microservices should be the default. For a new product with one team, I'd start with a modular monolith: one deployable, but with clear module boundaries, separate packages per business capability, and no shortcuts across modules. It's simpler to develop, test and deploy. I'd split out a service when there's a real reason: different teams need to release independently, one part needs to scale very differently, or it needs different technology. Microservices bring real costs: network failures, distributed transactions, eventual consistency, and much more monitoring and DevOps work. Good module boundaries make that split much easier later.",
    keyPhrases: ["modular monolith", "clear module boundaries", "release independently", "eventual consistency", "much easier later"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What is a circuit breaker, and why do you need it?",
    questionVi: "Circuit breaker là gì, và vì sao cần nó?",
    outline: [
      {en: "Stops calling a failing dependency: closed, open, half-open", vi: "Ngừng gọi dependency đang lỗi: closed, open, half-open"},
      {en: "Prevents cascading failures and thread exhaustion", vi: "Ngăn lỗi lan dây chuyền và cạn thread"},
      {en: "Combine with timeouts, retries with backoff, fallback", vi: "Kết hợp timeout, retry có backoff, fallback"}
    ],
    answer: "When a downstream service is slow or down, every call waits and fails, threads pile up, and the failure spreads to our service. A circuit breaker prevents that cascading failure. It starts closed and lets calls through. When the error rate passes a threshold, it opens and fails fast without calling the dependency. After a wait time, it goes half-open and lets a few test calls through, and if they succeed, it closes again. In Spring, I use Resilience4j for this. I always combine it with a timeout, a limited retry with exponential backoff, and a fallback, like cached data or a friendly error.",
    keyPhrases: ["cascading failure", "fails fast", "half-open", "Resilience4j", "exponential backoff"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "Kafka vs RabbitMQ - when would you use each?",
    questionVi: "Kafka và RabbitMQ - khi nào dùng cái nào?",
    outline: [
      {en: "RabbitMQ: message broker, routing, task queues, ack per message", vi: "RabbitMQ: message broker, định tuyến, hàng đợi công việc, ack từng message"},
      {en: "Kafka: distributed log, high throughput, replay, ordering per partition", vi: "Kafka: log phân tán, thông lượng cao, đọc lại được, thứ tự theo partition"},
      {en: "Both are at-least-once: consumers must be idempotent", vi: "Cả hai là at-least-once: consumer phải idempotent"}
    ],
    answer: "RabbitMQ is a classic message broker. It's great for task queues and flexible routing with exchanges, and a message is removed after the consumer acknowledges it. I'd use it for background jobs, like sending emails or processing uploads. Kafka is a distributed, append-only log. Messages stay for a retention period, so many consumer groups can read the same events and even replay them, and it handles very high throughput. Ordering is guaranteed within a partition, so I choose the key carefully, for example the account ID. I'd use Kafka for event streaming and analytics. With both, delivery is usually at least once, so consumers must be idempotent.",
    keyPhrases: ["task queues", "acknowledges it", "append-only log", "replay them", "within a partition"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How do you keep data consistent across microservices?",
    questionVi: "Bạn giữ dữ liệu nhất quán giữa các microservice như thế nào?",
    outline: [
      {en: "No distributed transactions: database per service", vi: "Không dùng transaction phân tán: mỗi service một database"},
      {en: "Saga: local transactions plus compensating actions", vi: "Saga: các transaction cục bộ cùng hành động bù trừ"},
      {en: "Transactional outbox so events are never lost", vi: "Transactional outbox để không bao giờ mất event"}
    ],
    answer: "Each service owns its own database, so we can't wrap everything in one ACID transaction, and two-phase commit is usually too slow and fragile. Instead, I use the saga pattern: a business process is a sequence of local transactions, and if one step fails, we run compensating actions, like refunding a payment when the order can't be shipped. To publish events reliably, I use the transactional outbox pattern. The service writes the business change and the event into an outbox table in the same local transaction, and a separate process publishes it to the broker. That way we never update the database and lose the event. The trade-off is eventual consistency, so the UI must handle a pending state.",
    keyPhrases: ["owns its own database", "saga pattern", "compensating actions", "transactional outbox", "eventual consistency"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What makes a good REST API design?",
    questionVi: "Thế nào là một thiết kế REST API tốt?",
    outline: [
      {en: "Resource nouns, HTTP methods, correct status codes", vi: "Danh từ cho resource, đúng HTTP method, đúng status code"},
      {en: "Consistent errors, pagination, filtering", vi: "Lỗi nhất quán, phân trang, lọc dữ liệu"},
      {en: "Versioning, idempotency, security and documentation", vi: "Versioning, idempotency, bảo mật và tài liệu"}
    ],
    answer: "First, I model resources as nouns, like slash orders and slash orders slash ID, and let the HTTP method express the action. GET reads, POST creates, PUT replaces, PATCH updates partially, and DELETE removes. I return correct status codes: 201 for created, 400 for validation errors, 401 and 403 for authentication and authorization, 404 for not found, and 409 for conflicts like a version mismatch. Errors have one consistent JSON shape with a stable error code and a trace ID, but never stack traces. Lists are paginated and filterable. I version the API in the path, like v1, make retries safe with idempotency keys, and document everything with OpenAPI.",
    keyPhrases: ["resources as nouns", "correct status codes", "consistent JSON shape", "paginated", "OpenAPI"]
  },
  {
    category: 'SPRING',
    question: "How do you protect a web application against common security attacks?",
    questionVi: "Bạn bảo vệ ứng dụng web trước các kiểu tấn công phổ biến như thế nào?",
    outline: [
      {en: "Injection: parameterized queries, input validation", vi: "Injection: query có tham số, kiểm tra dữ liệu đầu vào"},
      {en: "Access control: check ownership on the server for every request", vi: "Kiểm soát truy cập: kiểm tra quyền sở hữu ở server cho mọi request"},
      {en: "XSS, CSRF, CORS, secrets, dependency scanning", vi: "XSS, CSRF, CORS, secret, quét thư viện phụ thuộc"}
    ],
    answer: "I think about the OWASP Top 10. For injection, I always use parameterized queries or JPA, never string concatenation, and I validate input at the API boundary. Broken access control is very common, so the server checks that the current user actually owns the resource on every request, not just that they're logged in. For XSS, Angular escapes output by default, and we avoid bypassing it. For CSRF, if we use cookies, we need SameSite and a CSRF token. CORS is configured with explicit origins, not a wildcard. Passwords are hashed with BCrypt, secrets live in environment variables, we never log tokens, and we scan dependencies for known vulnerabilities.",
    keyPhrases: ["OWASP Top 10", "parameterized queries", "broken access control", "owns the resource", "never log tokens"]
  },
  // ---------- BEHAVIORAL / HR ----------
  {
    category: 'PROJECT',
    question: "What are your strengths and weaknesses?",
    questionVi: "Điểm mạnh và điểm yếu của bạn là gì?",
    outline: [
      {en: "One or two strengths with a real example", vi: "Một hoặc hai điểm mạnh kèm ví dụ thật"},
      {en: "A real weakness, not a hidden strength", vi: "Một điểm yếu thật, không phải điểm mạnh trá hình"},
      {en: "What you are doing to improve it", vi: "Bạn đang làm gì để cải thiện"}
    ],
    answer: "One of my strengths is debugging difficult problems. For example, on [project], I traced a memory leak to a cache that never expired, and I fixed it after other people had been stuck for days. I'm also reliable with deadlines, because I break work down and raise risks early. As for a weakness, I used to say yes to too many requests and then struggle to focus. Now I check priorities with my lead before I accept new work, and I block focus time in my calendar. It's much better, but I still keep an eye on it.",
    keyPhrases: ["one of my strengths is", "traced a memory leak", "raise risks early", "as for a weakness", "I still keep an eye on it"]
  },
  {
    category: 'PROJECT',
    question: "Why are you leaving your current job?",
    questionVi: "Vì sao bạn muốn rời công việc hiện tại?",
    outline: [
      {en: "Stay positive; never criticize the current employer", vi: "Giữ thái độ tích cực; không chê công ty hiện tại"},
      {en: "Focus on growth you are looking for", vi: "Tập trung vào sự phát triển bạn đang tìm kiếm"},
      {en: "Connect it to this role", vi: "Liên hệ với vị trí đang ứng tuyển"}
    ],
    answer: "I've learned a lot at my current company, especially about building reliable Spring Boot services and working closely with the business team. After [number] years, I feel I've grown as much as I can in that role, and I'm looking for bigger technical challenges, like larger systems, more users and more complex integrations. I'm also keen to work in an international team and use English every day. This role offers exactly that, so it feels like the right next step for me.",
    keyPhrases: ["I've learned a lot", "grown as much as I can", "bigger technical challenges", "international team", "the right next step"]
  },
  {
    category: 'PROJECT',
    question: "Where do you see yourself in five years?",
    questionVi: "Bạn thấy mình ở đâu sau năm năm nữa?",
    outline: [
      {en: "A realistic technical path", vi: "Một lộ trình kỹ thuật thực tế"},
      {en: "Skills you want to build", vi: "Kỹ năng bạn muốn phát triển"},
      {en: "How it benefits the company", vi: "Điều đó có lợi gì cho công ty"}
    ],
    answer: "In five years, I see myself as a senior or lead backend engineer, someone the team trusts with the design of important parts of the system. To get there, I want to go deeper into system design, cloud architecture and performance, and I'd like to mentor junior developers, because explaining things also makes me better. I'm not in a rush for a title. What matters to me is having a bigger impact on the product, and I hope to grow that way inside this company.",
    keyPhrases: ["senior or lead backend engineer", "the team trusts", "go deeper into", "mentor junior developers", "a bigger impact"]
  },
  {
    category: 'PROJECT',
    question: "What are your salary expectations?",
    questionVi: "Mức lương mong muốn của bạn là bao nhiêu?",
    outline: [
      {en: "Research the market range first", vi: "Tìm hiểu mức lương thị trường trước"},
      {en: "Give a range, anchored on the higher side", vi: "Đưa ra một khoảng, neo ở mức cao"},
      {en: "Stay open to the full package", vi: "Cởi mở với toàn bộ gói đãi ngộ"}
    ],
    answer: "Based on my research for this role and my [number] years of experience with Java and Spring Boot, I'm looking for something in the range of [amount] to [amount] per month, gross. That said, I'm open to discussing it, because I also care about the whole package, like the bonus, insurance, training budget and growth opportunities. Could you share the range you have in mind for this position?",
    keyPhrases: ["based on my research", "in the range of", "gross", "the whole package", "the range you have in mind"]
  },
  {
    category: 'PROJECT',
    question: "Do you have any questions for us?",
    questionVi: "Bạn có câu hỏi nào dành cho chúng tôi không?",
    outline: [
      {en: "Always say yes; prepare two or three questions", vi: "Luôn trả lời có; chuẩn bị hai đến ba câu hỏi"},
      {en: "Ask about the team, the work and success in the role", vi: "Hỏi về nhóm, công việc và thế nào là thành công ở vị trí này"},
      {en: "Ask about next steps", vi: "Hỏi về các bước tiếp theo"}
    ],
    answer: "Yes, thank you. I have a few questions. First, what does a typical day look like for a backend developer on this team? Second, what would success look like in the first three to six months in this role? I'd also like to know about the tech stack and how you handle code reviews and releases. And finally, what are the next steps in the interview process?",
    keyPhrases: ["a typical day", "what would success look like", "the first three to six months", "code reviews and releases", "the next steps"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you had to learn a new technology quickly.",
    questionVi: "Hãy kể về một lần bạn phải học nhanh một công nghệ mới.",
    outline: [
      {en: "Situation: why you needed it and the deadline", vi: "Bối cảnh: vì sao cần và hạn chót"},
      {en: "Action: how you learned (docs, small prototype, ask experts)", vi: "Hành động: cách bạn học (tài liệu, prototype nhỏ, hỏi người giỏi)"},
      {en: "Result and how you shared it", vi: "Kết quả và cách bạn chia sẻ lại"}
    ],
    answer: "On [project], we decided to use [technology, for example Kafka], and nobody on the team had used it before. I had about two weeks before we started the feature. I read the official documentation and built a small prototype first, so I could learn the basics, like topics, partitions and consumer groups, by actually running them. I also booked a short call with an engineer from another team who had real experience, to ask about the common mistakes. We shipped the feature on time, and afterwards I wrote a short guide and ran a knowledge-sharing session for the team.",
    keyPhrases: ["nobody on the team had used it", "built a small prototype", "by actually running them", "the common mistakes", "knowledge-sharing session"]
  },

  // ---------- DEVOPS / OBSERVABILITY / DESIGN ----------
  {
    category: 'SYSTEM_DESIGN',
    question: "How do Docker and Kubernetes help you run backend services?",
    questionVi: "Docker và Kubernetes giúp bạn vận hành service backend như thế nào?",
    outline: [
      {en: "Docker: same image from laptop to production", vi: "Docker: cùng một image từ máy dev tới production"},
      {en: "Kubernetes: scheduling, scaling, self-healing, rolling updates", vi: "Kubernetes: lập lịch, scale, tự phục hồi, cập nhật cuốn chiếu"},
      {en: "Health probes, resource limits, config and secrets", vi: "Health probe, giới hạn tài nguyên, config và secret"}
    ],
    answer: "Docker packages the application with its runtime into an image, so the same artifact runs on my laptop, in CI and in production, and we avoid the it-works-on-my-machine problem. Kubernetes runs those containers at scale. It schedules pods on nodes, restarts them when they crash, scales them based on load, and does rolling updates with no downtime. For a Spring Boot service, I configure liveness and readiness probes using Actuator, set CPU and memory requests and limits so the JVM behaves well, and inject configuration and secrets through ConfigMaps and Secrets, not into the image.",
    keyPhrases: ["packages the application", "the same artifact", "restarts them when they crash", "rolling updates", "readiness probes"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How do you monitor a service in production?",
    questionVi: "Bạn giám sát một service trên production như thế nào?",
    outline: [
      {en: "Three pillars: logs, metrics, traces", vi: "Ba trụ cột: log, metrics, trace"},
      {en: "Golden signals: latency, traffic, errors, saturation", vi: "Tín hiệu vàng: độ trễ, lưu lượng, lỗi, mức bão hòa"},
      {en: "Alerts on user impact; correlate with a trace ID", vi: "Cảnh báo theo ảnh hưởng tới người dùng; liên kết bằng trace ID"}
    ],
    answer: "I think in terms of logs, metrics and traces. Logs are structured JSON with a trace ID, so we can follow one request across services, and we never log tokens or personal data. Metrics come from Micrometer and Actuator into Prometheus and Grafana, and I focus on the golden signals: latency, traffic, errors and saturation, like the connection pool and JVM memory. Distributed tracing with OpenTelemetry shows where time is spent. Alerts should be based on user impact, like a high error rate or p99 latency over the target, not on every small warning, otherwise people start to ignore them.",
    keyPhrases: ["logs, metrics and traces", "trace ID", "golden signals", "OpenTelemetry", "start to ignore them"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "Explain the CAP theorem with an example.",
    questionVi: "Hãy giải thích định lý CAP kèm một ví dụ.",
    outline: [
      {en: "Consistency, Availability, Partition tolerance", vi: "Tính nhất quán, tính sẵn sàng, chịu được phân vùng mạng"},
      {en: "Partitions happen, so the real choice is C or A during one", vi: "Phân vùng mạng luôn có thể xảy ra, nên lựa chọn thật là C hay A khi nó xảy ra"},
      {en: "Example: bank balance vs social feed", vi: "Ví dụ: số dư ngân hàng và bảng tin mạng xã hội"}
    ],
    answer: "The CAP theorem says that in a distributed system, when there's a network partition, you have to choose between consistency and availability. Consistency means every read sees the latest write. Availability means every request gets a response, even if the data might be old. Because network partitions will happen, the real question is what the system should do during one. For a bank balance or a payment, I'd choose consistency: it's better to reject a request than to show a wrong balance or allow a double spend. For a social media feed or product reviews, availability is better, because slightly old data is acceptable.",
    keyPhrases: ["network partition", "every read sees the latest write", "every request gets a response", "reject a request", "slightly old data is acceptable"]
  },
  {
    category: 'DATABASE',
    question: "How would you scale a database that is getting too big?",
    questionVi: "Bạn sẽ mở rộng một database đang quá lớn như thế nào?",
    outline: [
      {en: "Optimize first: indexes, queries, archiving old data", vi: "Tối ưu trước: index, query, lưu trữ dữ liệu cũ"},
      {en: "Read replicas and caching for read-heavy load", vi: "Read replica và cache cho tải đọc nhiều"},
      {en: "Partitioning, then sharding as a last resort", vi: "Partition, rồi sharding là phương án cuối"}
    ],
    answer: "I'd go step by step, because each step adds complexity. First, optimize: fix slow queries, add the right indexes, and archive or delete old data that nobody reads. Second, scale vertically with a bigger instance, which is simple and often enough. If reads are the problem, I'd add read replicas and a cache, keeping in mind that replicas can lag a little. For very large tables, I'd use partitioning, for example by month, so queries only touch recent partitions. Sharding, where data is split across several databases by a key like the customer ID, is the last resort, because cross-shard queries, transactions and rebalancing become much harder.",
    keyPhrases: ["step by step", "archive or delete old data", "read replicas", "partitioning", "the last resort"]
  },
  {
    category: 'JAVA_CORE',
    question: "Can you explain the SOLID principles?",
    questionVi: "Bạn có thể giải thích các nguyên tắc SOLID không?",
    outline: [
      {en: "S: one reason to change; O: extend without modifying", vi: "S: một lý do để thay đổi; O: mở rộng mà không sửa"},
      {en: "L: subtypes must be substitutable; I: small interfaces", vi: "L: lớp con thay thế được lớp cha; I: interface nhỏ"},
      {en: "D: depend on abstractions, which Spring DI supports", vi: "D: phụ thuộc vào trừu tượng, Spring DI hỗ trợ điều này"}
    ],
    answer: "SOLID is a set of five design principles. Single responsibility means a class should have one reason to change, so I don't mix business rules, persistence and HTTP in one class. Open-closed means we can add new behavior without modifying existing code, for example a new payment method as a new strategy class. Liskov substitution means a subclass must work anywhere the parent works, without surprises. Interface segregation means small, focused interfaces instead of one big one. And dependency inversion means high-level code depends on abstractions, not concrete classes, which Spring supports through dependency injection. I use them as guidelines, not strict rules, because too many abstractions also make code hard to read.",
    keyPhrases: ["one reason to change", "without modifying existing code", "without surprises", "depends on abstractions", "guidelines, not strict rules"]
  },
  {
    category: 'JAVA_CORE',
    question: "Which design patterns have you used in real projects?",
    questionVi: "Bạn đã dùng những design pattern nào trong dự án thật?",
    outline: [
      {en: "Strategy for interchangeable rules", vi: "Strategy cho các quy tắc có thể thay thế nhau"},
      {en: "Builder for complex objects; Factory for creation logic", vi: "Builder cho object phức tạp; Factory cho logic khởi tạo"},
      {en: "Patterns Spring already uses: Proxy, Template Method, Observer", vi: "Pattern Spring đã dùng sẵn: Proxy, Template Method, Observer"}
    ],
    answer: "The one I use most is Strategy. For example, we calculated fees differently for each card type, so each rule was a separate class behind one interface, and Spring injected all of them into a map. Adding a new card type meant adding one class, not editing a big if-else. I use Builder for objects with many optional fields, often through Lombok or records with static factory methods. Spring itself is full of patterns: proxies for @Transactional, template methods in JdbcTemplate, and the observer pattern with application events, which I've used to send notifications after an order is saved. I try not to add a pattern unless it removes real duplication or complexity.",
    keyPhrases: ["the one I use most", "behind one interface", "a big if-else", "Spring itself is full of patterns", "removes real duplication"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a file upload service?",
    questionVi: "Bạn sẽ thiết kế một dịch vụ upload file như thế nào?",
    outline: [
      {en: "Upload directly to object storage with a pre-signed URL", vi: "Upload thẳng lên object storage bằng pre-signed URL"},
      {en: "Validate type and size; scan; private bucket", vi: "Kiểm tra loại và dung lượng; quét virus; bucket riêng tư"},
      {en: "Metadata in the database; async processing via a queue", vi: "Metadata lưu trong database; xử lý bất đồng bộ qua hàng đợi"}
    ],
    answer: "I wouldn't stream large files through the application servers. Instead, the client asks our API for a pre-signed URL and uploads directly to object storage, like S3 or Cloudflare R2. Before issuing the URL, the API checks the user's permission, the file type and the maximum size. The bucket is private, and downloads also go through short-lived signed URLs, after an ownership check. We store the metadata, like the owner, size, content type and status, in the database. After the upload completes, an event goes to a queue, and workers do the slow work, like virus scanning, thumbnails or AI extraction, with retries. For very large files, I'd use multipart upload so it can resume.",
    keyPhrases: ["pre-signed URL", "directly to object storage", "the bucket is private", "short-lived signed URLs", "multipart upload"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a chat application?",
    questionVi: "Bạn sẽ thiết kế một ứng dụng chat như thế nào?",
    outline: [
      {en: "WebSocket connections through gateway servers", vi: "Kết nối WebSocket qua các gateway server"},
      {en: "Messages stored with a per-conversation sequence; pub/sub between servers", vi: "Tin nhắn lưu kèm số thứ tự theo hội thoại; pub/sub giữa các server"},
      {en: "Offline users get push notifications; read receipts and presence", vi: "Người dùng offline nhận push notification; trạng thái đã đọc và online"}
    ],
    answer: "Clients keep a WebSocket connection to a chat gateway, because polling would be too slow and expensive. When a user sends a message, the gateway saves it to the message store first, with a sequence number per conversation, so clients can sort messages and fetch what they missed after a reconnect. Then the message is published through a pub/sub system, like Redis or Kafka, to the gateway servers where the recipients are connected. If a recipient is offline, we send a push notification instead. A message store like Cassandra works well, partitioned by conversation ID. Presence and typing indicators are short-lived, so they live in Redis with a TTL. For group chats, I'd limit the group size to keep fan-out under control.",
    keyPhrases: ["WebSocket connection", "a sequence number per conversation", "after a reconnect", "push notification", "fan-out"]
  },
  // ---------- JPA / SQL / JAVA DEEP DIVE ----------
  {
    category: 'SPRING',
    question: "What is LazyInitializationException, and how do you avoid it?",
    questionVi: "LazyInitializationException là gì, và làm sao tránh nó?",
    outline: [
      {en: "Lazy association accessed after the session is closed", vi: "Truy cập quan hệ lazy sau khi session đã đóng"},
      {en: "Fetch what you need in the query: JOIN FETCH, entity graph, DTO projection", vi: "Lấy đúng dữ liệu cần trong query: JOIN FETCH, entity graph, DTO projection"},
      {en: "Disable open-in-view; don't make everything eager", vi: "Tắt open-in-view; không chuyển mọi thứ thành eager"}
    ],
    answer: "It happens when we load an entity with a lazy association, the transaction and persistence context close, and then some code, often the JSON serializer, tries to read that association. Hibernate can't load it anymore, so it throws the exception. The wrong fix is to make everything eager, because that loads too much data everywhere. The right fix is to fetch exactly what the use case needs inside the transaction: a JOIN FETCH query, an entity graph, or better, a DTO projection, and to map to DTOs in the service layer instead of returning entities from the controller. I also disable spring.jpa.open-in-view, because it hides the problem and keeps database connections open during rendering.",
    keyPhrases: ["lazy association", "persistence context", "make everything eager", "DTO projection", "open-in-view"]
  },
  {
    category: 'SPRING',
    question: "What are the entity states in JPA?",
    questionVi: "Các trạng thái của entity trong JPA là gì?",
    outline: [
      {en: "Transient, managed, detached, removed", vi: "Transient, managed, detached, removed"},
      {en: "Managed entities are dirty-checked and flushed automatically", vi: "Entity managed được dirty-check và tự flush"},
      {en: "merge for detached entities; optimistic locking with @Version", vi: "merge cho entity detached; khóa lạc quan với @Version"}
    ],
    answer: "An entity can be in four states. Transient means it's a new object that JPA doesn't know about yet. When we call persist or save, it becomes managed: it's in the persistence context, and Hibernate tracks its changes. That's why, inside a transaction, I can just change a field on a managed entity, and dirty checking writes the update at flush time without calling save. When the transaction ends, the entity becomes detached, so changes are no longer tracked, and merge copies their state onto a managed instance, which it returns. Removed means it's scheduled for deletion. For updates coming from a client, I load the managed entity, check the @Version field for optimistic locking, and copy only the allowed fields.",
    keyPhrases: ["transient", "managed", "dirty checking", "detached", "@Version"]
  },
  {
    category: 'SPRING',
    question: "How do you run a scheduled job safely when you have several instances of a service?",
    questionVi: "Làm sao chạy job định kỳ an toàn khi service có nhiều instance?",
    outline: [
      {en: "@Scheduled runs on every instance by default", vi: "@Scheduled mặc định chạy trên mọi instance"},
      {en: "Use a distributed lock (ShedLock) or claim rows with SELECT ... FOR UPDATE SKIP LOCKED", vi: "Dùng khóa phân tán (ShedLock) hoặc claim từng dòng bằng SELECT ... FOR UPDATE SKIP LOCKED"},
      {en: "Make the job idempotent and resumable", vi: "Job phải idempotent và chạy tiếp được"}
    ],
    answer: "With @Scheduled, every instance runs the job, so with three pods, a daily email job would send three emails. One option is a distributed lock, like ShedLock, which stores a lock row in the database so only one instance runs the job at a time, with a maximum lock time in case the instance crashes. For processing many records, I prefer letting each instance claim a batch of rows with SELECT FOR UPDATE SKIP LOCKED and mark them as in progress, so several instances can share the work without overlapping. In both cases, the job must be idempotent, because a crash halfway can cause a rerun, and I track a status per record so it can resume instead of starting over.",
    keyPhrases: ["every instance runs the job", "distributed lock", "maximum lock time", "SKIP LOCKED", "resume instead of starting over"]
  },
  {
    category: 'DATABASE',
    question: "What is the difference between WHERE and HAVING?",
    questionVi: "WHERE và HAVING khác nhau thế nào?",
    outline: [
      {en: "WHERE filters rows before grouping", vi: "WHERE lọc các dòng trước khi gom nhóm"},
      {en: "HAVING filters groups after aggregation", vi: "HAVING lọc các nhóm sau khi tổng hợp"},
      {en: "Filter early with WHERE for performance", vi: "Lọc sớm bằng WHERE để có hiệu năng tốt"}
    ],
    answer: "WHERE filters individual rows before the GROUP BY happens, so it can't use aggregate functions like SUM or COUNT. HAVING filters the groups after the aggregation. For example, to find customers who spent more than ten million dong this year, I'd use WHERE to keep only this year's orders, then GROUP BY the customer ID, and HAVING SUM of the amount greater than ten million. For performance, I put every condition that doesn't need an aggregate in the WHERE clause, because it reduces the number of rows before grouping and it can use indexes.",
    keyPhrases: ["filters individual rows", "aggregate functions", "filters the groups", "GROUP BY the customer ID", "reduces the number of rows"]
  },
  {
    category: 'DATABASE',
    question: "What are window functions, and when do you use them?",
    questionVi: "Window function là gì, và khi nào dùng?",
    outline: [
      {en: "Calculate across related rows without collapsing them", vi: "Tính toán trên các dòng liên quan mà không gộp chúng lại"},
      {en: "ROW_NUMBER, RANK, running totals with SUM OVER", vi: "ROW_NUMBER, RANK, tổng lũy kế với SUM OVER"},
      {en: "PARTITION BY and ORDER BY define the window", vi: "PARTITION BY và ORDER BY xác định cửa sổ"}
    ],
    answer: "A window function calculates a value across a set of related rows, but unlike GROUP BY, it keeps every row in the result. The OVER clause defines the window: PARTITION BY splits the rows into groups, and ORDER BY sets the order inside each group. I use ROW_NUMBER to get the latest transaction per account, by partitioning by account ID, ordering by date descending, and keeping row number one. I also use SUM OVER for running balances, and LAG to compare a value with the previous month. It usually replaces complex self-joins or subqueries with something much easier to read.",
    keyPhrases: ["keeps every row", "the OVER clause", "PARTITION BY", "the latest transaction per account", "running balances"]
  },
  {
    category: 'DATABASE',
    question: "What is database normalization, and when would you denormalize?",
    questionVi: "Chuẩn hóa database là gì, và khi nào bạn phi chuẩn hóa?",
    outline: [
      {en: "Remove duplication: 1NF, 2NF, 3NF", vi: "Loại bỏ trùng lặp: 1NF, 2NF, 3NF"},
      {en: "Benefit: consistent updates, no anomalies", vi: "Lợi ích: cập nhật nhất quán, không có bất thường dữ liệu"},
      {en: "Denormalize for read performance, with a clear owner of the truth", vi: "Phi chuẩn hóa để tăng hiệu năng đọc, nhưng phải rõ nguồn dữ liệu gốc"}
    ],
    answer: "Normalization means organizing tables so each fact is stored in only one place. In practice, third normal form is the usual target: each column depends on the key, the whole key, and nothing but the key. For example, the customer's name lives in the customer table, not copied into every order. That prevents update anomalies, where one copy changes and another doesn't. I denormalize only for a measured read-performance problem, for example storing a precomputed monthly total for a dashboard, or a snapshot of a price at the time of the order, which is actually a business requirement. When I do, I make it clear which table is the source of truth and how the copy is kept in sync.",
    keyPhrases: ["each fact is stored in only one place", "third normal form", "update anomalies", "a measured read-performance problem", "source of truth"]
  },
  {
    category: 'DATABASE',
    question: "What is a clustered index in MySQL InnoDB?",
    questionVi: "Clustered index trong MySQL InnoDB là gì?",
    outline: [
      {en: "Table rows are stored in primary key order", vi: "Các dòng được lưu theo thứ tự khóa chính"},
      {en: "Secondary indexes store the primary key, so lookups may take two steps", vi: "Index phụ lưu khóa chính, nên tra cứu có thể mất hai bước"},
      {en: "Prefer short, increasing keys; covering indexes", vi: "Nên dùng khóa ngắn, tăng dần; covering index"}
    ],
    answer: "In InnoDB, the table itself is stored as a B-tree ordered by the primary key, so the primary key is the clustered index, and its leaf pages contain the full rows. Secondary indexes don't point to a physical location. They store the primary key value, so a lookup through a secondary index usually finds the primary key first, then reads the row from the clustered index. That's why I prefer a short, increasing primary key, like a BIGINT auto-increment: random UUIDs cause page splits and make every secondary index bigger. And when a secondary index contains all the columns a query needs, it's a covering index, and MySQL can skip the second lookup entirely.",
    keyPhrases: ["stored as a B-tree", "leaf pages contain the full rows", "store the primary key value", "page splits", "covering index"]
  },
  {
    category: 'JAVA_CORE',
    question: "How should Optional be used, and how should it not be used?",
    questionVi: "Nên dùng Optional thế nào, và không nên dùng thế nào?",
    outline: [
      {en: "Return type for 'maybe no result'", vi: "Kiểu trả về cho trường hợp 'có thể không có kết quả'"},
      {en: "Use map, orElseThrow, orElseGet; avoid get()", vi: "Dùng map, orElseThrow, orElseGet; tránh get()"},
      {en: "Not for fields, parameters or collections", vi: "Không dùng cho field, tham số hay collection"}
    ],
    answer: "Optional was designed as a return type, to say clearly that a method may have no result, like findById in Spring Data. The caller then handles the empty case with map, orElse, orElseGet, or orElseThrow with a domain exception, like CardNotFoundException. I avoid calling get without a check, because that's just a NullPointerException with a different name. I also don't use Optional for fields, method parameters or collections. For a collection, an empty list is better than an Optional of a list. And orElse always evaluates its argument, so for something expensive, I use orElseGet instead.",
    keyPhrases: ["designed as a return type", "orElseThrow", "a domain exception", "an empty list is better", "orElseGet"]
  },
  {
    category: 'JAVA_CORE',
    question: "Can you explain generics and wildcards, like extends and super?",
    questionVi: "Bạn có thể giải thích generics và wildcard, như extends và super không?",
    outline: [
      {en: "Generics give compile-time type safety; type erasure at runtime", vi: "Generics cho an toàn kiểu lúc biên dịch; bị xóa kiểu lúc runtime"},
      {en: "? extends T to read (producer), ? super T to write (consumer)", vi: "? extends T để đọc (producer), ? super T để ghi (consumer)"},
      {en: "PECS: producer extends, consumer super", vi: "PECS: producer extends, consumer super"}
    ],
    answer: "Generics let us write code that works with different types while the compiler checks type safety, so we don't need casts. At runtime, the type information is erased, which is why we can't do new T or check instanceof List of String. Wildcards make APIs more flexible. A List of question mark extends Number can be a list of Integer or Double, and I can read Numbers from it, but I can't add to it, because the compiler doesn't know the exact type. A List of question mark super Integer accepts Integers to be added. The rule is PECS: producer extends, consumer super. Collections.copy is a good example: the source is extends and the destination is super.",
    keyPhrases: ["type safety", "the type information is erased", "I can read Numbers from it", "PECS", "producer extends, consumer super"]
  },
  {
    category: 'JAVA_CORE',
    question: "Can Java have memory leaks? How do you find one?",
    questionVi: "Java có bị rò rỉ bộ nhớ không? Bạn tìm ra nó thế nào?",
    outline: [
      {en: "Yes: objects still referenced but no longer needed", vi: "Có: object vẫn còn được tham chiếu nhưng không còn cần"},
      {en: "Common causes: static maps, caches without eviction, ThreadLocal, listeners", vi: "Nguyên nhân hay gặp: static map, cache không có eviction, ThreadLocal, listener"},
      {en: "Find it: heap growth after GC, heap dump, Eclipse MAT", vi: "Tìm: heap tăng dần sau GC, heap dump, Eclipse MAT"}
    ],
    answer: "Yes. The garbage collector only frees objects that are unreachable, so if we keep a reference to something we no longer need, it stays in memory forever. Common causes are static maps or caches that grow without any eviction, ThreadLocal values that aren't removed in a thread pool, listeners that are registered but never unregistered, and unclosed resources. The symptom is that heap usage after each full GC keeps going up, until we get an OutOfMemoryError. To find it, I take a heap dump, or enable HeapDumpOnOutOfMemoryError, and open it in Eclipse MAT to see which objects retain the most memory and what keeps them alive. Then the fix is usually a bounded cache with a TTL, or proper cleanup in a finally block.",
    keyPhrases: ["only frees objects that are unreachable", "without any eviction", "ThreadLocal", "heap usage after each full GC", "heap dump"]
  },
  {
    category: 'JAVA_CORE',
    question: "Comparable vs Comparator - what's the difference?",
    questionVi: "Comparable và Comparator khác nhau thế nào?",
    outline: [
      {en: "Comparable: the natural order, inside the class (compareTo)", vi: "Comparable: thứ tự tự nhiên, nằm trong class (compareTo)"},
      {en: "Comparator: external, many orders (compare)", vi: "Comparator: bên ngoài, nhiều kiểu sắp xếp (compare)"},
      {en: "Comparator.comparing().thenComparing(); keep consistent with equals", vi: "Comparator.comparing().thenComparing(); nhất quán với equals"}
    ],
    answer: "Comparable defines the natural order of a class. The class itself implements compareTo, like String sorting alphabetically or BigDecimal sorting by value. A Comparator is a separate object, so I can define many different orders without changing the class, for example sorting transactions by date, then by amount. Since Java 8, I build comparators with Comparator.comparing, thenComparing and reversed, which is much safer than subtracting numbers by hand, because subtraction can overflow. One detail: BigDecimal's compareTo treats 1.0 and 1.00 as equal while equals doesn't, so I'm careful when I use it as a key in a sorted set.",
    keyPhrases: ["the natural order", "implements compareTo", "a separate object", "Comparator.comparing", "subtraction can overflow"]
  },
  // ---------- MORE BEHAVIORAL ----------
  {
    category: 'PROJECT',
    question: "How do you prioritize when you have several urgent tasks?",
    questionVi: "Bạn ưu tiên thế nào khi có nhiều việc gấp cùng lúc?",
    outline: [
      {en: "Assess impact and urgency; production issues first", vi: "Đánh giá tác động và mức độ gấp; sự cố production trước"},
      {en: "Align with the lead or product owner when priorities conflict", vi: "Thống nhất với lead hoặc product owner khi ưu tiên xung đột"},
      {en: "Communicate what will be delayed", vi: "Thông báo việc nào sẽ bị chậm lại"}
    ],
    answer: "I start by looking at the impact and the urgency of each task. Anything that affects customers in production, like a payment failure, comes first. Then I look at deadlines that other people depend on, like an API another team is waiting for. If two tasks are equally important and I can't do both, I don't decide alone. I go to my lead or the product owner, explain the trade-off, and ask them to choose. Then I tell everyone affected what will be delayed and when they can expect it. I also try to break big tasks into small pieces, so I can deliver something useful early.",
    keyPhrases: ["the impact and the urgency", "affects customers in production", "I don't decide alone", "explain the trade-off", "what will be delayed"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you had to deal with unclear requirements.",
    questionVi: "Hãy kể về một lần bạn phải xử lý yêu cầu không rõ ràng.",
    outline: [
      {en: "Situation: what was unclear and why it mattered", vi: "Bối cảnh: điều gì không rõ và vì sao quan trọng"},
      {en: "Action: ask questions, write assumptions down, build a small prototype", vi: "Hành động: đặt câu hỏi, ghi lại giả định, làm prototype nhỏ"},
      {en: "Result: fewer changes later", vi: "Kết quả: ít phải sửa đổi về sau"}
    ],
    answer: "On [project], we got a ticket that just said 'add a monthly report for the finance team', with no details about the fields, the filters or the format. Instead of guessing, I booked a thirty-minute call with a person from the finance team and asked how they used the current spreadsheet. I wrote down my assumptions in the ticket, like which currency to use and how to handle refunds, and asked them to confirm. Then I built a simple version with real data and showed it to them after three days. They found two problems immediately, which would have cost us a full sprint if we had found them at the end.",
    keyPhrases: ["instead of guessing", "how they used the current spreadsheet", "wrote down my assumptions", "a simple version with real data", "would have cost us a full sprint"]
  },
  {
    category: 'PROJECT',
    question: "How do you handle criticism of your work?",
    questionVi: "Bạn xử lý thế nào khi công việc của mình bị phê bình?",
    outline: [
      {en: "Listen without being defensive", vi: "Lắng nghe, không phản ứng phòng thủ"},
      {en: "Ask for specifics; separate the work from yourself", vi: "Hỏi cụ thể; tách công việc khỏi bản thân"},
      {en: "Act on it and follow up; example", vi: "Hành động và phản hồi lại; kèm ví dụ"}
    ],
    answer: "I try to see criticism as information that helps me improve, not as a personal attack. First, I listen without interrupting and ask for a specific example, so I understand exactly what the problem is. For example, a senior developer once told me my pull requests were too big and hard to review. At first it was a bit uncomfortable to hear, but he was right. I started splitting my work into smaller PRs with a clear description, and our review time dropped from about two days to a few hours. I also went back to him a few weeks later to ask whether it was better.",
    keyPhrases: ["information that helps me improve", "without interrupting", "a specific example", "he was right", "went back to him"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you mentored or helped a teammate.",
    questionVi: "Hãy kể về một lần bạn kèm cặp hoặc giúp đỡ đồng nghiệp.",
    outline: [
      {en: "Who you helped and what they struggled with", vi: "Bạn giúp ai và họ gặp khó khăn gì"},
      {en: "How you helped: pairing, explaining, letting them do it", vi: "Bạn giúp thế nào: pair, giải thích, để họ tự làm"},
      {en: "Their progress and what you learned", vi: "Sự tiến bộ của họ và điều bạn học được"}
    ],
    answer: "When a junior developer joined our team, she found our Spring Boot codebase confusing, especially transactions and the security configuration. Instead of fixing things for her, I set up two short pairing sessions a week. She was at the keyboard, and I asked questions to guide her, like 'what happens if this call fails?'. I also pointed her to a few small tickets that touched one layer at a time. After about two months, she was picking up normal tickets on her own and even reviewing my code. It taught me to explain things more simply, which helped me in client meetings too.",
    keyPhrases: ["instead of fixing things for her", "pairing sessions", "she was at the keyboard", "on her own", "explain things more simply"]
  },
  {
    category: 'PROJECT',
    question: "What is your experience working in a multicultural or remote team?",
    questionVi: "Bạn có kinh nghiệm làm việc trong nhóm đa văn hóa hoặc làm từ xa thế nào?",
    outline: [
      {en: "Time zones and async communication", vi: "Múi giờ và giao tiếp bất đồng bộ"},
      {en: "Clear written updates; confirm understanding", vi: "Cập nhật bằng văn bản rõ ràng; xác nhận đã hiểu đúng"},
      {en: "Respect different communication styles", vi: "Tôn trọng phong cách giao tiếp khác nhau"}
    ],
    answer: "In my last project, I worked with a product owner in [country] and testers in [country], with a time difference of [number] hours. Because we only overlapped for a few hours a day, I learned to communicate clearly in writing: my updates always said what was done, what was blocked, and what I needed, so nobody had to wait for a meeting. In calls, I confirmed my understanding by repeating the key points, because accents and connections weren't always clear. I also noticed that some colleagues were very direct while others were more indirect, so I learned not to take directness personally, and to ask quieter people for their opinion.",
    keyPhrases: ["a time difference of", "communicate clearly in writing", "nobody had to wait for a meeting", "repeating the key points", "not to take directness personally"]
  },
  {
    category: 'PROJECT',
    question: "How do you keep your technical skills up to date?",
    questionVi: "Bạn cập nhật kỹ năng kỹ thuật của mình như thế nào?",
    outline: [
      {en: "Regular sources: docs, release notes, blogs, conferences", vi: "Nguồn thường xuyên: tài liệu, release notes, blog, hội thảo"},
      {en: "Learn by building small projects", vi: "Học bằng cách làm dự án nhỏ"},
      {en: "Share with the team", vi: "Chia sẻ lại với nhóm"}
    ],
    answer: "I have a simple routine. I read the release notes for Java and Spring Boot when a new version comes out, and I follow a few engineering blogs and conference talks, like Devoxx or Spring I/O. But I learn best by building, so when something looks useful, like virtual threads or Testcontainers, I try it in a small side project first, and then suggest it to the team with a short demo. I also use AI coding assistants carefully, as a way to explore ideas faster, but I always verify the result myself. And I'm currently preparing for [certification, for example the AWS Developer exam].",
    keyPhrases: ["a simple routine", "release notes", "I learn best by building", "a small side project", "verify the result myself"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you went beyond your assigned tasks.",
    questionVi: "Hãy kể về một lần bạn làm vượt ngoài phạm vi công việc được giao.",
    outline: [
      {en: "A problem nobody owned", vi: "Một vấn đề không ai nhận"},
      {en: "What you did on your own initiative", vi: "Bạn chủ động làm gì"},
      {en: "Measurable result for the team", vi: "Kết quả đo được cho nhóm"}
    ],
    answer: "Our build pipeline took about twenty-five minutes, and everyone complained, but it wasn't anyone's task. After finishing my sprint work, I spent some time analyzing where the time went. I found that we ran the full integration test suite twice and downloaded all dependencies on every build. I proposed caching the dependencies and running the slow tests in parallel, discussed it with the tech lead, and implemented it over two weeks. The build went down to about nine minutes, which saved the whole team a lot of waiting every day. It showed me that small improvements in shared tools can have a big impact.",
    keyPhrases: ["it wasn't anyone's task", "where the time went", "caching the dependencies", "discussed it with the tech lead", "a big impact"]
  },
  // ---------- SPRING / DATABASE ADVANCED ----------
  {
    category: 'SPRING',
    question: "What is the lifecycle of a Spring bean?",
    questionVi: "Vòng đời của một Spring bean là gì?",
    outline: [
      {en: "Instantiate, inject dependencies, Aware callbacks", vi: "Khởi tạo, inject dependency, các callback Aware"},
      {en: "BeanPostProcessors, @PostConstruct, proxies are created here", vi: "BeanPostProcessor, @PostConstruct, proxy được tạo ở bước này"},
      {en: "Ready to use; @PreDestroy on shutdown", vi: "Sẵn sàng sử dụng; @PreDestroy khi tắt ứng dụng"}
    ],
    answer: "When the context starts, Spring creates the bean, usually through its constructor, and injects its dependencies. Then it calls Aware interfaces if the bean implements them. Next, BeanPostProcessors run before and after initialization. In between, Spring calls the @PostConstruct method, or an init method. That after-initialization step is where Spring wraps the bean in a proxy for features like @Transactional or @Async. Then the bean is ready and lives as long as its scope, which is the whole application for a singleton. On shutdown, Spring calls @PreDestroy so we can release resources, like closing a connection or stopping a scheduler. Prototype beans are the exception: Spring doesn't manage their destruction.",
    keyPhrases: ["injects its dependencies", "BeanPostProcessors", "@PostConstruct", "wraps the bean in a proxy", "@PreDestroy"]
  },
  {
    category: 'SPRING',
    question: "How does @Async work, and what are the pitfalls?",
    questionVi: "@Async hoạt động thế nào, và có những cạm bẫy gì?",
    outline: [
      {en: "Runs the method on another thread through a proxy", vi: "Chạy method trên thread khác thông qua proxy"},
      {en: "Configure a bounded executor; return CompletableFuture", vi: "Cấu hình executor có giới hạn; trả về CompletableFuture"},
      {en: "Pitfalls: self-invocation, lost exceptions, no transaction or security context", vi: "Cạm bẫy: tự gọi nội bộ, mất exception, không có transaction hay security context"}
    ],
    answer: "With @EnableAsync, Spring wraps the bean in a proxy, and a call to an @Async method is submitted to an executor, so the caller returns immediately. I always define my own executor with a bounded pool and queue, because I don't want unlimited threads under load. If I need the result, the method returns a CompletableFuture. There are a few pitfalls. Calling the method from the same class bypasses the proxy, so it runs synchronously. Exceptions from void methods never reach the caller, and by default they're only logged, unless I configure an exception handler. And the new thread doesn't share the caller's transaction or security context. For work that must not be lost, like sending a payment confirmation, I prefer a persistent queue or an outbox, because @Async tasks disappear if the app restarts.",
    keyPhrases: ["submitted to an executor", "a bounded pool", "bypasses the proxy", "never reach the caller", "disappear if the app restarts"]
  },
  {
    category: 'SPRING',
    question: "Spring MVC vs Spring WebFlux - when would you choose WebFlux?",
    questionVi: "Spring MVC và Spring WebFlux - khi nào bạn chọn WebFlux?",
    outline: [
      {en: "MVC: thread per request, blocking, simple", vi: "MVC: mỗi request một thread, chặn, đơn giản"},
      {en: "WebFlux: non-blocking, event loop, backpressure", vi: "WebFlux: không chặn, event loop, backpressure"},
      {en: "Virtual threads reduce the need for WebFlux in many apps", vi: "Virtual thread giảm nhu cầu dùng WebFlux ở nhiều ứng dụng"}
    ],
    answer: "Spring MVC uses a thread per request, and code is blocking and easy to read, debug and test. WebFlux is non-blocking: a small number of event-loop threads handle many requests, and work is expressed with reactive types like Mono and Flux, with backpressure. WebFlux makes sense for streaming, like server-sent events, or a gateway that mostly waits on many slow downstream calls. But the whole chain has to be non-blocking, including the database driver, otherwise you block the event loop. For a typical CRUD service with JPA, I'd choose MVC, and today with virtual threads, MVC can handle a lot of concurrent blocking I/O without the complexity of reactive code.",
    keyPhrases: ["thread per request", "non-blocking", "event-loop threads", "the whole chain has to be non-blocking", "without the complexity of reactive code"]
  },
  {
    category: 'SPRING',
    question: "How do you handle exceptions properly in a backend service?",
    questionVi: "Bạn xử lý exception đúng cách trong một service backend như thế nào?",
    outline: [
      {en: "Domain exceptions with meaning; don't swallow errors", vi: "Exception nghiệp vụ có ý nghĩa; không nuốt lỗi"},
      {en: "One global handler maps them to stable error codes", vi: "Một handler toàn cục ánh xạ sang mã lỗi ổn định"},
      {en: "Log once with context and trace ID; never leak internals", vi: "Log một lần kèm bối cảnh và trace ID; không lộ thông tin nội bộ"}
    ],
    answer: "I throw specific domain exceptions, like InsufficientBalanceException or CardNotFoundException, instead of a generic RuntimeException, so the meaning is clear. I never catch an exception and ignore it. Either I can handle it, for example retry or use a fallback, or I let it go up. At the edge, one @RestControllerAdvice maps each exception to an HTTP status and a stable error code, and adds a trace ID. The client never sees a stack trace, SQL or internal paths. I log the error once, at the place where it's handled, with useful context but without sensitive data like tokens or card numbers. Logging the same exception at every layer just creates noise.",
    keyPhrases: ["specific domain exceptions", "catch an exception and ignore it", "@RestControllerAdvice", "a stable error code", "log the error once"]
  },
  {
    category: 'DATABASE',
    question: "How does a connection pool work, and how do you size it?",
    questionVi: "Connection pool hoạt động thế nào, và bạn chọn kích thước ra sao?",
    outline: [
      {en: "Reuse open connections instead of creating one per request (HikariCP)", vi: "Tái sử dụng kết nối đang mở thay vì tạo mới mỗi request (HikariCP)"},
      {en: "Bigger is not better: the database has limited cores", vi: "Lớn hơn không có nghĩa là tốt hơn: database có số core giới hạn"},
      {en: "Monitor wait time; keep transactions short", vi: "Theo dõi thời gian chờ; giữ transaction ngắn"}
    ],
    answer: "Opening a database connection is expensive, so a pool like HikariCP, the default in Spring Boot, keeps a set of open connections and lends one to each transaction. A common mistake is making the pool very large. The database can only run a limited number of queries in parallel, based on its CPU cores and disks, so too many connections just create contention. I start small, like ten connections per instance, remember that the total across all instances must stay under the database limit, and then tune it using metrics: active connections, and especially the time threads wait for a connection. If threads wait a lot, the real fix is often shorter transactions, like not calling an external API while a transaction is open.",
    keyPhrases: ["lends one to each transaction", "making the pool very large", "create contention", "the total across all instances", "shorter transactions"]
  },
  {
    category: 'DATABASE',
    question: "What is MVCC, and how does it help concurrency?",
    questionVi: "MVCC là gì, và nó giúp xử lý đồng thời ra sao?",
    outline: [
      {en: "Multi-version concurrency control: readers see a snapshot", vi: "Kiểm soát đồng thời đa phiên bản: người đọc thấy một snapshot"},
      {en: "Readers don't block writers and writers don't block readers", vi: "Đọc không chặn ghi, ghi không chặn đọc"},
      {en: "Old versions kept in undo logs; long transactions are costly", vi: "Phiên bản cũ lưu trong undo log; transaction dài rất tốn kém"}
    ],
    answer: "MVCC stands for multi-version concurrency control. Instead of locking a row for every read, the database keeps older versions of changed rows, in InnoDB in the undo log. Each transaction reads from a consistent snapshot, so plain SELECTs don't block writers, and writers don't block plain readers. That's why InnoDB's default REPEATABLE READ level can give consistent reads without many locks. Writers still lock the rows they change, so two updates to the same row are serialized. The cost is that a long-running transaction forces the database to keep old versions for a long time, which uses space and slows things down, so I keep transactions short.",
    keyPhrases: ["multi-version concurrency control", "consistent snapshot", "don't block writers", "serialized", "a long-running transaction"]
  },
  {
    category: 'DATABASE',
    question: "How do you deal with database deadlocks?",
    questionVi: "Bạn xử lý deadlock trong database như thế nào?",
    outline: [
      {en: "Two transactions lock rows in opposite order; DB kills one", vi: "Hai transaction khóa dòng theo thứ tự ngược nhau; DB hủy một bên"},
      {en: "Prevent: consistent order, short transactions, good indexes", vi: "Phòng tránh: thứ tự nhất quán, transaction ngắn, index tốt"},
      {en: "Retry the victim safely; read the deadlock log", vi: "Thử lại transaction bị hủy một cách an toàn; đọc log deadlock"}
    ],
    answer: "A deadlock happens when transaction A locks row one and waits for row two, while transaction B holds row two and waits for row one. MySQL detects it and rolls back one transaction, the victim, with a deadlock error. To prevent them, I access rows in a consistent order, for example always updating accounts by ascending ID in a transfer, keep transactions short, and make sure updates use an index, because without one, InnoDB can lock many more rows than needed. Because deadlocks can still happen under load, the application should retry the victim transaction a few times, as long as the operation is idempotent. To investigate, I read the latest deadlock section in SHOW ENGINE INNODB STATUS.",
    keyPhrases: ["rolls back one transaction", "the victim", "ascending ID", "lock many more rows than needed", "SHOW ENGINE INNODB STATUS"]
  },
  {
    category: 'DATABASE',
    question: "Auto-increment IDs or UUIDs as primary keys?",
    questionVi: "Dùng ID tự tăng hay UUID làm khóa chính?",
    outline: [
      {en: "Auto-increment: small, ordered, fast inserts; but guessable", vi: "Tự tăng: nhỏ, có thứ tự, chèn nhanh; nhưng dễ đoán"},
      {en: "Random UUID: globally unique, but bigger and causes page splits", vi: "UUID ngẫu nhiên: duy nhất toàn cục, nhưng to hơn và gây page split"},
      {en: "Middle ground: time-ordered UUIDv7 or internal ID + public ID", vi: "Giải pháp dung hòa: UUIDv7 theo thời gian, hoặc ID nội bộ + ID công khai"}
    ],
    answer: "Auto-increment IDs are small and ordered, so inserts are fast and indexes stay compact, which matters a lot in InnoDB, where every secondary index stores the primary key. The downside is that they're guessable, so exposing them in URLs can leak business information or invite enumeration attacks, and they need the database to generate them. Random UUIDs are globally unique and can be created anywhere, but they're twice as big as a BIGINT, or much bigger if stored as text, and their random order causes page splits on insert. A good middle ground is a time-ordered UUID, like UUID version 7, or keeping a BIGINT primary key internally and exposing a separate random public ID. Either way, the server must still check ownership, because an ID that's hard to guess isn't access control.",
    keyPhrases: ["small and ordered", "guessable", "enumeration attacks", "page splits", "UUID version 7"]
  },
  {
    category: 'DATABASE',
    question: "Soft delete or hard delete - what do you prefer?",
    questionVi: "Xóa mềm hay xóa cứng - bạn chọn cách nào?",
    outline: [
      {en: "Soft delete: deleted_at column, easy restore and audit", vi: "Xóa mềm: cột deleted_at, dễ khôi phục và kiểm toán"},
      {en: "Costs: every query must filter, unique constraints get harder", vi: "Chi phí: mọi query phải lọc, ràng buộc unique khó hơn"},
      {en: "Legal requirements: personal data may need real deletion", vi: "Yêu cầu pháp lý: dữ liệu cá nhân có thể phải xóa thật"}
    ],
    answer: "It depends on the data. Soft delete, with a deleted_at column, is useful when users might want to restore something, or when we need history for auditing. But it has costs: every query must filter out deleted rows, and if one query forgets, deleted data shows up again. Unique constraints also get harder, like allowing the same email after an account is deleted. For financial records, I don't delete at all: the ledger is append-only and we add a reversal entry instead. For personal data, privacy laws may require a real deletion or anonymization. So I decide per entity, and when I use soft delete, I put the filter in one place, like a Hibernate filter or a database view.",
    keyPhrases: ["it depends on the data", "deleted_at column", "if one query forgets", "a reversal entry", "anonymization"]
  },
  {
    category: 'SPRING',
    question: "How should equals and hashCode be implemented for JPA entities?",
    questionVi: "Nên cài đặt equals và hashCode cho JPA entity như thế nào?",
    outline: [
      {en: "Generated ID is null before persist: hash code would change", vi: "ID tự sinh là null trước khi persist: hash code sẽ thay đổi"},
      {en: "Use a natural business key, or ID-based equals with a constant hashCode", vi: "Dùng khóa nghiệp vụ tự nhiên, hoặc equals theo ID với hashCode hằng"},
      {en: "Avoid Lombok @Data on entities: lazy loading and recursion", vi: "Tránh @Data của Lombok trên entity: lazy loading và đệ quy"}
    ],
    answer: "It's tricky because a generated ID is null until the entity is persisted. If hashCode is based on that ID, it changes after saving, so an entity added to a HashSet before persisting can't be found afterwards. There are two safe options. If the entity has a natural, immutable business key, like an IBAN or an email that can't change, I base both methods on that. Otherwise, I use the ID in equals, treat two unsaved entities as different, and return a constant hashCode for the class. I also avoid Lombok's @Data and @EqualsAndHashCode on entities, because they include every field, which can trigger lazy loading or infinite recursion with bidirectional relationships.",
    keyPhrases: ["null until the entity is persisted", "can't be found afterwards", "a natural, immutable business key", "a constant hashCode", "infinite recursion"]
  },
  // ---------- MORE SYSTEM DESIGN ----------
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a digital wallet or money transfer system?",
    questionVi: "Bạn sẽ thiết kế một ví điện tử hoặc hệ thống chuyển tiền như thế nào?",
    outline: [
      {en: "Double-entry, append-only ledger; balance derived from entries", vi: "Sổ cái kép, chỉ ghi thêm; số dư tính từ các bút toán"},
      {en: "Idempotency keys, row locks in a consistent order, BigDecimal", vi: "Idempotency key, khóa dòng theo thứ tự nhất quán, BigDecimal"},
      {en: "Reconciliation, audit trail, limits and fraud checks", vi: "Đối soát, nhật ký kiểm toán, hạn mức và kiểm tra gian lận"}
    ],
    answer: "The core is a double-entry ledger. Every transfer creates at least two entries, a debit from one account and a credit to another, and the entries always sum to zero. The ledger is append-only: we never update or delete an entry, we add a reversal. Each account also keeps a cached balance with a version column, updated in the same transaction as the entries. For a transfer, the client sends an idempotency key, and the service locks both accounts in a consistent order, like by account ID, to avoid deadlocks, checks the available balance, and writes everything in one transaction. Money is BigDecimal with explicit rounding. Around that, we need daily reconciliation with the bank, limits, fraud checks, and a full audit trail.",
    keyPhrases: ["double-entry ledger", "sum to zero", "we add a reversal", "in a consistent order", "daily reconciliation"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a real-time leaderboard?",
    questionVi: "Bạn sẽ thiết kế một bảng xếp hạng thời gian thực như thế nào?",
    outline: [
      {en: "Redis sorted set: ZINCRBY to update, ZRANGE with REV for top N", vi: "Redis sorted set: ZINCRBY để cập nhật, ZRANGE kèm REV lấy top N"},
      {en: "ZREVRANK for a user's rank in log time", vi: "ZREVRANK lấy thứ hạng người dùng với độ phức tạp log"},
      {en: "Database is the source of truth; rebuild Redis if needed", vi: "Database là nguồn gốc dữ liệu; dựng lại Redis khi cần"}
    ],
    answer: "Ranking millions of users with an ORDER BY on every request would be far too slow, so I'd use a Redis sorted set. Each member is a user ID, and the score is the points. When a user earns points, we call ZINCRBY, which updates the score in logarithmic time. The top ten is ZRANGE with the REV option, from zero to nine, and a user's own rank is ZREVRANK, both very fast. For weekly or monthly boards, I'd use a separate key per period, with an expiry. The score events are also stored in the database, which is the source of truth, so if Redis loses data, we can rebuild the sorted set. For very large scale, I'd shard by region or competition.",
    keyPhrases: ["Redis sorted set", "ZINCRBY", "logarithmic time", "a separate key per period", "rebuild the sorted set"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a news feed?",
    questionVi: "Bạn sẽ thiết kế một news feed như thế nào?",
    outline: [
      {en: "Fan-out on write: push post IDs to followers' feeds", vi: "Fan-out khi ghi: đẩy ID bài viết vào feed của người theo dõi"},
      {en: "Fan-out on read for celebrities with millions of followers", vi: "Fan-out khi đọc cho người nổi tiếng có hàng triệu người theo dõi"},
      {en: "Cache feeds, paginate with cursors, hydrate post details", vi: "Cache feed, phân trang bằng cursor, lấy chi tiết bài viết sau"}
    ],
    answer: "There are two main approaches. With fan-out on write, when a user posts, a background worker pushes the post ID into a precomputed feed for each follower, stored in something like Redis lists. Reading the feed is then very fast. But for a celebrity with millions of followers, that write is too expensive, so for those accounts we use fan-out on read: we fetch their recent posts when the follower opens the feed and merge them in. Most real systems use this hybrid. The feed stores only post IDs, and we hydrate the details, like the text and the like count, from a cache. Pagination uses a cursor, not an offset, because new posts arrive all the time.",
    keyPhrases: ["fan-out on write", "a precomputed feed", "fan-out on read", "this hybrid", "a cursor, not an offset"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design search autocomplete?",
    questionVi: "Bạn sẽ thiết kế tính năng gợi ý tìm kiếm (autocomplete) như thế nào?",
    outline: [
      {en: "Prefix lookup: trie or search engine edge n-grams", vi: "Tra theo tiền tố: trie hoặc edge n-gram của search engine"},
      {en: "Rank by popularity; precompute top suggestions per prefix", vi: "Xếp hạng theo độ phổ biến; tính trước gợi ý hàng đầu cho mỗi tiền tố"},
      {en: "Client debounce, caching, under 100 ms", vi: "Debounce ở client, cache, dưới 100 ms"}
    ],
    answer: "The requirement is to return the top few suggestions for a prefix in well under a hundred milliseconds. For a small dataset, a search engine like Elasticsearch with an edge n-gram analyzer is enough. At large scale, I'd build a trie where each node stores the top suggestions for that prefix, precomputed offline from search logs and ranked by popularity, so a lookup is just walking down a few nodes. The trie is rebuilt periodically and served from memory. On the client, I debounce the input by about two hundred milliseconds and cancel old requests, and responses for common prefixes are cached at the edge. I'd also filter out offensive or personal terms before they appear as suggestions.",
    keyPhrases: ["well under a hundred milliseconds", "edge n-gram", "precomputed offline", "ranked by popularity", "debounce the input"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you generate unique IDs in a distributed system?",
    questionVi: "Bạn sẽ tạo ID duy nhất trong hệ thống phân tán như thế nào?",
    outline: [
      {en: "Database auto-increment becomes a bottleneck", vi: "Auto-increment của database trở thành điểm nghẽn"},
      {en: "UUIDs: simple but large and random", vi: "UUID: đơn giản nhưng to và ngẫu nhiên"},
      {en: "Snowflake-style: timestamp + machine ID + sequence", vi: "Kiểu Snowflake: timestamp + mã máy + số thứ tự"}
    ],
    answer: "A single database auto-increment works until it becomes a bottleneck or a single point of failure. The simplest distributed option is a UUID, which any node can generate, but it's large, and random versions hurt index performance. A time-ordered UUIDv7 fixes the ordering problem. Another popular option is a Snowflake-style ID: a sixty-four-bit number made of a timestamp in milliseconds, a machine or worker ID, and a sequence number for IDs created in the same millisecond. They're compact, roughly sorted by time, and generated locally without coordination. The main risk is clock skew: if a server's clock goes backwards, it could create duplicates, so the generator must detect that and wait.",
    keyPhrases: ["single point of failure", "time-ordered UUIDv7", "Snowflake-style ID", "without coordination", "clock skew"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you implement a distributed lock, and what are the risks?",
    questionVi: "Bạn sẽ cài đặt khóa phân tán như thế nào, và có những rủi ro gì?",
    outline: [
      {en: "Redis SET key value NX PX with a unique value; release only if you own it", vi: "Redis SET key value NX PX với giá trị duy nhất; chỉ giải phóng khi mình sở hữu"},
      {en: "Lock can expire while work continues: use fencing tokens", vi: "Khóa có thể hết hạn khi việc vẫn chạy: dùng fencing token"},
      {en: "Prefer database constraints or row locks when possible", vi: "Ưu tiên ràng buộc hoặc khóa dòng của database khi có thể"}
    ],
    answer: "With Redis, I'd acquire the lock with SET key, a unique value, NX and an expiry, so only one client gets it and it can't stay locked forever if that client crashes. To release it, I use a small Lua script that deletes the key only if the value is still mine, so I never delete someone else's lock. The big risk is that the lock can expire while my process is still working, for example during a long GC pause, and then two processes think they hold it. If correctness really matters, I add a fencing token: an increasing number that the protected resource checks, rejecting older ones. Honestly, for most business cases, a database row lock or a unique constraint is simpler and safer than a distributed lock.",
    keyPhrases: ["NX and an expiry", "only if the value is still mine", "a long GC pause", "fencing token", "simpler and safer"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design OTP login or two-factor authentication?",
    questionVi: "Bạn sẽ thiết kế đăng nhập bằng OTP hoặc xác thực hai lớp như thế nào?",
    outline: [
      {en: "Random code, stored hashed with short expiry, single use", vi: "Mã ngẫu nhiên, lưu dạng băm, hết hạn nhanh, dùng một lần"},
      {en: "Rate limits on sending and verifying; lockout", vi: "Giới hạn tần suất gửi và xác minh; khóa tạm thời"},
      {en: "Prefer TOTP apps over SMS; generic error messages", vi: "Ưu tiên ứng dụng TOTP hơn SMS; thông báo lỗi chung chung"}
    ],
    answer: "When the user requests a code, I generate a six-digit code with a secure random generator, store only a hash of it with the user ID and an expiry of about five minutes, and send it by SMS or email. On verification, I compare it in constant time, check the expiry, and delete it, so it's single use. Rate limiting is essential: limit how often a code can be sent, to control cost and spam, and allow only a few wrong attempts before locking the challenge, otherwise a six-digit code can be brute-forced. Error messages stay generic, so they don't reveal whether an account exists. For stronger security, I'd offer TOTP authenticator apps or passkeys, because SMS can be intercepted through SIM swapping.",
    keyPhrases: ["a secure random generator", "store only a hash", "single use", "brute-forced", "SIM swapping"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What does an API gateway do?",
    questionVi: "API gateway làm nhiệm vụ gì?",
    outline: [
      {en: "Single entry point: routing to services", vi: "Điểm vào duy nhất: định tuyến tới các service"},
      {en: "Cross-cutting: authentication, rate limiting, TLS, CORS, logging", vi: "Việc chung: xác thực, giới hạn tần suất, TLS, CORS, logging"},
      {en: "Keep business logic out; avoid a single point of failure", vi: "Không đặt logic nghiệp vụ ở đây; tránh điểm lỗi duy nhất"}
    ],
    answer: "An API gateway is the single entry point for clients. It routes each request to the right backend service, so clients don't need to know the internal structure. It's also the natural place for cross-cutting concerns: terminating TLS, validating tokens, rate limiting, CORS, request size limits, and adding a trace ID for logging. Sometimes it aggregates responses from several services for a mobile app, which is the backend-for-frontend pattern. I keep business logic out of the gateway, because otherwise it becomes a bottleneck that every team has to change. Services should still check authorization themselves, and the gateway must run as several instances behind a load balancer, so it's not a single point of failure.",
    keyPhrases: ["the single entry point", "cross-cutting concerns", "backend-for-frontend", "keep business logic out", "check authorization themselves"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What is consistent hashing, and why is it useful?",
    questionVi: "Consistent hashing là gì, và vì sao nó hữu ích?",
    outline: [
      {en: "Modulo hashing moves almost every key when servers change", vi: "Băm theo modulo làm di chuyển gần như mọi key khi số server thay đổi"},
      {en: "Hash ring: a key goes to the next server clockwise", vi: "Vòng băm: một key thuộc về server kế tiếp theo chiều kim đồng hồ"},
      {en: "Virtual nodes balance the load", vi: "Node ảo giúp cân bằng tải"}
    ],
    answer: "If we spread keys across cache servers using the key's hash modulo the number of servers, then adding or removing one server changes the result for almost every key, and the whole cache is suddenly invalid. Consistent hashing fixes that. Both servers and keys are placed on a ring by their hash, and each key belongs to the next server clockwise. When a server is added or removed, only the keys between it and its neighbor move, roughly one over n of the keys. To avoid uneven load, each physical server gets many virtual nodes on the ring. It's used in distributed caches, databases like Cassandra and DynamoDB, and load balancers with sticky routing.",
    keyPhrases: ["modulo the number of servers", "placed on a ring", "the next server clockwise", "one over n of the keys", "virtual nodes"]
  },
  // ---------- CONCURRENCY DEEP DIVE ----------
  {
    category: 'JAVA_CORE',
    question: "What is a race condition? Can you give an example?",
    questionVi: "Race condition là gì? Bạn có thể cho ví dụ không?",
    outline: [
      {en: "Result depends on thread timing", vi: "Kết quả phụ thuộc vào thời điểm chạy của các thread"},
      {en: "Example: check-then-act on a balance, or count++", vi: "Ví dụ: kiểm tra rồi mới hành động trên số dư, hoặc count++"},
      {en: "Fix: atomic operations, locks, or database constraints", vi: "Cách sửa: thao tác nguyên tử, khóa, hoặc ràng buộc của database"}
    ],
    answer: "A race condition happens when the result depends on the timing of several threads accessing shared data. A classic example is a withdrawal: two requests both read a balance of one hundred, both check that fifty is available, and both subtract fifty and save. The final balance is fifty instead of zero, so we lost an update. In memory, the fix is to make the check and the update atomic, with a lock or an atomic class. In a real service with several instances, a Java lock isn't enough, so I do it in the database: a conditional update that subtracts fifty only if the balance is still at least fifty, in one UPDATE statement, or optimistic locking with a version column.",
    keyPhrases: ["depends on the timing", "shared data", "we lost an update", "make the check and the update atomic", "a conditional update"]
  },
  {
    category: 'JAVA_CORE',
    question: "How do atomic classes and compare-and-swap work?",
    questionVi: "Các lớp atomic và compare-and-swap hoạt động thế nào?",
    outline: [
      {en: "CAS: update only if the value is still the expected one", vi: "CAS: chỉ cập nhật nếu giá trị vẫn là giá trị mong đợi"},
      {en: "Lock-free retry loop in AtomicInteger, AtomicReference", vi: "Vòng lặp thử lại không khóa trong AtomicInteger, AtomicReference"},
      {en: "LongAdder for high contention; the ABA problem", vi: "LongAdder khi tranh chấp cao; vấn đề ABA"}
    ],
    answer: "Compare-and-swap is a CPU instruction that says: set this memory location to a new value, but only if it still contains the value I expect. Classes like AtomicInteger use it in a loop. To increment, they read the current value, try to swap it for value plus one, and if another thread changed it in between, they simply retry. There's no lock, so threads never block or deadlock. Under very high contention, many threads keep retrying, so for counters that are written a lot and read rarely, LongAdder is better, because it spreads the updates across several cells. One known issue is the ABA problem, where a value changes and changes back, which AtomicStampedReference solves with a version.",
    keyPhrases: ["only if it still contains the value I expect", "they simply retry", "never block or deadlock", "LongAdder", "the ABA problem"]
  },
  {
    category: 'JAVA_CORE',
    question: "ReentrantLock vs synchronized - when would you use ReentrantLock?",
    questionVi: "ReentrantLock và synchronized - khi nào dùng ReentrantLock?",
    outline: [
      {en: "Both are reentrant and give mutual exclusion and visibility", vi: "Cả hai đều reentrant, đảm bảo loại trừ lẫn nhau và visibility"},
      {en: "ReentrantLock adds tryLock, timeouts, interruptible waits, fairness, conditions", vi: "ReentrantLock có thêm tryLock, timeout, chờ có thể ngắt, công bằng, condition"},
      {en: "Must unlock in finally; synchronized is simpler", vi: "Phải unlock trong finally; synchronized đơn giản hơn"}
    ],
    answer: "Both give mutual exclusion and memory visibility, and both are reentrant, so the same thread can acquire the lock again. synchronized is simpler, because the lock is released automatically when the block ends, even with an exception. I use ReentrantLock when I need more control: tryLock with a timeout to avoid waiting forever or to prevent deadlocks, a lock that can be interrupted, a fair lock, or several Condition objects for different wait queues. The cost is that I must always call unlock in a finally block. Before Java 24, synchronized could also pin virtual threads during blocking I/O, so ReentrantLock was recommended there, but that limitation has been removed in newer versions.",
    keyPhrases: ["mutual exclusion and memory visibility", "released automatically", "tryLock with a timeout", "unlock in a finally block", "pin virtual threads"]
  },
  {
    category: 'JAVA_CORE',
    question: "What is ThreadLocal, and what are the risks?",
    questionVi: "ThreadLocal là gì, và có những rủi ro gì?",
    outline: [
      {en: "One value per thread: request context, transaction, security context", vi: "Mỗi thread một giá trị: ngữ cảnh request, transaction, security context"},
      {en: "Thread pools reuse threads: always remove() in finally", vi: "Thread pool tái sử dụng thread: luôn gọi remove() trong finally"},
      {en: "Doesn't flow to async threads; ScopedValue as a newer option", vi: "Không tự truyền sang thread bất đồng bộ; ScopedValue là lựa chọn mới hơn"}
    ],
    answer: "ThreadLocal gives each thread its own copy of a variable. Spring uses it a lot: the current transaction, the security context and the request attributes are all stored per thread. The main risk comes from thread pools. A server thread handles many requests over its life, so if I set a value and don't remove it, the next request on that thread can see the previous user's data, and the object can also leak memory. So I always clear it in a finally block. Another limitation is that the value doesn't follow the work to another thread, like an @Async method or a CompletableFuture, so I pass the context explicitly. Newer Java versions also offer ScopedValue, which is safer with virtual threads.",
    keyPhrases: ["its own copy of a variable", "the security context", "the previous user's data", "clear it in a finally block", "ScopedValue"]
  },
  {
    category: 'JAVA_CORE',
    question: "How do you choose the size of a thread pool?",
    questionVi: "Bạn chọn kích thước thread pool như thế nào?",
    outline: [
      {en: "CPU-bound: about the number of cores", vi: "Việc nặng CPU: khoảng bằng số core"},
      {en: "I/O-bound: more threads, based on wait time; or virtual threads", vi: "Việc nặng I/O: nhiều thread hơn, dựa trên thời gian chờ; hoặc virtual thread"},
      {en: "Bounded queue and rejection policy; measure", vi: "Hàng đợi có giới hạn và chính sách từ chối; đo đạc"}
    ],
    answer: "It depends on the kind of work. For CPU-bound tasks, like calculations, about the number of cores is enough, because more threads just cause context switching. For I/O-bound tasks, threads spend most of their time waiting, so we can have more. A common rule is the number of cores times the sum of one and the ratio of wait time to compute time. But the downstream limit matters too: there's no point in having two hundred threads if the database pool has twenty connections. I always use a bounded queue and a clear rejection policy, instead of an unbounded queue that hides overload until we run out of memory. Then I tune it with metrics. For blocking I/O on Java 21 or later, virtual threads often remove the need to tune at all.",
    keyPhrases: ["CPU-bound", "context switching", "I/O-bound", "the downstream limit", "a bounded queue"]
  },
  {
    category: 'JAVA_CORE',
    question: "What causes ConcurrentModificationException, and how do you avoid it?",
    questionVi: "ConcurrentModificationException do đâu, và làm sao tránh?",
    outline: [
      {en: "Modifying a collection while iterating over it, even in one thread", vi: "Sửa collection khi đang duyệt nó, kể cả trong một thread"},
      {en: "Use Iterator.remove() or removeIf", vi: "Dùng Iterator.remove() hoặc removeIf"},
      {en: "Concurrent collections for multi-threaded access", vi: "Collection đồng thời cho truy cập đa luồng"}
    ],
    answer: "Despite the name, it often happens in a single thread. If I loop over an ArrayList with a for-each loop and remove an element inside the loop, the iterator detects that the list was modified and throws the exception. It's a fail-fast check. The simple fixes are to call remove on the iterator itself, or better, use removeIf, or build a new filtered list with a stream. When several threads really share a collection, I use a concurrent collection, like ConcurrentHashMap, or CopyOnWriteArrayList when reads are much more frequent than writes. Their iterators don't throw this exception.",
    keyPhrases: ["in a single thread", "a fail-fast check", "remove on the iterator", "removeIf", "CopyOnWriteArrayList"]
  },
  {
    category: 'JAVA_CORE',
    question: "What are CountDownLatch and Semaphore used for?",
    questionVi: "CountDownLatch và Semaphore dùng để làm gì?",
    outline: [
      {en: "CountDownLatch: wait until N events happen; one-time", vi: "CountDownLatch: chờ cho tới khi N sự kiện xảy ra; dùng một lần"},
      {en: "Semaphore: limit how many threads access a resource at once", vi: "Semaphore: giới hạn số thread truy cập tài nguyên cùng lúc"},
      {en: "Often replaced by CompletableFuture.allOf or a rate limiter", vi: "Thường được thay bằng CompletableFuture.allOf hoặc rate limiter"}
    ],
    answer: "A CountDownLatch lets one or more threads wait until a number of events have happened. I create it with a count, each worker calls countDown when it finishes, and the main thread calls await. It can't be reset, so it's one-time. I've used it mostly in tests, to wait until several messages are consumed. A Semaphore controls how many threads can use a resource at the same time. For example, if a partner API allows only five concurrent calls, a semaphore with five permits makes sure we never exceed that. In modern code, CompletableFuture.allOf often replaces a latch, and a Resilience4j bulkhead does the semaphore's job with metrics.",
    keyPhrases: ["wait until a number of events", "calls countDown", "it can't be reset", "five permits", "bulkhead"]
  },

  // ---------- ANGULAR EXTRAS ----------
  {
    category: 'ANGULAR',
    question: "switchMap vs mergeMap vs concatMap vs exhaustMap - when do you use each?",
    questionVi: "switchMap, mergeMap, concatMap, exhaustMap - khi nào dùng cái nào?",
    outline: [
      {en: "switchMap cancels the previous inner request: search boxes", vi: "switchMap hủy request trước: ô tìm kiếm"},
      {en: "mergeMap runs in parallel; concatMap keeps order", vi: "mergeMap chạy song song; concatMap giữ thứ tự"},
      {en: "exhaustMap ignores new events while busy: submit buttons", vi: "exhaustMap bỏ qua sự kiện mới khi đang bận: nút submit"}
    ],
    answer: "All four map each value to an inner observable, like an HTTP request, but they handle overlap differently. switchMap cancels the previous inner request when a new value arrives, so it's perfect for a search box, where only the latest query matters. mergeMap runs all inner requests in parallel, which is fine when order doesn't matter, like deleting several items. concatMap waits for each request to finish before starting the next, so it keeps the order, for example when saving changes one after another. exhaustMap ignores new values while one request is still running, which is ideal for a submit button, so a double click doesn't create two orders.",
    keyPhrases: ["an inner observable", "cancels the previous inner request", "runs all inner requests in parallel", "keeps the order", "ignores new values"]
  },
  {
    category: 'ANGULAR',
    question: "What does zoneless change detection mean in modern Angular?",
    questionVi: "Change detection không dùng Zone (zoneless) trong Angular hiện đại nghĩa là gì?",
    outline: [
      {en: "Zone.js patched async APIs to trigger checks everywhere", vi: "Zone.js vá các API bất đồng bộ để kích hoạt kiểm tra ở mọi nơi"},
      {en: "Zoneless: Angular reacts to signals, inputs, events and markForCheck", vi: "Zoneless: Angular phản ứng với signal, input, event và markForCheck"},
      {en: "Smaller bundle, fewer checks, clearer data flow", vi: "Bundle nhỏ hơn, ít lượt kiểm tra hơn, luồng dữ liệu rõ ràng hơn"}
    ],
    answer: "Traditionally, Angular used Zone.js, which patched browser APIs like setTimeout, promises and events, so after any async task Angular checked the component tree, even if nothing relevant changed. In zoneless mode, which is the default in recent versions, Zone.js is removed. Angular schedules change detection only when it knows something changed: a signal that a template reads, an input change, a template event handler, or an explicit markForCheck. The benefits are a smaller bundle, fewer unnecessary checks and easier debugging. The requirement is that state the UI depends on is held in signals, or updated in a way Angular is notified about, which fits well with OnPush components.",
    keyPhrases: ["patched browser APIs", "checked the component tree", "only when it knows something changed", "a smaller bundle", "held in signals"]
  },
  {
    category: 'ANGULAR',
    question: "How does dependency injection work in Angular?",
    questionVi: "Dependency injection trong Angular hoạt động thế nào?",
    outline: [
      {en: "Injectors form a hierarchy: environment and element injectors", vi: "Injector tạo thành cây phân cấp: environment injector và element injector"},
      {en: "providedIn: 'root' for app-wide singletons, tree-shakable", vi: "providedIn: 'root' cho singleton toàn ứng dụng, có thể tree-shake"},
      {en: "inject() function; component-level providers for scoped state", vi: "Hàm inject(); provider cấp component cho state theo phạm vi"}
    ],
    answer: "Angular has a hierarchy of injectors. When a component asks for a dependency, Angular looks in the component's own element injector first, then up through its parents, and finally in the environment injectors, like the root. Most services use providedIn root, which creates one singleton for the whole app, and if nobody uses it, it's tree-shaken out of the bundle. If I need a separate instance per feature or per component, for example state for one form, I add it to the component's providers, and it's destroyed with the component. In modern Angular, I usually use the inject function instead of constructor parameters, and InjectionTokens for configuration values.",
    keyPhrases: ["a hierarchy of injectors", "element injector", "providedIn root", "tree-shaken", "the inject function"]
  },
  {
    category: 'ANGULAR',
    question: "How do you protect routes in Angular, and is that enough for security?",
    questionVi: "Bạn bảo vệ route trong Angular thế nào, và như vậy đã đủ an toàn chưa?",
    outline: [
      {en: "Functional guards: canActivate, canMatch", vi: "Guard dạng hàm: canActivate, canMatch"},
      {en: "Redirect with a UrlTree; canMatch avoids loading the chunk", vi: "Chuyển hướng bằng UrlTree; canMatch tránh tải chunk"},
      {en: "Not security: the server must check every request", vi: "Không phải bảo mật: server phải kiểm tra mọi request"}
    ],
    answer: "I use functional guards. canActivate checks, for example, that the user is logged in, and returns true or a UrlTree to redirect to the login page. For admin areas, I prefer canMatch, because if it fails, Angular doesn't even load the lazy chunk for that route. But guards are only about user experience. Everything in the browser can be changed by the user, so a guard doesn't protect any data. The real protection is on the server: every API call checks the token, the role and the ownership of the resource. The client just hides what the user can't use, so they don't see confusing errors.",
    keyPhrases: ["functional guards", "a UrlTree", "canMatch", "only about user experience", "the real protection is on the server"]
  },
  {
    category: 'ANGULAR',
    question: "How do you test Angular components and services?",
    questionVi: "Bạn kiểm thử component và service Angular như thế nào?",
    outline: [
      {en: "Unit tests with TestBed; mock HTTP with HttpTestingController", vi: "Unit test với TestBed; giả lập HTTP bằng HttpTestingController"},
      {en: "Test behavior through the DOM: what the user sees and clicks", vi: "Kiểm tra hành vi qua DOM: những gì người dùng thấy và bấm"},
      {en: "A few end-to-end tests for critical flows", vi: "Một vài test end-to-end cho luồng quan trọng"}
    ],
    answer: "For services, I write plain unit tests, and for HTTP I use HttpTestingController to check the request URL and body and return a fake response. For components, I use TestBed, set inputs, trigger events, and assert on what the user actually sees in the DOM, like a loading state, an empty state or an error message, rather than on private fields. I replace real services with simple fakes. Signals make this easier, because I can set a value and check the rendered result right away. On top of that, a small number of end-to-end tests with Playwright cover the critical flows, like login and payment, against a real backend or a mock server.",
    keyPhrases: ["HttpTestingController", "assert on what the user actually sees", "simple fakes", "Signals make this easier", "end-to-end tests with Playwright"]
  },
  // ---------- VALUES-BASED (consulting / PwC style) ----------
  {
    category: 'PROJECT',
    question: "How do your personal values align with our values?",
    questionVi: "Giá trị cá nhân của bạn phù hợp với giá trị của công ty chúng tôi như thế nào?",
    outline: [
      {en: "Name two or three of their values you really share", vi: "Nêu hai hoặc ba giá trị của công ty mà bạn thật sự có"},
      {en: "Prove each one with a short real example", vi: "Chứng minh mỗi giá trị bằng một ví dụ thật ngắn gọn"},
      {en: "Connect to how you will work in this role", vi: "Liên hệ với cách bạn sẽ làm việc ở vị trí này"}
    ],
    answer: "Two of your values really match how I work: acting with integrity and working together. On integrity, when I found that a report I had delivered contained a rounding error, I told my manager and the client the same day, even though nobody had noticed, and we sent a corrected version. On working together, I like to share knowledge: I run short tech-sharing sessions and I pair with newer teammates. I also like the idea of reimagining the possible. I enjoy improving processes, like when I cut our build time by more than half. In a client-facing role, those values build trust, and that's what I want to bring here.",
    keyPhrases: ["acting with integrity", "even though nobody had noticed", "working together", "reimagining the possible", "build trust"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you had to correct someone else's mistake.",
    questionVi: "Hãy kể về một lần bạn phải sửa lỗi của người khác.",
    outline: [
      {en: "Situation: the mistake and its impact", vi: "Bối cảnh: lỗi là gì và ảnh hưởng ra sao"},
      {en: "Action: fix it, talk to the person privately and kindly", vi: "Hành động: sửa lỗi, trao đổi riêng và tế nhị với người đó"},
      {en: "Result: problem solved, relationship kept, process improved", vi: "Kết quả: vấn đề được giải quyết, giữ được quan hệ, cải thiện quy trình"}
    ],
    answer: "A teammate merged a migration that dropped a column the running code still used, and staging broke just before a demo. First, I focused on the problem, not on the person: I wrote a follow-up migration that restored the column, tested it, and got staging working again within an hour. Then I talked to my teammate privately. I explained what happened and why, without blaming, and showed how we could test migrations locally against a copy of the data. He appreciated that I didn't make it public. Afterwards, we added a migration check to our pipeline, so the same mistake is caught automatically.",
    keyPhrases: ["focused on the problem, not on the person", "a follow-up migration", "talked to my teammate privately", "without blaming", "caught automatically"]
  },
  {
    category: 'PROJECT',
    question: "Describe a time you had to protect confidential or sensitive information.",
    questionVi: "Hãy kể về một lần bạn phải bảo vệ thông tin mật hoặc nhạy cảm.",
    outline: [
      {en: "What data and what the risk was", vi: "Dữ liệu gì và rủi ro là gì"},
      {en: "What you did: refuse shortcuts, mask, restrict access", vi: "Bạn đã làm gì: từ chối đi tắt, che dữ liệu, giới hạn quyền truy cập"},
      {en: "Result and lesson", vi: "Kết quả và bài học"}
    ],
    answer: "While debugging a production issue, a colleague asked me to export some real customer transactions to a spreadsheet and share it in our team chat, so we could analyze it faster. I understood the pressure, but that data included names and card details, and sharing it that way would break our data policy. Instead, I suggested we query the data inside the approved environment, and I wrote a small script to create a masked copy for analysis, with card numbers and names removed. We still found the bug the same day. I also noticed that our application logs contained full email addresses, so I raised a ticket and we masked them.",
    keyPhrases: ["I understood the pressure", "break our data policy", "the approved environment", "a masked copy", "raised a ticket"]
  },
  {
    category: 'PROJECT',
    question: "Describe a time you worked in a group and a problem arose.",
    questionVi: "Hãy kể về một lần bạn làm việc nhóm và có vấn đề phát sinh.",
    outline: [
      {en: "Situation: the team, the goal and the problem", vi: "Bối cảnh: nhóm, mục tiêu và vấn đề"},
      {en: "Action: bring it into the open, agree on a plan", vi: "Hành động: đưa vấn đề ra thảo luận công khai, thống nhất kế hoạch"},
      {en: "Result and what the team learned", vi: "Kết quả và bài học của nhóm"}
    ],
    answer: "In a team of five, we were building an integration with a partner bank, and halfway through the sprint we realized that the frontend and backend had understood the API contract differently. Both sides had already built a lot. Instead of arguing about who was right, I suggested a thirty-minute meeting where we wrote down the contract together in an OpenAPI file and checked it against the partner's documentation. We agreed on one version, split the changes fairly, and finished only one day late. After that, the team decided to agree on the API contract before writing any code, and we didn't have that problem again.",
    keyPhrases: ["understood the API contract differently", "instead of arguing about who was right", "wrote down the contract together", "split the changes fairly", "before writing any code"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you worked with a difficult stakeholder or client.",
    questionVi: "Hãy kể về một lần bạn làm việc với một khách hàng hoặc bên liên quan khó tính.",
    outline: [
      {en: "Why they were difficult: understand their pressure", vi: "Vì sao họ khó tính: hiểu áp lực của họ"},
      {en: "Action: listen, make progress visible, agree in writing", vi: "Hành động: lắng nghe, làm cho tiến độ hiển thị rõ, thống nhất bằng văn bản"},
      {en: "Result: trust improved", vi: "Kết quả: niềm tin được cải thiện"}
    ],
    answer: "We had a client manager who changed requirements in almost every meeting and was frustrated that we were 'always late'. I asked for a short one-on-one to understand her side, and learned that her own management kept changing their priorities, so she was under a lot of pressure. We agreed on two things: a weekly demo, so she could see progress, and a simple change log, where every new request was written down with its impact on the timeline before we accepted it. Within a month, the meetings became much calmer, and she started to use our change log in her own reports to her management.",
    keyPhrases: ["to understand her side", "under a lot of pressure", "a weekly demo", "a simple change log", "its impact on the timeline"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you had to adapt to a big change.",
    questionVi: "Hãy kể về một lần bạn phải thích nghi với một thay đổi lớn.",
    outline: [
      {en: "The change: new tech, team, priority or process", vi: "Sự thay đổi: công nghệ, nhóm, ưu tiên hoặc quy trình mới"},
      {en: "How you adapted: learned fast, stayed positive, helped others", vi: "Cách bạn thích nghi: học nhanh, giữ tinh thần tích cực, giúp người khác"},
      {en: "The result", vi: "Kết quả"}
    ],
    answer: "Two months into a project, the client decided to move from their on-premise servers to the cloud, which changed our deployment, our configuration and even some of our design. Some people in the team were frustrated, because a lot of work had to be redone. I tried to focus on what we could control. I volunteered to learn the basics of the new platform, set up the first pipeline, and wrote a short guide so the others could move their services quickly. We delivered the first release on the cloud only two weeks later than the original plan, and the new setup made our later releases much faster.",
    keyPhrases: ["changed our deployment", "focus on what we could control", "I volunteered to learn", "wrote a short guide", "much faster"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you made a decision based on integrity, even though it was harder.",
    questionVi: "Hãy kể về một lần bạn đưa ra quyết định dựa trên sự chính trực, dù điều đó khó hơn.",
    outline: [
      {en: "The easy option and the right option", vi: "Lựa chọn dễ và lựa chọn đúng"},
      {en: "Why you chose the right one and how you communicated it", vi: "Vì sao bạn chọn cách đúng và bạn đã truyền đạt thế nào"},
      {en: "The outcome and what it showed", vi: "Kết quả và điều nó chứng minh"}
    ],
    answer: "Before a release, I found that one of our test reports showed all green only because a flaky test had been disabled weeks earlier, and that test covered refunds. The easy option was to release on time and look at it later, since the client was waiting. But releasing something I knew wasn't really tested didn't feel right, especially for money. I told my lead and the client honestly, and proposed a one-day delay. We fixed the test, and it actually found a bug where some refunds were calculated twice. The client was disappointed about the delay at first, but afterwards they said they trusted our reports much more.",
    keyPhrases: ["the easy option was", "didn't feel right", "told my lead and the client honestly", "a one-day delay", "trusted our reports much more"]
  },
  // ---------- TESTING / GIT / CI-CD ----------
  {
    category: 'SPRING',
    question: "What is the difference between a mock, a stub and a fake?",
    questionVi: "Mock, stub và fake khác nhau thế nào?",
    outline: [
      {en: "Stub: returns canned answers", vi: "Stub: trả về câu trả lời dựng sẵn"},
      {en: "Mock: also verifies how it was called", vi: "Mock: còn kiểm tra cách nó được gọi"},
      {en: "Fake: a simple working implementation, like an in-memory repository", vi: "Fake: một bản cài đặt đơn giản chạy được, như repository trong bộ nhớ"}
    ],
    answer: "They're all test doubles that replace a real dependency. A stub just returns prepared answers, for example a price service that always returns one hundred, so I can test the logic that uses it. A mock does that too, but I also verify the interaction, like checking that the email service was called exactly once with the right address. A fake is a lightweight working implementation, such as an in-memory repository or a fake clock. In practice, I prefer stubs and fakes, and I verify interactions only when the call itself is the behavior I care about, like sending a notification. Too many mocks make tests fragile, because they test the implementation instead of the result.",
    keyPhrases: ["test doubles", "prepared answers", "verify the interaction", "a lightweight working implementation", "test the implementation instead of the result"]
  },
  {
    category: 'SPRING',
    question: "What is TDD, and do you use it?",
    questionVi: "TDD là gì, và bạn có áp dụng không?",
    outline: [
      {en: "Red, green, refactor", vi: "Đỏ, xanh, refactor"},
      {en: "Benefits: design feedback, safety net, regression tests for bugs", vi: "Lợi ích: phản hồi về thiết kế, lưới an toàn, test hồi quy cho bug"},
      {en: "Pragmatic: always for business rules and bug fixes", vi: "Thực tế: luôn dùng cho quy tắc nghiệp vụ và sửa bug"}
    ],
    answer: "Test-driven development is a short cycle: write a failing test for the next small behavior, write the simplest code to make it pass, then refactor while the tests stay green. The main benefit for me is design feedback: if a class is hard to test, it usually has too many responsibilities. It also leaves a safety net for future changes. I use it in a pragmatic way. For business rules, like fee calculations or settlement logic, and for every bug fix, I always start with a failing test, because it proves the bug exists and that my fix works. For exploratory work, like trying a new library, I prototype first and add tests once the design is clear.",
    keyPhrases: ["write a failing test", "the simplest code", "refactor while the tests stay green", "design feedback", "proves the bug exists"]
  },
  {
    category: 'SPRING',
    question: "How do you deal with flaky tests?",
    questionVi: "Bạn xử lý test chập chờn (flaky test) như thế nào?",
    outline: [
      {en: "Flaky tests destroy trust in the pipeline", vi: "Test chập chờn phá hủy niềm tin vào pipeline"},
      {en: "Common causes: timing, shared state, order, real clock, external services", vi: "Nguyên nhân hay gặp: thời gian, state dùng chung, thứ tự chạy, đồng hồ thật, dịch vụ bên ngoài"},
      {en: "Quarantine with a ticket, then fix the root cause", vi: "Cách ly kèm ticket, rồi sửa nguyên nhân gốc"}
    ],
    answer: "A flaky test is worse than no test, because people learn to ignore red builds. When I find one, I first try to reproduce it, for example by running it many times or in a different order. The usual causes are timing, like a Thread.sleep instead of waiting for a condition, shared state between tests, depending on the order of results without an ORDER BY, the real system clock, or a real external service. The fixes are to wait for conditions with something like Awaitility, isolate the test data, inject a fixed clock, and stub external calls. If I can't fix it immediately, I quarantine it with a ticket and an owner, but never just delete or ignore it.",
    keyPhrases: ["people learn to ignore red builds", "waiting for a condition", "shared state between tests", "inject a fixed clock", "quarantine it with a ticket"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What is contract testing, and when is it useful?",
    questionVi: "Contract testing là gì, và khi nào hữu ích?",
    outline: [
      {en: "Verifies that a provider still meets what consumers expect", vi: "Kiểm tra provider vẫn đáp ứng điều mà consumer mong đợi"},
      {en: "Consumer-driven contracts, like Pact or Spring Cloud Contract", vi: "Contract do consumer định nghĩa, như Pact hoặc Spring Cloud Contract"},
      {en: "Faster and more stable than end-to-end tests across services", vi: "Nhanh và ổn định hơn test end-to-end giữa nhiều service"}
    ],
    answer: "In a system with several services, the most common breakages happen at the boundaries, when a provider renames a field or changes a status code, and a consumer breaks. End-to-end tests across all services catch that, but they're slow and flaky. Contract testing checks each side separately. The consumer writes down what it expects, like the request and the fields it reads from the response, and that contract is shared. The provider's pipeline then verifies it still satisfies every consumer's contract. Tools like Pact or Spring Cloud Contract do this. It's most useful when different teams own the services and release independently.",
    keyPhrases: ["at the boundaries", "checks each side separately", "the consumer writes down what it expects", "satisfies every consumer's contract", "release independently"]
  },
  {
    category: 'PROJECT',
    question: "Git merge vs rebase - which do you use and why?",
    questionVi: "Git merge và rebase - bạn dùng cái nào và vì sao?",
    outline: [
      {en: "Merge keeps history and adds a merge commit", vi: "Merge giữ nguyên lịch sử và thêm một merge commit"},
      {en: "Rebase replays commits for a linear history", vi: "Rebase áp lại các commit để lịch sử thẳng hàng"},
      {en: "Never rebase shared branches; follow the team convention", vi: "Không rebase nhánh dùng chung; tuân theo quy ước của nhóm"}
    ],
    answer: "Both integrate changes from one branch into another. A merge keeps the full history as it happened and adds a merge commit, so it's safe and honest, but the history can get messy. A rebase replays my commits on top of the target branch, so the history is linear and easier to read. I usually rebase my own feature branch on the latest main before opening a pull request, so conflicts are resolved by me, on my branch. The golden rule is never to rebase a branch that other people are working on, because it rewrites commits they already have. In the end, I follow the team's convention, for example squash merging pull requests into main.",
    keyPhrases: ["a merge commit", "replays my commits", "the history is linear", "never to rebase a branch that other people are working on", "squash merging"]
  },
  {
    category: 'PROJECT',
    question: "How do you resolve a difficult merge conflict?",
    questionVi: "Bạn giải quyết một merge conflict khó như thế nào?",
    outline: [
      {en: "Understand both changes and their intent", vi: "Hiểu cả hai thay đổi và mục đích của chúng"},
      {en: "Talk to the other author if unsure", vi: "Hỏi tác giả kia nếu không chắc"},
      {en: "Run the tests after resolving; keep branches short-lived", vi: "Chạy test sau khi giải quyết; giữ nhánh sống ngắn"}
    ],
    answer: "First, I don't just pick my version or theirs. I look at both changes and try to understand the intent of each one, using the commit messages and the pull requests. If the conflict is in logic I don't fully understand, I message the other developer and we resolve it together, sometimes in a quick call. After resolving, I build and run the tests, because code can merge cleanly and still be broken. To avoid painful conflicts in the first place, I keep branches short-lived, pull from main often, and keep pull requests small and focused.",
    keyPhrases: ["the intent of each one", "resolve it together", "merge cleanly and still be broken", "short-lived", "small and focused"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What does a good CI/CD pipeline look like?",
    questionVi: "Một pipeline CI/CD tốt trông như thế nào?",
    outline: [
      {en: "Fast feedback: build, unit tests, static analysis on every push", vi: "Phản hồi nhanh: build, unit test, phân tích tĩnh mỗi lần push"},
      {en: "Build once, promote the same artifact through environments", vi: "Build một lần, đưa cùng một artifact qua các môi trường"},
      {en: "Automated deploys with gates, rollback and monitoring", vi: "Deploy tự động có cổng kiểm soát, rollback và giám sát"}
    ],
    answer: "On every push, the pipeline should give fast feedback: compile, run unit tests, static analysis and a dependency vulnerability scan, ideally in a few minutes. On the main branch, it builds the artifact, like a Docker image, only once, and promotes that exact image through the environments, so what we tested is what we release. Integration tests and database migrations run against staging, and the deployment to production is automated, with a manual approval or a canary step if the risk is high. Every deployment must be easy to roll back, and it should be connected to monitoring, so we see quickly if error rates go up. Secrets come from the platform, never from the repository.",
    keyPhrases: ["fast feedback", "only once", "what we tested is what we release", "easy to roll back", "connected to monitoring"]
  },
  // ---------- JAVA FUNDAMENTALS ----------
  {
    category: 'JAVA_CORE',
    question: "Abstract class vs interface - when do you use each?",
    questionVi: "Abstract class và interface - khi nào dùng cái nào?",
    outline: [
      {en: "Interface: a contract; a class can implement many", vi: "Interface: một hợp đồng; một class có thể implement nhiều interface"},
      {en: "Abstract class: shared state and code; single inheritance", vi: "Abstract class: chia sẻ state và code; chỉ kế thừa một lớp"},
      {en: "Default methods blur the line; prefer interfaces plus composition", vi: "Default method làm ranh giới mờ đi; ưu tiên interface cùng composition"}
    ],
    answer: "An interface defines a contract: what a type can do. A class can implement many interfaces, and since Java 8 they can have default and static methods, but no instance state. An abstract class can have fields, constructors and partly implemented behavior, but a class can extend only one. So I use an interface for a capability or a role, like PaymentProvider, with several implementations. I use an abstract class when several closely related classes share real state and code, like a base class for scheduled jobs that handles locking and logging. In general, I prefer interfaces plus composition, because deep inheritance hierarchies are hard to change.",
    keyPhrases: ["defines a contract", "implement many interfaces", "default and static methods", "extend only one", "interfaces plus composition"]
  },
  {
    category: 'JAVA_CORE',
    question: "What is the difference between double equals and the equals method?",
    questionVi: "== và equals() khác nhau thế nào?",
    outline: [
      {en: "== compares references for objects, values for primitives", vi: "== so sánh tham chiếu với object, so sánh giá trị với kiểu nguyên thủy"},
      {en: "equals compares logical content when overridden", vi: "equals so sánh nội dung logic khi được override"},
      {en: "Traps: Integer cache, string pool, BigDecimal scale", vi: "Bẫy: Integer cache, string pool, scale của BigDecimal"}
    ],
    answer: "For primitives, double equals compares the values. For objects, it compares references, so it's true only if both variables point to the same object in memory. The equals method compares logical content, if the class overrides it, like String, Integer or a record. There are some classic traps. Two Integer objects with the value one hundred may be equal with double equals because of the Integer cache, but with one thousand they're usually not. String literals can also look equal with double equals because of the string pool, which hides bugs. And BigDecimal's equals also compares the scale, so two point zero and two point zero zero are not equal, which is why I use compareTo for amounts.",
    keyPhrases: ["compares references", "compares logical content", "the Integer cache", "the string pool", "compares the scale"]
  },
  {
    category: 'JAVA_CORE',
    question: "Is Java pass-by-value or pass-by-reference?",
    questionVi: "Java truyền tham trị hay tham chiếu?",
    outline: [
      {en: "Always pass-by-value", vi: "Luôn luôn là truyền tham trị"},
      {en: "For objects, the value passed is a copy of the reference", vi: "Với object, giá trị được truyền là bản sao của tham chiếu"},
      {en: "You can mutate the object, but not reassign the caller's variable", vi: "Có thể thay đổi object, nhưng không gán lại được biến của bên gọi"}
    ],
    answer: "Java is always pass-by-value. For primitives, the method gets a copy of the value. For objects, the value that is copied is the reference. So inside the method, I can change the object's state, for example add an item to a list, and the caller will see that change, because both references point to the same object. But if I assign a new object to the parameter, the caller's variable doesn't change, because I only replaced my local copy of the reference. That's why a swap method that swaps two object parameters doesn't work in Java.",
    keyPhrases: ["always pass-by-value", "a copy of the value", "the value that is copied is the reference", "my local copy of the reference", "a swap method"]
  },
  {
    category: 'JAVA_CORE',
    question: "What is the difference between final, finally and finalize?",
    questionVi: "final, finally và finalize khác nhau thế nào?",
    outline: [
      {en: "final: can't reassign, override or extend", vi: "final: không gán lại, không override, không kế thừa"},
      {en: "finally: block that always runs after try/catch", vi: "finally: khối luôn chạy sau try/catch"},
      {en: "finalize: deprecated GC hook; use try-with-resources or Cleaner", vi: "finalize: hook GC đã bị deprecated; dùng try-with-resources hoặc Cleaner"}
    ],
    answer: "They just sound similar. final is a modifier: a final variable can't be reassigned, a final method can't be overridden, and a final class can't be extended, like String. finally is a block after try and catch that always runs, whether an exception was thrown or not, so it's used for cleanup, like releasing a lock. finalize was a method the garbage collector might call before removing an object, but it was unreliable and slow, and it's deprecated for removal. Today, for resources, I use try-with-resources, and in rare cases the Cleaner API.",
    keyPhrases: ["a modifier", "can't be reassigned", "always runs", "deprecated for removal", "try-with-resources"]
  },
  {
    category: 'JAVA_CORE',
    question: "String vs StringBuilder vs StringBuffer?",
    questionVi: "String, StringBuilder và StringBuffer khác nhau thế nào?",
    outline: [
      {en: "String: immutable; each change creates a new object", vi: "String: bất biến; mỗi lần đổi tạo object mới"},
      {en: "StringBuilder: mutable, fast, not synchronized", vi: "StringBuilder: thay đổi được, nhanh, không đồng bộ"},
      {en: "StringBuffer: synchronized, rarely needed today", vi: "StringBuffer: có đồng bộ, ngày nay hiếm khi cần"}
    ],
    answer: "String is immutable, so every concatenation creates a new object. That's fine for a few values, and the compiler already optimizes simple concatenation in one expression. But in a loop that builds a large string, it creates a lot of garbage, so I use StringBuilder, which is mutable and appends into an internal buffer. StringBuffer does the same, but all its methods are synchronized, so it's slower, and in practice it's rarely needed, because a builder is usually local to one method. For joining a list with a separator, String.join or Collectors.joining is the most readable option.",
    keyPhrases: ["every concatenation creates a new object", "a lot of garbage", "an internal buffer", "all its methods are synchronized", "Collectors.joining"]
  },
  {
    category: 'JAVA_CORE',
    question: "What does static mean in Java, and what are the risks?",
    questionVi: "static trong Java nghĩa là gì, và có rủi ro gì?",
    outline: [
      {en: "Belongs to the class, not to an instance", vi: "Thuộc về class, không thuộc về instance"},
      {en: "Good for constants and pure utility methods", vi: "Phù hợp cho hằng số và hàm tiện ích thuần"},
      {en: "Risks: shared mutable state, hard to test, memory leaks", vi: "Rủi ro: state dùng chung có thể thay đổi, khó test, rò rỉ bộ nhớ"}
    ],
    answer: "A static member belongs to the class itself, not to any instance, so there's only one copy, shared by everyone. That's perfect for constants, like a maximum retry count, and for pure utility methods without state. The risks come from static mutable state. A static map or counter is shared across all threads and all requests, so it needs to be thread-safe, it can grow forever and leak memory, and it makes tests depend on each other. Static methods also can't be replaced easily in tests. So in a Spring application, I put shared logic in singleton beans and inject them, instead of using static state.",
    keyPhrases: ["belongs to the class itself", "only one copy", "static mutable state", "leak memory", "singleton beans"]
  },
  {
    category: 'JAVA_CORE',
    question: "How does try-with-resources work?",
    questionVi: "try-with-resources hoạt động thế nào?",
    outline: [
      {en: "Resources implementing AutoCloseable are closed automatically", vi: "Tài nguyên implement AutoCloseable được đóng tự động"},
      {en: "Closed in reverse order, even on exceptions", vi: "Đóng theo thứ tự ngược, kể cả khi có exception"},
      {en: "Suppressed exceptions are kept, not lost", vi: "Exception phụ được giữ lại, không bị mất"}
    ],
    answer: "Any object that implements AutoCloseable can be declared in the parentheses of a try statement, like an input stream, a file reader or a JDBC connection. When the block ends, normally or with an exception, Java calls close automatically, in the reverse order of declaration. It replaces the old pattern of a finally block with null checks, which was easy to get wrong. Another advantage is that if the block throws an exception and close also throws, the second one isn't lost: it's attached to the main exception as a suppressed exception. I use it for every resource I open myself, for example Playwright pages or input streams from file storage.",
    keyPhrases: ["implements AutoCloseable", "calls close automatically", "reverse order", "easy to get wrong", "suppressed exception"]
  },
  {
    category: 'JAVA_CORE',
    question: "How do you use enums effectively in Java?",
    questionVi: "Dùng enum hiệu quả trong Java như thế nào?",
    outline: [
      {en: "Type-safe fixed set of values with fields and methods", vi: "Tập giá trị cố định an toàn kiểu, có field và method"},
      {en: "EnumMap/EnumSet; exhaustive switch", vi: "EnumMap/EnumSet; switch bao phủ đầy đủ"},
      {en: "Persist by name, not by ordinal", vi: "Lưu theo tên, không theo thứ tự (ordinal)"}
    ],
    answer: "Enums give a type-safe, fixed set of values, like the status of a transaction: PENDING, SETTLED or FAILED. They're full classes, so they can have fields and methods, for example a status that knows whether it's final, or which transitions are allowed. With a switch expression, the compiler can check that every value is handled. For maps and sets keyed by an enum, EnumMap and EnumSet are very fast. One important rule: when saving to the database, I store the name as a string, with EnumType.STRING in JPA, not the ordinal, because adding a new value in the middle would silently change the meaning of existing rows.",
    keyPhrases: ["type-safe, fixed set of values", "fields and methods", "every value is handled", "EnumType.STRING", "silently change the meaning"]
  },
  {
    category: 'JAVA_CORE',
    question: "Records vs normal classes - when would you not use a record?",
    questionVi: "Record và class thường - khi nào không nên dùng record?",
    outline: [
      {en: "Records: immutable data carriers with generated methods", vi: "Record: lớp chứa dữ liệu bất biến với các method được sinh tự động"},
      {en: "Validation in the compact constructor", vi: "Kiểm tra hợp lệ trong compact constructor"},
      {en: "Not for JPA entities, mutable state, or hiding internals", vi: "Không dùng cho JPA entity, state thay đổi, hoặc khi cần ẩn chi tiết nội bộ"}
    ],
    answer: "A record is a concise way to declare an immutable data carrier. The compiler generates the constructor, accessors, equals, hashCode and toString from the components. I use them for DTOs, request and response bodies, value objects like Money, and events. I can validate inside the compact constructor, for example rejecting a negative amount. I don't use records for JPA entities, because JPA needs a no-argument constructor and mutable, proxied objects. I also avoid them when the class has a lot of behavior and internal state that shouldn't be exposed, because every component is public through its accessor. And a record holding a mutable list is only shallowly immutable, so I copy it with List.copyOf.",
    keyPhrases: ["an immutable data carrier", "the compact constructor", "for JPA entities", "every component is public", "shallowly immutable"]
  },
  {
    category: 'JAVA_CORE',
    question: "Method overloading vs overriding?",
    questionVi: "Overloading và overriding khác nhau thế nào?",
    outline: [
      {en: "Overloading: same name, different parameters, chosen at compile time", vi: "Overloading: cùng tên, khác tham số, chọn lúc biên dịch"},
      {en: "Overriding: subclass replaces behavior, chosen at runtime", vi: "Overriding: lớp con thay thế hành vi, chọn lúc runtime"},
      {en: "@Override annotation; rules for return type and exceptions", vi: "Annotation @Override; quy tắc về kiểu trả về và exception"}
    ],
    answer: "Overloading means several methods in the same class have the same name but different parameter lists, like a format method for a BigDecimal and one for a LocalDate. The compiler chooses which one to call based on the declared argument types, so it's compile-time polymorphism. Overriding means a subclass provides its own implementation of a method from the parent class or an interface, with the same signature. The JVM chooses the implementation at runtime, based on the actual object, which is runtime polymorphism. When overriding, the return type can be a subtype, it can't reduce visibility or throw broader checked exceptions, and I always add @Override, so the compiler catches a typo in the signature.",
    keyPhrases: ["different parameter lists", "compile-time polymorphism", "its own implementation", "runtime polymorphism", "I always add @Override"]
  },
  // ---------- SECURITY & AUTH ----------
  {
    category: 'SPRING',
    question: "What is the difference between authentication and authorization?",
    questionVi: "Xác thực (authentication) và phân quyền (authorization) khác nhau thế nào?",
    outline: [
      {en: "Authentication: who are you?", vi: "Xác thực: bạn là ai?"},
      {en: "Authorization: what are you allowed to do?", vi: "Phân quyền: bạn được làm gì?"},
      {en: "401 vs 403; check both on the server", vi: "401 và 403; kiểm tra cả hai ở server"}
    ],
    answer: "Authentication answers the question 'who are you?'. The user proves their identity, for example with a password and a second factor, and gets a token. Authorization answers 'what are you allowed to do?'. It checks roles, permissions and ownership for each action. In HTTP terms, a missing or invalid token should return 401 Unauthorized, which really means unauthenticated, while a valid user without permission gets 403 Forbidden. In Spring Security, authentication is handled by the filter chain, and authorization by URL rules and method security, like @PreAuthorize. The most common real bug is checking authentication but forgetting ownership, so one user can read another user's data by changing an ID.",
    keyPhrases: ["who are you", "what are you allowed to do", "401 Unauthorized", "403 Forbidden", "forgetting ownership"]
  },
  {
    category: 'SPRING',
    question: "How does the OAuth2 authorization code flow with PKCE work?",
    questionVi: "Luồng OAuth2 authorization code với PKCE hoạt động thế nào?",
    outline: [
      {en: "Redirect to the authorization server; user logs in there", vi: "Chuyển hướng tới authorization server; người dùng đăng nhập ở đó"},
      {en: "App receives a short-lived code and exchanges it for tokens", vi: "Ứng dụng nhận code ngắn hạn và đổi lấy token"},
      {en: "PKCE: code verifier and challenge prevent code interception", vi: "PKCE: code verifier và challenge chống bị đánh cắp code"}
    ],
    answer: "The app never sees the user's password. It redirects the user to the authorization server, like Google or Keycloak, with its client ID, the requested scopes, a state value against CSRF, and a PKCE code challenge, which is a hash of a random secret called the code verifier. The user logs in there and agrees, and the server redirects back to the app with a short-lived authorization code. The app then exchanges that code, together with the original code verifier, for an access token and usually a refresh token. Because only the app knows the verifier, a stolen code is useless. That's why PKCE is now recommended for all clients, especially single-page and mobile apps that can't keep a client secret.",
    keyPhrases: ["never sees the user's password", "a state value", "code verifier", "a short-lived authorization code", "a stolen code is useless"]
  },
  {
    category: 'SPRING',
    question: "Where should a web app store tokens, and how do refresh tokens work?",
    questionVi: "Ứng dụng web nên lưu token ở đâu, và refresh token hoạt động thế nào?",
    outline: [
      {en: "Short-lived access token in memory; refresh token in an HttpOnly, Secure, SameSite cookie", vi: "Access token ngắn hạn trong bộ nhớ; refresh token trong cookie HttpOnly, Secure, SameSite"},
      {en: "localStorage is readable by any XSS", vi: "localStorage có thể bị đọc bởi bất kỳ lỗi XSS nào"},
      {en: "Rotation and reuse detection; revoke on logout", vi: "Xoay vòng và phát hiện dùng lại; thu hồi khi đăng xuất"}
    ],
    answer: "I keep the access token short-lived, like fifteen minutes, and hold it only in memory in the app. The refresh token goes in an HttpOnly, Secure, SameSite cookie, so JavaScript can't read it, which limits the damage of an XSS bug. I avoid localStorage for tokens, because any injected script can read it. When the access token expires, an interceptor calls the refresh endpoint, and the cookie is sent automatically. On the server, refresh tokens are stored as hashes and rotated on every use: each refresh returns a new one and invalidates the old one. If an old token is used again, that's a sign of theft, so we revoke the whole token family. Logout revokes the token on the server too.",
    keyPhrases: ["only in memory", "HttpOnly, Secure, SameSite cookie", "any injected script can read it", "rotated on every use", "revoke the whole token family"]
  },
  {
    category: 'SPRING',
    question: "How should passwords be stored?",
    questionVi: "Mật khẩu nên được lưu như thế nào?",
    outline: [
      {en: "Never plain text or reversible encryption", vi: "Không bao giờ lưu dạng thô hay mã hóa có thể giải ngược"},
      {en: "Slow, salted hash: BCrypt, Argon2", vi: "Hàm băm chậm có salt: BCrypt, Argon2"},
      {en: "Rate limiting, breach checks, MFA", vi: "Giới hạn tần suất, kiểm tra mật khẩu đã lộ, xác thực đa yếu tố"}
    ],
    answer: "Passwords should never be stored in plain text, or even encrypted, because encryption can be reversed if the key leaks. We store a one-way hash, but not a fast one like SHA-256, because attackers can try billions of guesses per second. Instead, we use a slow, adaptive algorithm with a random salt per user, like BCrypt or Argon2. The salt means two users with the same password get different hashes, and the work factor can be increased as hardware gets faster. In Spring Security, I use a DelegatingPasswordEncoder, so we can upgrade the algorithm later. On top of that, we rate-limit login attempts, reject known breached passwords, and offer multi-factor authentication.",
    keyPhrases: ["encryption can be reversed", "a one-way hash", "a random salt per user", "the work factor", "DelegatingPasswordEncoder"]
  },
  {
    category: 'SPRING',
    question: "What is the difference between CORS and CSRF?",
    questionVi: "CORS và CSRF khác nhau thế nào?",
    outline: [
      {en: "CORS: browser rule about which origins may read responses", vi: "CORS: quy tắc trình duyệt về origin nào được đọc response"},
      {en: "CSRF: an attack using the victim's cookies from another site", vi: "CSRF: kiểu tấn công lợi dụng cookie của nạn nhân từ trang khác"},
      {en: "CORS doesn't protect against CSRF; use SameSite and CSRF tokens", vi: "CORS không chống được CSRF; dùng SameSite và CSRF token"}
    ],
    answer: "They're often confused, but they're very different. CORS is a browser mechanism that decides whether JavaScript from one origin can read a response from another origin. The server opts in with headers like Access-Control-Allow-Origin, and I always list explicit origins instead of a wildcard, especially with credentials. CSRF is an attack: a malicious site makes the victim's browser send a request to our site, and the browser automatically attaches our cookies, so the request looks authenticated. CORS doesn't stop that, because simple form posts are sent anyway. The protection is SameSite cookies, CSRF tokens for cookie-based sessions, and never changing state with GET requests. If the API uses only bearer tokens in headers, CSRF is much less of a risk.",
    keyPhrases: ["a browser mechanism", "explicit origins instead of a wildcard", "automatically attaches our cookies", "CORS doesn't stop that", "SameSite cookies"]
  },
  {
    category: 'SPRING',
    question: "How do you implement fine-grained authorization in Spring?",
    questionVi: "Bạn cài đặt phân quyền chi tiết trong Spring như thế nào?",
    outline: [
      {en: "URL rules for coarse access; method security for business rules", vi: "Quy tắc URL cho truy cập thô; method security cho quy tắc nghiệp vụ"},
      {en: "@PreAuthorize with roles and ownership checks", vi: "@PreAuthorize với vai trò và kiểm tra quyền sở hữu"},
      {en: "Scope queries by the current user; test the denied cases", vi: "Giới hạn query theo người dùng hiện tại; test các trường hợp bị từ chối"}
    ],
    answer: "I use two levels. In the security filter chain, URL rules give coarse access, for example everything under slash admin requires the admin role. Then, for business rules, I enable method security and use @PreAuthorize on service methods, which can check roles and call a bean to check ownership. But the safest pattern for ownership is to scope the query itself by the current user, like findByIdAndOwnerId, so another user's record simply isn't found, and we return 404 instead of leaking that it exists. I take the user ID from the authenticated principal, never from the request body. And I always write tests for the denied cases, like a normal user calling an admin endpoint, not only for the happy path.",
    keyPhrases: ["coarse access", "method security", "scope the query itself", "from the authenticated principal", "tests for the denied cases"]
  },
  // ---------- MICROSERVICES & MESSAGING DEEP DIVE ----------
  {
    category: 'SYSTEM_DESIGN',
    question: "What are event sourcing and CQRS, and when are they worth it?",
    questionVi: "Event sourcing và CQRS là gì, và khi nào đáng dùng?",
    outline: [
      {en: "Event sourcing: store events, derive current state", vi: "Event sourcing: lưu sự kiện, suy ra trạng thái hiện tại"},
      {en: "CQRS: separate write model and read models", vi: "CQRS: tách mô hình ghi và mô hình đọc"},
      {en: "Worth it for audit-heavy domains; costly otherwise", vi: "Đáng dùng cho miền cần kiểm toán nhiều; còn lại thì tốn kém"}
    ],
    answer: "With event sourcing, instead of storing only the current state, we store every change as an immutable event, like CardIssued or PaymentReceived, and we rebuild the current state by replaying them. That gives a complete audit history and lets us answer questions about the past. CQRS means separating the write side, which validates commands and produces events, from read models that are optimized for queries, often updated asynchronously. They fit well together, and they're powerful in domains like banking ledgers. But they add real complexity: eventual consistency, event versioning, and rebuilding projections. For a normal CRUD service, I wouldn't use them. An append-only table and a few read views usually give most of the benefit.",
    keyPhrases: ["an immutable event", "replaying them", "a complete audit history", "read models", "add real complexity"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How do you version an API without breaking clients?",
    questionVi: "Bạn đánh phiên bản API thế nào để không làm hỏng client?",
    outline: [
      {en: "Prefer backward-compatible changes: add, don't remove or rename", vi: "Ưu tiên thay đổi tương thích ngược: thêm, không xóa hay đổi tên"},
      {en: "New major version only for breaking changes (/v2)", vi: "Chỉ ra phiên bản mới khi có thay đổi phá vỡ (/v2)"},
      {en: "Deprecation period, communication, usage monitoring", vi: "Thời gian ngừng hỗ trợ, thông báo, theo dõi mức sử dụng"}
    ],
    answer: "Most changes shouldn't need a new version at all. Adding a new optional field or a new endpoint is backward compatible, as long as clients ignore unknown fields. Breaking changes are removing or renaming a field, changing its type or meaning, or making an optional field required. For those, I publish a new major version, usually in the path, like slash v2, and run both versions side by side. Then I announce a deprecation date, add a Deprecation header, and monitor who still calls the old version before removing it. Mobile apps make this harder, because old app versions stay installed for a long time, so I keep old versions longer for them.",
    keyPhrases: ["backward compatible", "ignore unknown fields", "breaking changes", "run both versions side by side", "a deprecation date"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How do you evolve the schema of events or messages safely?",
    questionVi: "Bạn thay đổi cấu trúc của event hoặc message thế nào cho an toàn?",
    outline: [
      {en: "Producers and consumers deploy at different times", vi: "Producer và consumer được deploy vào các thời điểm khác nhau"},
      {en: "Additive changes with defaults; tolerant readers", vi: "Thay đổi kiểu thêm vào kèm giá trị mặc định; consumer chấp nhận dữ liệu lạ"},
      {en: "Schema registry and compatibility rules; new event type for big changes", vi: "Schema registry và quy tắc tương thích; tạo kiểu event mới cho thay đổi lớn"}
    ],
    answer: "The challenge is that producers and consumers are deployed at different times, and old messages may still be in the queue, or replayed from Kafka months later. So every change must be compatible in both directions for a while. I only make additive changes: add optional fields with sensible defaults, and never rename or reuse a field. Consumers are tolerant readers, so they ignore fields they don't know. With Avro or Protobuf, a schema registry can enforce compatibility rules automatically in the pipeline. For a truly breaking change, I publish a new event type or version, like PaymentCompletedV2, and run both until every consumer has moved.",
    keyPhrases: ["deployed at different times", "compatible in both directions", "additive changes", "tolerant readers", "a schema registry"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How do Kafka consumer groups work?",
    questionVi: "Consumer group trong Kafka hoạt động thế nào?",
    outline: [
      {en: "Each partition is read by one consumer in a group", vi: "Mỗi partition chỉ được một consumer trong nhóm đọc"},
      {en: "Offsets track progress; commit after processing", vi: "Offset theo dõi tiến độ; commit sau khi xử lý xong"},
      {en: "Rebalancing when consumers join or leave; parallelism limited by partitions", vi: "Rebalance khi consumer vào hoặc rời; mức song song bị giới hạn bởi số partition"}
    ],
    answer: "A topic is split into partitions, and within one consumer group, each partition is assigned to exactly one consumer. So the maximum parallelism of a group is the number of partitions: if a topic has six partitions, a seventh consumer would just sit idle. Different groups, like billing and analytics, each get their own copy of every message. Each group tracks its position with an offset per partition. I commit the offset only after processing succeeds, which gives at-least-once delivery, so processing must be idempotent. When a consumer joins, leaves or crashes, the group rebalances and reassigns partitions, which pauses consumption briefly, so I keep processing per message reasonably fast.",
    keyPhrases: ["exactly one consumer", "the number of partitions", "their own copy of every message", "only after processing succeeds", "the group rebalances"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "Is exactly-once delivery possible? How do you handle it in practice?",
    questionVi: "Có thể đảm bảo gửi đúng một lần (exactly-once) không? Thực tế xử lý thế nào?",
    outline: [
      {en: "Across systems, delivery is at-least-once or at-most-once", vi: "Giữa các hệ thống, chỉ có at-least-once hoặc at-most-once"},
      {en: "Exactly-once effect = at-least-once delivery + idempotent processing", vi: "Hiệu ứng exactly-once = gửi at-least-once + xử lý idempotent"},
      {en: "Dedupe with message IDs or unique constraints in the same transaction", vi: "Loại trùng bằng ID message hoặc ràng buộc unique trong cùng transaction"}
    ],
    answer: "End to end, across a network, true exactly-once delivery isn't really possible, because an acknowledgment can always get lost. Kafka has exactly-once semantics, but only within Kafka, for example reading and writing topics in one transaction. As soon as we write to a database or call an external API, we're back to at-least-once. So in practice, I aim for an exactly-once effect: at-least-once delivery plus idempotent processing. Each message carries a unique ID, and the consumer stores the processed IDs, or relies on a business unique key, in the same database transaction as the side effect. If the same message arrives again, it's detected and skipped.",
    keyPhrases: ["an acknowledgment can always get lost", "only within Kafka", "an exactly-once effect", "idempotent processing", "in the same database transaction"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How do you choose timeouts and retries between services?",
    questionVi: "Bạn chọn timeout và retry giữa các service như thế nào?",
    outline: [
      {en: "Every remote call needs connect and read timeouts", vi: "Mọi lời gọi từ xa đều cần timeout kết nối và timeout đọc"},
      {en: "Base them on the dependency's p99 and the caller's budget", vi: "Dựa trên p99 của dependency và quỹ thời gian của bên gọi"},
      {en: "Retry only idempotent calls, with backoff and jitter, and a limit", vi: "Chỉ retry lời gọi idempotent, có backoff và jitter, và có giới hạn"}
    ],
    answer: "Every remote call must have a timeout, because the default in many HTTP clients is to wait forever, and one slow dependency can then use up all our threads. I set both a connect timeout and a read timeout, based on the dependency's normal p99 latency, and within the total time budget of our own endpoint. For example, if our API must answer in two seconds, a downstream call can't have a five-second timeout. Retries help with short network glitches, but only for idempotent operations, or with an idempotency key. I use exponential backoff with jitter and a small maximum, like three attempts, because retrying too aggressively during an outage just makes the outage worse. A circuit breaker stops retries when the dependency is clearly down.",
    keyPhrases: ["wait forever", "use up all our threads", "the total time budget", "backoff with jitter", "makes the outage worse"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How does distributed tracing work?",
    questionVi: "Distributed tracing hoạt động thế nào?",
    outline: [
      {en: "A trace is one request; spans are the steps", vi: "Một trace là một request; các span là các bước"},
      {en: "Context propagated in headers (W3C traceparent)", vi: "Ngữ cảnh được truyền qua header (W3C traceparent)"},
      {en: "OpenTelemetry, sampling, link logs with the trace ID", vi: "OpenTelemetry, lấy mẫu, liên kết log bằng trace ID"}
    ],
    answer: "A trace represents one request as it travels through the system, and it's made of spans. Each span is one operation, like an incoming HTTP call, a database query or a message publish, with a start time, a duration and attributes. When a service calls another one, it passes the trace context in a header, the W3C traceparent, so the next service adds its spans to the same trace. With OpenTelemetry, most of this is automatic for Spring, JDBC and HTTP clients. The traces go to a backend like Jaeger or Tempo, where I can see a waterfall and find exactly which step is slow. To control cost, we sample traces, but keep all traces with errors. And we put the trace ID in every log line, so logs and traces are connected.",
    keyPhrases: ["made of spans", "the W3C traceparent", "OpenTelemetry", "a waterfall", "the trace ID in every log line"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What is the bulkhead pattern?",
    questionVi: "Bulkhead pattern là gì?",
    outline: [
      {en: "Isolate resources so one failure can't sink everything", vi: "Cô lập tài nguyên để một lỗi không kéo sập tất cả"},
      {en: "Separate thread pools or concurrency limits per dependency", vi: "Thread pool hoặc giới hạn đồng thời riêng cho từng dependency"},
      {en: "Combine with timeouts and circuit breakers", vi: "Kết hợp với timeout và circuit breaker"}
    ],
    answer: "The name comes from ships: the hull is divided into compartments, so if one floods, the ship still floats. In software, it means isolating resources so a problem in one area can't take down everything. For example, if our service calls a slow reporting API and a fast payment API using the same thread pool, the slow calls can use up all the threads, and payments fail too. With a bulkhead, each dependency gets its own limited pool or a concurrency limit, like a semaphore, so the reporting calls can only block their own share. Resilience4j provides this. It works best together with timeouts and circuit breakers.",
    keyPhrases: ["divided into compartments", "isolating resources", "use up all the threads", "its own limited pool", "together with timeouts and circuit breakers"]
  },
  // ---------- SQL / MYSQL DEEP DIVE ----------
  {
    category: 'DATABASE',
    question: "What does SELECT ... FOR UPDATE do, and when do you use it?",
    questionVi: "SELECT ... FOR UPDATE làm gì, và khi nào dùng?",
    outline: [
      {en: "Locking read: locks the selected rows until commit", vi: "Đọc có khóa: khóa các dòng được chọn tới khi commit"},
      {en: "Use for read-then-update on contended rows (pessimistic locking)", vi: "Dùng khi đọc rồi cập nhật trên dòng bị tranh chấp (khóa bi quan)"},
      {en: "Keep it short, use an index, consistent order; SKIP LOCKED for queues", vi: "Giữ ngắn, dùng index, thứ tự nhất quán; SKIP LOCKED cho hàng đợi"}
    ],
    answer: "It's a locking read. Inside a transaction, it reads the rows and puts an exclusive lock on them until the transaction commits or rolls back, so other transactions that want to update or lock those rows have to wait. I use it when I need to read a value and then update it based on what I read, and conflicts are likely, for example reserving the last seats or debiting a balance. That's pessimistic locking. The rules are: keep the transaction very short, make sure the WHERE clause uses an index, otherwise InnoDB may lock many more rows, and lock rows in a consistent order to avoid deadlocks. For job queues, FOR UPDATE SKIP LOCKED lets several workers take different rows without waiting.",
    keyPhrases: ["a locking read", "an exclusive lock", "pessimistic locking", "uses an index", "SKIP LOCKED"]
  },
  {
    category: 'DATABASE',
    question: "What are gap locks in MySQL InnoDB?",
    questionVi: "Gap lock trong MySQL InnoDB là gì?",
    outline: [
      {en: "Locks the gap between index records, not the rows themselves", vi: "Khóa khoảng trống giữa các bản ghi index, không phải chính các dòng"},
      {en: "Prevents phantom inserts under REPEATABLE READ", vi: "Ngăn chèn dòng ma (phantom) ở mức REPEATABLE READ"},
      {en: "Can cause unexpected waits and deadlocks on inserts", vi: "Có thể gây chờ và deadlock bất ngờ khi insert"}
    ],
    answer: "In InnoDB, under the default REPEATABLE READ level, a locking read or an update on a range doesn't only lock the rows it finds. It also locks the gaps between index records, so no other transaction can insert a new row into that range. Together, a row lock and the gap before it are called a next-key lock. That's how InnoDB prevents phantom rows from appearing in a range you already read. The side effect is that two transactions inserting into the same range, or checking that a value doesn't exist and then inserting it, can block each other or even deadlock. Using a unique index for exact lookups, or READ COMMITTED where it's acceptable, reduces gap locking.",
    keyPhrases: ["the gaps between index records", "a next-key lock", "phantom rows", "block each other", "READ COMMITTED"]
  },
  {
    category: 'DATABASE',
    question: "How do you read an EXPLAIN plan in MySQL?",
    questionVi: "Bạn đọc kết quả EXPLAIN trong MySQL như thế nào?",
    outline: [
      {en: "type: from ALL (full scan) to range, ref, const", vi: "type: từ ALL (quét toàn bảng) tới range, ref, const"},
      {en: "key, rows and filtered: which index and how many rows", vi: "key, rows và filtered: dùng index nào và bao nhiêu dòng"},
      {en: "Extra: Using filesort, Using temporary, Using index", vi: "Extra: Using filesort, Using temporary, Using index"}
    ],
    answer: "I look at a few columns first. The type column shows how each table is accessed: ALL means a full table scan, which is usually bad on a big table, while range, ref, eq_ref and const are increasingly efficient index lookups. The key column tells me which index was actually chosen, and possible_keys shows what it could have used. The rows column is the estimated number of rows examined, and filtered shows how many survive the WHERE. In Extra, 'Using filesort' or 'Using temporary' means extra sorting or a temporary table, often fixable with an index that matches the ORDER BY or GROUP BY. 'Using index' is good news: it's a covering index. For the real timings, I use EXPLAIN ANALYZE.",
    keyPhrases: ["a full table scan", "which index was actually chosen", "the estimated number of rows", "Using filesort", "EXPLAIN ANALYZE"]
  },
  {
    category: 'DATABASE',
    question: "How do you handle replication lag with read replicas?",
    questionVi: "Bạn xử lý độ trễ sao chép (replication lag) khi dùng read replica như thế nào?",
    outline: [
      {en: "Replicas are asynchronous: reads can be stale", vi: "Replica là bất đồng bộ: dữ liệu đọc có thể bị cũ"},
      {en: "Read-your-writes: route the user's reads to the primary after a write", vi: "Đọc được dữ liệu vừa ghi: chuyển request đọc của người dùng về primary sau khi ghi"},
      {en: "Critical reads on the primary; monitor lag", vi: "Các lần đọc quan trọng dùng primary; theo dõi độ trễ"}
    ],
    answer: "Read replicas usually receive changes asynchronously, so there's always some lag, normally milliseconds, but sometimes seconds under heavy load. The classic problem is read-your-writes: a user updates their profile, the next page reads from a replica, and the old value appears, so they think the save failed. My approach is to send reads that must be fresh to the primary: anything inside a write transaction, money-related checks like a balance before a payment, and reads by the same user for a short time after they wrote something. Reports and dashboards, where a few seconds of delay is fine, go to replicas. I also monitor the replication lag, and stop routing to a replica that's too far behind.",
    keyPhrases: ["asynchronously", "read-your-writes", "must be fresh to the primary", "a few seconds of delay is fine", "monitor the replication lag"]
  },
  {
    category: 'DATABASE',
    question: "Should business logic live in stored procedures?",
    questionVi: "Logic nghiệp vụ có nên đặt trong stored procedure không?",
    outline: [
      {en: "Pros: fewer round trips, close to the data", vi: "Ưu: ít lượt gọi qua lại, gần dữ liệu"},
      {en: "Cons: harder to test, version, review and scale", vi: "Nhược: khó test, quản lý phiên bản, review và mở rộng"},
      {en: "Keep logic in the application; use the DB for constraints", vi: "Giữ logic ở ứng dụng; dùng DB cho các ràng buộc"}
    ],
    answer: "In general, I prefer to keep business logic in the application. Stored procedures can be fast, because they avoid network round trips and run right next to the data, and they can be useful for heavy batch operations. But they're harder to unit test, to debug, to review in pull requests, and to deploy together with application changes. They also tie us to one database vendor, and the database is the hardest part of the system to scale. What I do put in the database are rules about data integrity: primary keys, foreign keys, unique constraints and check constraints, because those must hold no matter which code writes the data.",
    keyPhrases: ["keep business logic in the application", "network round trips", "harder to unit test", "one database vendor", "data integrity"]
  },
  {
    category: 'DATABASE',
    question: "What is a materialized view, and when would you use one?",
    questionVi: "Materialized view là gì, và khi nào bạn dùng?",
    outline: [
      {en: "A view stores a query; a materialized view stores its result", vi: "View lưu câu query; materialized view lưu kết quả của nó"},
      {en: "Fast reads for expensive aggregations; needs refreshing", vi: "Đọc nhanh cho các phép tổng hợp tốn kém; cần làm mới"},
      {en: "MySQL has none: use a summary table updated by jobs or events", vi: "MySQL không có: dùng bảng tổng hợp được cập nhật bằng job hoặc event"}
    ],
    answer: "A normal view is just a saved query that runs every time you select from it. A materialized view stores the result physically, so reading it is fast, which is great for expensive aggregations, like monthly spending per category for a dashboard. The trade-off is freshness: it must be refreshed, either on a schedule or incrementally, so the data can be slightly old. PostgreSQL supports them directly. MySQL doesn't, so I build the same thing with a summary table that a scheduled job or an event consumer keeps up to date, and I show users when it was last updated. The source tables always remain the source of truth.",
    keyPhrases: ["a saved query", "stores the result physically", "expensive aggregations", "must be refreshed", "a summary table"]
  },
  {
    category: 'DATABASE',
    question: "How would you implement search across text fields?",
    questionVi: "Bạn sẽ cài đặt tìm kiếm trên các trường văn bản như thế nào?",
    outline: [
      {en: "LIKE '%term%' can't use a normal index", vi: "LIKE '%từ%' không dùng được index thông thường"},
      {en: "Database full-text index for simple needs", vi: "Full-text index của database cho nhu cầu đơn giản"},
      {en: "Search engine (Elasticsearch/OpenSearch) for relevance, typos, facets", vi: "Search engine (Elasticsearch/OpenSearch) cho độ liên quan, gõ sai, lọc theo nhóm"}
    ],
    answer: "A query with LIKE and a leading wildcard can't use a normal B-tree index, so on a big table it becomes a full scan. A prefix search, without the leading wildcard, can use an index. For simple keyword search, I'd use the database's full-text index, like MATCH AGAINST in MySQL, which is cheap to add. But if users need relevance ranking, typo tolerance, Vietnamese accent-insensitive search, or filters with counts, I'd use a search engine like Elasticsearch or OpenSearch. The database stays the source of truth, and the index is updated asynchronously through events, so search results can be a second behind. I also make sure users can only search their own data.",
    keyPhrases: ["a leading wildcard", "full-text index", "relevance ranking", "accent-insensitive", "updated asynchronously"]
  },
  // ---------- ANGULAR & SPRING EXTRAS ----------
  {
    category: 'ANGULAR',
    question: "How do you improve the performance of an Angular app?",
    questionVi: "Bạn cải thiện hiệu năng của một ứng dụng Angular như thế nào?",
    outline: [
      {en: "Load less: lazy routes, @defer, smaller bundles", vi: "Tải ít hơn: lazy route, @defer, bundle nhỏ hơn"},
      {en: "Render less: OnPush/signals, track in @for, virtual scrolling", vi: "Render ít hơn: OnPush/signal, track trong @for, virtual scrolling"},
      {en: "Measure with Lighthouse and Angular DevTools", vi: "Đo bằng Lighthouse và Angular DevTools"}
    ],
    answer: "I think about two things: loading less and rendering less. For loading, I lazy-load feature routes, use @defer for heavy parts of a page, like a chart library or a big data set, and check the bundle budget so we don't import a whole library for one function. For rendering, I use OnPush components and signals, so Angular only updates what changed, and I always give @for a stable track expression, like the item ID, so it doesn't recreate the DOM. Long lists get pagination or virtual scrolling, and expensive calculations go into computed signals instead of template method calls. But first, I measure with Lighthouse and the Angular DevTools profiler, so I fix the real bottleneck.",
    keyPhrases: ["loading less and rendering less", "use @defer", "the bundle budget", "a stable track expression", "virtual scrolling"]
  },
  {
    category: 'ANGULAR',
    question: "NgRx or Signals for state management?",
    questionVi: "Quản lý state bằng NgRx hay Signals?",
    outline: [
      {en: "Signals + services cover most feature state simply", vi: "Signal + service đáp ứng phần lớn state của tính năng một cách đơn giản"},
      {en: "NgRx: strict one-way flow, devtools, good for large, shared, complex state", vi: "NgRx: luồng một chiều chặt chẽ, devtools, phù hợp state lớn, dùng chung, phức tạp"},
      {en: "Server state belongs to the API layer and caching", vi: "State từ server thuộc về tầng API và cache"}
    ],
    answer: "For most applications, I start with signals in services and components. A service holds the state in signals, exposes read-only signals and computed values, and has methods that update it, which is simple, typed and easy to test. NgRx is useful when the state is large, shared by many features, and changed by many different events, because its strict one-way flow, actions and devtools make complex changes predictable and traceable. The cost is a lot more code. NgRx also offers a SignalStore, which is a lighter middle ground. I also separate server state, like a list of transactions from the API, from UI state, like which filter is open, because the first is mostly about loading and caching.",
    keyPhrases: ["signals in services", "read-only signals", "strict one-way flow", "a lot more code", "SignalStore"]
  },
  {
    category: 'ANGULAR',
    question: "What are server-side rendering and hydration in Angular?",
    questionVi: "Server-side rendering và hydration trong Angular là gì?",
    outline: [
      {en: "SSR renders HTML on the server: faster first paint, SEO", vi: "SSR render HTML trên server: hiển thị lần đầu nhanh hơn, tốt cho SEO"},
      {en: "Hydration reuses that DOM instead of re-rendering", vi: "Hydration tái sử dụng DOM đó thay vì render lại"},
      {en: "Careful with browser-only APIs; often unnecessary for apps behind login", vi: "Cẩn thận với API chỉ có ở trình duyệt; thường không cần cho ứng dụng sau đăng nhập"}
    ],
    answer: "With server-side rendering, the server runs the Angular app and sends fully rendered HTML, so the user sees content sooner, and search engines can index it. Hydration is the step where the browser loads the JavaScript and Angular attaches to the existing DOM instead of destroying and re-rendering it, which avoids flicker. Incremental hydration can even delay hydrating parts of the page until they're needed. The main thing to watch out for is code that uses browser-only APIs, like window or localStorage, which must only run in the browser. For an internal or banking app behind a login, SEO doesn't matter, so SSR is often not worth the extra complexity.",
    keyPhrases: ["fully rendered HTML", "attaches to the existing DOM", "incremental hydration", "browser-only APIs", "not worth the extra complexity"]
  },
  {
    category: 'ANGULAR',
    question: "How does Angular protect against XSS?",
    questionVi: "Angular bảo vệ chống XSS như thế nào?",
    outline: [
      {en: "Interpolation and bindings are escaped and sanitized by default", vi: "Interpolation và binding được escape và làm sạch mặc định"},
      {en: "bypassSecurityTrust* turns protection off: avoid it", vi: "bypassSecurityTrust* tắt cơ chế bảo vệ: tránh dùng"},
      {en: "Plus CSP, no direct DOM writes, server-side validation", vi: "Thêm CSP, không ghi thẳng vào DOM, kiểm tra ở server"}
    ],
    answer: "By default, Angular treats every value as untrusted. Interpolation escapes text, and when you bind to innerHTML, a URL or a style, Angular sanitizes the value and removes dangerous parts like script tags or javascript URLs. The main risk is developers turning that off with the DomSanitizer bypassSecurityTrust methods, or writing to the DOM directly with ElementRef, so I avoid both, or review them very carefully. On top of that, a Content Security Policy header limits which scripts can run, and Angular supports it with nonces. And the server still validates and encodes data, because the frontend isn't the only client.",
    keyPhrases: ["every value as untrusted", "sanitizes the value", "bypassSecurityTrust", "writing to the DOM directly", "Content Security Policy"]
  },
  {
    category: 'ANGULAR',
    question: "How do you avoid memory leaks with RxJS subscriptions in Angular?",
    questionVi: "Làm sao tránh rò rỉ bộ nhớ với subscription RxJS trong Angular?",
    outline: [
      {en: "Long-lived observables keep components alive", vi: "Observable sống lâu giữ component không được giải phóng"},
      {en: "Prefer the async pipe or toSignal", vi: "Ưu tiên async pipe hoặc toSignal"},
      {en: "Otherwise takeUntilDestroyed; HTTP calls complete on their own", vi: "Nếu không thì dùng takeUntilDestroyed; lời gọi HTTP tự kết thúc"}
    ],
    answer: "A leak happens when a component subscribes to a long-lived observable, like a store, a WebSocket stream or an interval, and never unsubscribes. The subscription keeps the component in memory after it's destroyed, and the callback keeps running. The best fix is not to subscribe manually at all: use the async pipe in the template, or convert the observable with toSignal, and Angular cleans up automatically. When I do need a manual subscription, I use takeUntilDestroyed, which ends it when the component is destroyed. A single HTTP request completes on its own, so it doesn't leak, but I still cancel it with switchMap when the user changes the input.",
    keyPhrases: ["never unsubscribes", "the async pipe", "toSignal", "takeUntilDestroyed", "completes on its own"]
  },
  {
    category: 'ANGULAR',
    question: "What is @defer in Angular, and when do you use it?",
    questionVi: "@defer trong Angular là gì, và khi nào dùng?",
    outline: [
      {en: "Template block that lazy-loads its components into a separate chunk", vi: "Khối template tải lười các component vào một chunk riêng"},
      {en: "Triggers: on viewport, interaction, idle, immediate, timer, when", vi: "Trigger: on viewport, interaction, idle, immediate, timer, when"},
      {en: "@placeholder, @loading and @error blocks", vi: "Các khối @placeholder, @loading và @error"}
    ],
    answer: "@defer is a template block that lazy-loads the standalone components, directives and pipes inside it. The compiler moves them into a separate JavaScript chunk, which is downloaded only when a trigger fires. Triggers include on viewport, when the block scrolls into view, on interaction, on idle, on timer, or a condition with when. It comes with @placeholder for what to show before loading starts, @loading while the chunk downloads, and @error if it fails. I use it for heavy parts that aren't needed immediately, like a chart below the fold, a rich editor, or a large data set such as a question bank that only one tab needs. The deferred components must not be referenced anywhere else eagerly, or they'll stay in the main bundle.",
    keyPhrases: ["lazy-loads the standalone components", "a separate JavaScript chunk", "on viewport", "@placeholder", "referenced anywhere else eagerly"]
  },
  {
    category: 'SPRING',
    question: "RestTemplate, WebClient or RestClient - which one would you use?",
    questionVi: "RestTemplate, WebClient hay RestClient - bạn sẽ dùng cái nào?",
    outline: [
      {en: "RestTemplate: old, blocking, in maintenance mode", vi: "RestTemplate: cũ, chặn luồng, chỉ được bảo trì"},
      {en: "WebClient: reactive, non-blocking, for WebFlux", vi: "WebClient: reactive, không chặn, dành cho WebFlux"},
      {en: "RestClient: modern fluent blocking API; HTTP interfaces", vi: "RestClient: API chặn luồng hiện đại, dạng fluent; HTTP interface"}
    ],
    answer: "RestTemplate is the classic blocking client. It's in maintenance mode, and the Spring team plans to deprecate it, so I wouldn't choose it for new code. WebClient is the reactive, non-blocking client from WebFlux. It's the right choice in a reactive application, but using it in a normal MVC app just to call block adds complexity for no benefit. Since Spring Framework 6.1, RestClient offers a modern, fluent API that's synchronous, which fits perfectly with Spring MVC and virtual threads. I can also declare an HTTP interface, an annotated Java interface, and let Spring generate the client. Whatever I choose, I configure connect and read timeouts, and error handling for non-2xx responses.",
    keyPhrases: ["in maintenance mode", "reactive, non-blocking", "fluent API that's synchronous", "an HTTP interface", "connect and read timeouts"]
  },
  {
    category: 'SPRING',
    question: "What does Spring Boot Actuator give you?",
    questionVi: "Spring Boot Actuator mang lại những gì?",
    outline: [
      {en: "Health, metrics, info and other operational endpoints", vi: "Các endpoint vận hành: health, metrics, info…"},
      {en: "Liveness and readiness probes for Kubernetes; Micrometer metrics", vi: "Liveness và readiness probe cho Kubernetes; metrics qua Micrometer"},
      {en: "Secure it: expose only what's needed, separate port", vi: "Bảo mật: chỉ mở những gì cần, dùng cổng riêng"}
    ],
    answer: "Actuator adds production-ready operational endpoints. The health endpoint reports whether the app and its dependencies, like the database, are up, and it has separate liveness and readiness groups, which map directly to Kubernetes probes. The metrics endpoint, through Micrometer, exposes JVM memory, garbage collection, HTTP latency and the connection pool, and can export to Prometheus. There are also endpoints like loggers, to change log levels at runtime, and threaddump. Because some endpoints can reveal sensitive information, I expose only health, info and metrics, put them on a separate management port, and protect everything else.",
    keyPhrases: ["operational endpoints", "liveness and readiness groups", "Micrometer", "change log levels at runtime", "a separate management port"]
  },
  {
    category: 'SPRING',
    question: "When would you use Propagation.REQUIRES_NEW?",
    questionVi: "Khi nào bạn dùng Propagation.REQUIRES_NEW?",
    outline: [
      {en: "Suspends the current transaction and starts an independent one", vi: "Tạm dừng transaction hiện tại và bắt đầu một transaction độc lập"},
      {en: "Use case: audit or failure records that must survive a rollback", vi: "Trường hợp dùng: bản ghi audit hoặc lỗi phải được giữ lại dù rollback"},
      {en: "Risks: extra connection, deadlocks, must be called through the proxy", vi: "Rủi ro: tốn thêm kết nối, deadlock, phải gọi qua proxy"}
    ],
    answer: "REQUIRES_NEW suspends the caller's transaction and runs the method in a completely new, independent one, which commits or rolls back on its own. The classic use case is recording something that must survive even if the main transaction rolls back, like an audit entry for a failed payment attempt, or marking a job as failed. The pitfalls are that it needs a second database connection while the first one is still held, which can exhaust the pool under load, and that it can deadlock if the inner transaction touches rows the outer one has locked. It also only works when called through the Spring proxy, so it has to be in a different bean, not a method in the same class.",
    keyPhrases: ["suspends the caller's transaction", "must survive", "a second database connection", "exhaust the pool", "a different bean"]
  },
  {
    category: 'SPRING',
    question: "What changed in Spring Boot 3, and how would you migrate?",
    questionVi: "Spring Boot 3 có gì thay đổi, và bạn sẽ nâng cấp như thế nào?",
    outline: [
      {en: "Java 17 baseline; javax to jakarta namespace", vi: "Yêu cầu tối thiểu Java 17; đổi namespace javax sang jakarta"},
      {en: "Observability with Micrometer, native image support, Security 6 config", vi: "Observability với Micrometer, hỗ trợ native image, cấu hình Security 6"},
      {en: "Migrate via latest 2.7 first, fix deprecations, use OpenRewrite", vi: "Nâng lên 2.7 mới nhất trước, sửa deprecation, dùng OpenRewrite"}
    ],
    answer: "The biggest changes were the Java 17 baseline and the move from javax to jakarta packages, for example jakarta.persistence and jakarta.servlet, which affects every entity and filter, plus third-party libraries that must also support Jakarta. Spring Security 6 removed WebSecurityConfigurerAdapter, so the configuration is written as SecurityFilterChain beans. Observability moved to Micrometer Observation and Micrometer Tracing, and there's official support for GraalVM native images. To migrate, I'd first upgrade to the latest 2.7 and fix all deprecation warnings, then upgrade dependencies, use OpenRewrite recipes to change the imports automatically, and run the full test suite, with extra attention on security configuration and Hibernate 6 query changes.",
    keyPhrases: ["Java 17 baseline", "from javax to jakarta", "SecurityFilterChain beans", "the latest 2.7", "OpenRewrite recipes"]
  },
  {
    category: 'SPRING',
    question: "What is a GraalVM native image, and when is it worth it?",
    questionVi: "GraalVM native image là gì, và khi nào đáng dùng?",
    outline: [
      {en: "Ahead-of-time compiled executable: fast startup, low memory", vi: "File thực thi biên dịch trước (AOT): khởi động nhanh, tốn ít bộ nhớ"},
      {en: "Closed-world assumption: reflection needs hints; long builds", vi: "Giả định thế giới đóng: reflection cần khai báo; build lâu"},
      {en: "Good for serverless and CLIs; JIT often better peak throughput", vi: "Phù hợp serverless và CLI; JIT thường có thông lượng đỉnh tốt hơn"}
    ],
    answer: "A native image compiles a Java application ahead of time into a standalone executable. It starts in tens of milliseconds instead of seconds and uses much less memory, because there's no JIT warm-up and only reachable code is included. The cost is the closed-world assumption: everything must be known at build time, so reflection, proxies and resources need hints, although Spring Boot 3 generates most of them. Builds are slow and use a lot of memory, and some libraries aren't compatible. For long-running services, the normal JVM often reaches better peak throughput after warm-up. So it's worth it for serverless functions, scale-to-zero workloads and command-line tools, where startup time really matters.",
    keyPhrases: ["ahead of time", "tens of milliseconds", "the closed-world assumption", "better peak throughput", "startup time really matters"]
  },
  // ---------- DSA, EXPLAINED OUT LOUD ----------
  {
    category: 'JAVA_CORE',
    question: "How would you implement an LRU cache in Java?",
    questionVi: "Bạn sẽ cài đặt LRU cache trong Java như thế nào?",
    outline: [
      {en: "Hash map for O(1) lookup + doubly linked list for usage order", vi: "Hash map để tra O(1) + danh sách liên kết đôi để giữ thứ tự sử dụng"},
      {en: "Quick version: LinkedHashMap with access order and removeEldestEntry", vi: "Cách nhanh: LinkedHashMap với access order và removeEldestEntry"},
      {en: "Thread safety: synchronize, or use Caffeine in production", vi: "Thread-safe: đồng bộ hóa, hoặc dùng Caffeine trên production"}
    ],
    answer: "An LRU cache evicts the least recently used entry when it's full, and both get and put should be O of one. The classic design combines a hash map, from key to node, with a doubly linked list that keeps the usage order. On every get or put, I move the node to the front, and when the size passes the capacity, I remove the node at the tail. In Java, the quick version is to extend LinkedHashMap with access order set to true, and override removeEldestEntry to return true when the size is above the capacity. It isn't thread-safe, so I'd wrap it with synchronization, but in a real service I'd simply use Caffeine, which handles concurrency, expiry and statistics.",
    keyPhrases: ["the least recently used entry", "a doubly linked list", "move the node to the front", "removeEldestEntry", "Caffeine"]
  },
  {
    category: 'JAVA_CORE',
    question: "What is the time complexity of common Java collection operations?",
    questionVi: "Độ phức tạp thời gian của các thao tác collection phổ biến trong Java là bao nhiêu?",
    outline: [
      {en: "ArrayList: get O(1), add at end amortized O(1), insert/remove in middle O(n)", vi: "ArrayList: get O(1), thêm cuối O(1) khấu hao, chèn/xóa giữa O(n)"},
      {en: "HashMap/HashSet: O(1) on average; TreeMap: O(log n)", vi: "HashMap/HashSet: trung bình O(1); TreeMap: O(log n)"},
      {en: "PriorityQueue: offer/poll O(log n), peek O(1)", vi: "PriorityQueue: offer/poll O(log n), peek O(1)"}
    ],
    answer: "For ArrayList, get by index is O of one, adding at the end is amortized O of one, and inserting or removing in the middle is O of n, because elements have to shift. contains on a list is also O of n. HashMap and HashSet give O of one on average for get, put and contains, and O of log n in the worst case for a bucket that has been turned into a tree. TreeMap and TreeSet keep keys sorted, so their operations are O of log n, and they support range queries like headMap. PriorityQueue is a binary heap: offer and poll are O of log n, and peek is O of one. Knowing this helps me pick the right structure, for example a HashSet instead of calling contains on a big list inside a loop.",
    keyPhrases: ["amortized O of one", "elements have to shift", "O of one on average", "keep keys sorted", "a binary heap"]
  },
  {
    category: 'JAVA_CORE',
    question: "Walk me through solving two-sum.",
    questionVi: "Hãy trình bày cách giải bài two-sum.",
    outline: [
      {en: "Clarify: one answer? duplicates? return indexes or values?", vi: "Làm rõ: có đúng một đáp án? có phần tử trùng? trả chỉ số hay giá trị?"},
      {en: "Brute force O(n²) with two loops", vi: "Brute force O(n²) với hai vòng lặp"},
      {en: "One pass with a HashMap of value to index: O(n) time, O(n) space", vi: "Một lượt duyệt với HashMap từ giá trị sang chỉ số: thời gian O(n), bộ nhớ O(n)"}
    ],
    answer: "First, I'd clarify a few things: is there always exactly one solution, can I use the same element twice, and should I return the indexes or the values? The brute-force approach checks every pair with two nested loops, which is O of n squared. A better approach uses a HashMap from value to index. I go through the array once, and for each number, I calculate the complement, which is the target minus the number. If the complement is already in the map, I've found the pair, and I return both indexes. Otherwise, I put the current number and its index in the map. That's O of n time and O of n extra space. If the array were sorted, I could use two pointers instead, with O of one extra space.",
    keyPhrases: ["exactly one solution", "two nested loops", "the complement", "O of n time", "two pointers"]
  },
  {
    category: 'JAVA_CORE',
    question: "How do you check if a string of brackets is balanced?",
    questionVi: "Làm sao kiểm tra một chuỗi dấu ngoặc có cân bằng không?",
    outline: [
      {en: "Use a stack (ArrayDeque)", vi: "Dùng stack (ArrayDeque)"},
      {en: "Push opening brackets; on a closing one, pop and compare", vi: "Đẩy ngoặc mở vào stack; gặp ngoặc đóng thì lấy ra và so sánh"},
      {en: "Balanced if the stack is empty at the end; O(n)", vi: "Cân bằng nếu cuối cùng stack rỗng; O(n)"}
    ],
    answer: "I'd use a stack, and in Java, ArrayDeque is the best choice for that, rather than the old Stack class. I go through the string character by character. When I see an opening bracket, a parenthesis, a square bracket or a curly brace, I push it. When I see a closing bracket, I check that the stack isn't empty and that the top of the stack is the matching opening bracket. If it isn't, the string is not balanced and I can return false right away. At the end, the string is balanced only if the stack is empty. It's O of n time and O of n space in the worst case. A small map from closing to opening brackets keeps the code clean.",
    keyPhrases: ["ArrayDeque", "character by character", "the matching opening bracket", "return false right away", "only if the stack is empty"]
  },
  {
    category: 'JAVA_CORE',
    question: "How do you find the first non-repeating character in a string?",
    questionVi: "Làm sao tìm ký tự đầu tiên không lặp lại trong một chuỗi?",
    outline: [
      {en: "First pass: count each character", vi: "Lượt đầu: đếm số lần xuất hiện của mỗi ký tự"},
      {en: "Second pass: return the first with count one", vi: "Lượt hai: trả về ký tự đầu tiên có số lần bằng một"},
      {en: "O(n) time; LinkedHashMap or an int array", vi: "Thời gian O(n); dùng LinkedHashMap hoặc mảng int"}
    ],
    answer: "I'd do it in two passes. In the first pass, I count how many times each character appears, using a HashMap from character to count, or an int array of size twenty-six if the input is only lowercase English letters, which is faster. In the second pass, I go through the string again, in the original order, and return the first character whose count is one. If none is found, I return a special value, like an empty Optional. It's O of n time, and the extra space is limited by the size of the alphabet. A LinkedHashMap would also work in one counting pass, because it keeps insertion order, and then I'd take the first entry with a count of one.",
    keyPhrases: ["two passes", "an int array of size twenty-six", "in the original order", "an empty Optional", "keeps insertion order"]
  },
  {
    category: 'JAVA_CORE',
    question: "Explain binary search and its common pitfalls.",
    questionVi: "Hãy giải thích tìm kiếm nhị phân và các lỗi hay gặp.",
    outline: [
      {en: "Sorted input; halve the search range each step: O(log n)", vi: "Dữ liệu đã sắp xếp; mỗi bước chia đôi phạm vi tìm: O(log n)"},
      {en: "Pitfalls: overflow in (low + high) / 2, off-by-one, infinite loops", vi: "Lỗi hay gặp: tràn số ở (low + high) / 2, lệch một đơn vị, vòng lặp vô hạn"},
      {en: "Variants: first or last occurrence; Arrays.binarySearch", vi: "Biến thể: vị trí xuất hiện đầu hoặc cuối; Arrays.binarySearch"}
    ],
    answer: "Binary search works on sorted data. I keep two indexes, low and high, look at the middle element, and if the target is smaller, I continue in the left half, otherwise in the right half. Each step halves the range, so it's O of log n. The pitfalls are classic. Computing the middle as the sum of low and high, divided by two, can overflow for very large arrays, so I compute it as low plus half of the difference between high and low, or use an unsigned shift. Off-by-one errors are common, so I decide clearly whether high is inclusive, and make sure the range always shrinks, to avoid an infinite loop. For duplicates, finding the first occurrence needs a small change: when I find the target, I keep searching to the left.",
    keyPhrases: ["works on sorted data", "halves the range", "can overflow", "off-by-one errors", "the first occurrence"]
  },
  {
    category: 'JAVA_CORE',
    question: "How do you detect a cycle in a linked list?",
    questionVi: "Làm sao phát hiện chu trình trong danh sách liên kết?",
    outline: [
      {en: "Simple: a HashSet of visited nodes, O(n) space", vi: "Cách đơn giản: HashSet các node đã đi qua, bộ nhớ O(n)"},
      {en: "Better: Floyd's slow and fast pointers, O(1) space", vi: "Tốt hơn: con trỏ chậm và nhanh của Floyd, bộ nhớ O(1)"},
      {en: "They meet if there's a cycle; fast reaches null if not", vi: "Hai con trỏ gặp nhau nếu có chu trình; con trỏ nhanh tới null nếu không có"}
    ],
    answer: "The simple solution is to walk the list and store each node in a HashSet. If I see a node that's already in the set, there's a cycle. That's O of n time, but also O of n extra memory. The better solution is Floyd's algorithm, with two pointers: a slow one that moves one step at a time, and a fast one that moves two steps. If there's no cycle, the fast pointer reaches the end, which is null. If there is a cycle, the fast pointer eventually catches up with the slow one inside the loop, and they meet. It's O of n time and O of one extra space. To find where the cycle starts, I reset one pointer to the head and move both one step at a time until they meet again.",
    keyPhrases: ["store each node in a HashSet", "Floyd's algorithm", "moves two steps", "catches up with the slow one", "O of one extra space"]
  },
  // ---------- CONSULTING SITUATIONS ----------
  {
    category: 'PROJECT',
    question: "How would you explain a technical concept to a non-technical client?",
    questionVi: "Bạn sẽ giải thích một khái niệm kỹ thuật cho khách hàng không chuyên như thế nào?",
    outline: [
      {en: "Start from their goal and the impact, not the technology", vi: "Bắt đầu từ mục tiêu và tác động của họ, không phải công nghệ"},
      {en: "Use an everyday analogy and avoid jargon", vi: "Dùng phép so sánh đời thường và tránh thuật ngữ"},
      {en: "Check understanding and offer a decision, not a lecture", vi: "Kiểm tra họ đã hiểu chưa và đưa ra lựa chọn, không giảng bài"}
    ],
    answer: "I start from what the client cares about, which is usually money, risk or time, not the technology itself. For example, if I need to explain why we want to add a cache, I'd say: right now, every time a customer opens the dashboard, we recalculate everything from scratch, like a shop that counts all its stock every time someone asks about one item. A cache keeps a recent answer ready, so the page loads in one second instead of eight. Then I explain the trade-off in the same simple terms: the numbers can be up to five minutes old. I avoid jargon, check that they're following by asking a question, and end with a clear choice they can make.",
    keyPhrases: ["what the client cares about", "money, risk or time", "like a shop", "in the same simple terms", "a clear choice"]
  },
  {
    category: 'PROJECT',
    question: "What would you do if a client asked for something you believe is wrong?",
    questionVi: "Bạn sẽ làm gì nếu khách hàng yêu cầu điều mà bạn cho là sai?",
    outline: [
      {en: "Understand the real need behind the request", vi: "Hiểu nhu cầu thật phía sau yêu cầu"},
      {en: "Explain the risk with facts and offer alternatives", vi: "Giải thích rủi ro bằng dữ kiện và đưa ra phương án thay thế"},
      {en: "Respect their decision unless it's unsafe, illegal or unethical; document it", vi: "Tôn trọng quyết định của họ trừ khi không an toàn, phạm pháp hoặc trái đạo đức; ghi lại bằng văn bản"}
    ],
    answer: "First, I'd ask questions to understand the need behind the request, because often there's a real business problem with a better solution. For example, a client once asked us to email full monthly statements as plain attachments. The real need was that customers wanted their statements quickly. I explained the risk, that unencrypted financial data in email could break their data policy and regulations, and proposed an alternative: an email with a secure link to the portal. If it's simply a different opinion, it's their product and their decision, so I'd make sure they understand the trade-offs, document it, and do it well. But if it's insecure, illegal or unethical, I'd escalate it inside my team and not just do it.",
    keyPhrases: ["the need behind the request", "I explained the risk", "proposed an alternative", "document it", "insecure, illegal or unethical"]
  },
  {
    category: 'PROJECT',
    question: "How do you handle stakeholders with conflicting requirements?",
    questionVi: "Bạn xử lý thế nào khi các bên liên quan có yêu cầu mâu thuẫn nhau?",
    outline: [
      {en: "Make the conflict visible and concrete", vi: "Làm cho xung đột trở nên rõ ràng và cụ thể"},
      {en: "Bring them together; compare options against shared goals", vi: "Đưa các bên lại với nhau; so sánh phương án theo mục tiêu chung"},
      {en: "Get a decision from the right owner and write it down", vi: "Lấy quyết định từ đúng người có thẩm quyền và ghi lại"}
    ],
    answer: "I don't try to quietly satisfy both sides, because that usually leads to a solution nobody likes. First, I make the conflict concrete. For example, the risk team wanted every transfer over a certain amount to be reviewed manually, while the product team wanted transfers to be instant. I put both requirements on one page, with the impact of each option, and set up a short meeting with both of them. Framing it around a shared goal, safe and fast payments, helped. We agreed on a middle ground: instant transfers under a limit, and a review only above it, with clear numbers. When a compromise isn't possible, I make sure the person who owns the product makes the call, and I document the decision.",
    keyPhrases: ["quietly satisfy both sides", "make the conflict concrete", "on one page", "a shared goal", "makes the call"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you failed.",
    questionVi: "Hãy kể về một lần bạn thất bại.",
    outline: [
      {en: "A real failure that you own, not a disguised success", vi: "Một thất bại thật do bạn chịu trách nhiệm, không phải thành công trá hình"},
      {en: "What you did to fix the damage", vi: "Bạn đã làm gì để khắc phục"},
      {en: "What you changed afterwards, with evidence", vi: "Bạn đã thay đổi gì sau đó, kèm bằng chứng"}
    ],
    answer: "Early in my career, I estimated a reporting feature at one week, without really looking at the data. It turned out the data came from three systems with different formats, and it took almost four weeks. The bigger failure was that I only told my lead in the third week, because I kept thinking I could catch up. The client demo had to be moved, and that hurt the team's credibility. I owned it in the retro, and I changed two things. Now I do a short spike before estimating anything with unknown data, and I give early warning as soon as I see a risk, even if I'm not sure yet. Since then, my estimates have been much more reliable, and my lead has said that my risk updates help a lot.",
    keyPhrases: ["without really looking at the data", "the bigger failure was", "I owned it", "a short spike before estimating", "give early warning"]
  },
  {
    category: 'PROJECT',
    question: "Tell me about a time you led without formal authority.",
    questionVi: "Hãy kể về một lần bạn dẫn dắt mà không có quyền hạn chính thức.",
    outline: [
      {en: "A problem that needed someone to take the lead", vi: "Một vấn đề cần có người đứng ra dẫn dắt"},
      {en: "How you influenced: data, a small proof, involving people", vi: "Cách bạn tạo ảnh hưởng: dữ liệu, một bằng chứng nhỏ, kéo mọi người tham gia"},
      {en: "The result and the team's ownership", vi: "Kết quả và tinh thần làm chủ của nhóm"}
    ],
    answer: "Our team had no consistent error handling across services, so each API returned errors in a different format, and the mobile team kept complaining. I wasn't the tech lead, but I offered to drive it. Instead of just proposing a standard, I collected real examples of the problems from the mobile team, wrote a one-page proposal with a common error format, and built it in one service as a proof. Then I invited people from each team to review it, and I took their feedback seriously, which made it our standard, not mine. Within two sprints, all services used it, and the mobile team removed a lot of special-case code.",
    keyPhrases: ["I offered to drive it", "real examples of the problems", "built it in one service as a proof", "our standard, not mine", "within two sprints"]
  },
  {
    category: 'PROJECT',
    question: "What do you do when you realize you're going to miss a deadline?",
    questionVi: "Bạn làm gì khi nhận ra mình sẽ trễ deadline?",
    outline: [
      {en: "Tell people early, as soon as you know", vi: "Báo sớm ngay khi biết"},
      {en: "Bring a new estimate and options", vi: "Mang theo ước lượng mới và các phương án"},
      {en: "Learn why it happened", vi: "Rút kinh nghiệm vì sao xảy ra"}
    ],
    answer: "The most important thing is to tell people early, as soon as I'm fairly sure, not on the last day. Late news gives others no time to adjust. Before I raise it, I prepare a realistic new estimate and a few options, for example delivering the core part on time and the rest later, cutting a nice-to-have feature, or getting help from a teammate. Then I talk to my lead or the client, explain the reason honestly, and let them choose. Afterwards, I look at why it happened, whether it was an estimate, a dependency or a scope change, so I can avoid it next time.",
    keyPhrases: ["tell people early", "not on the last day", "a realistic new estimate", "let them choose", "why it happened"]
  },
  {
    category: 'PROJECT',
    question: "How do you keep quality high when the deadline is tight?",
    questionVi: "Bạn giữ chất lượng cao thế nào khi deadline gấp?",
    outline: [
      {en: "Cut scope, not quality", vi: "Cắt phạm vi, không cắt chất lượng"},
      {en: "Protect the critical parts: tests for money, security and data", vi: "Bảo vệ phần quan trọng: test cho tiền, bảo mật và dữ liệu"},
      {en: "Make shortcuts visible and pay them back", vi: "Công khai các phần làm tắt và xử lý lại sau"}
    ],
    answer: "My rule is to cut scope, not quality. If time is short, I'd rather deliver fewer features that work than everything with bugs. I agree with the product owner on what's truly needed for this release. Then I decide where quality can never be reduced: anything involving money, security or data integrity always gets tests and a review. For less critical parts, I might accept a simpler design or a manual step, but I make those shortcuts visible, with a ticket and a comment in the code, so we pay them back in the next sprint instead of forgetting them. Small pull requests and an automated pipeline also help, because they keep the feedback fast.",
    keyPhrases: ["cut scope, not quality", "fewer features that work", "money, security or data integrity", "make those shortcuts visible", "pay them back"]
  },
  // ---------- SCENARIO-BASED SYSTEM DESIGN ----------
  {
    category: 'SYSTEM_DESIGN',
    question: "Traffic suddenly grows ten times. What do you do?",
    questionVi: "Lưu lượng đột nhiên tăng gấp mười lần. Bạn làm gì?",
    outline: [
      {en: "Protect the system first: rate limits, shed non-critical load", vi: "Bảo vệ hệ thống trước: giới hạn tần suất, cắt bớt tải không quan trọng"},
      {en: "Scale the stateless tier; check the database and dependencies", vi: "Scale tầng không trạng thái; kiểm tra database và các dependency"},
      {en: "Then fix bottlenecks: caching, queues, read replicas", vi: "Sau đó xử lý điểm nghẽn: cache, hàng đợi, read replica"}
    ],
    answer: "First, I'd check whether the traffic is real users or an attack or a bug, like a client stuck in a retry loop, because the response is different. If it's real, the immediate goal is to keep the core flows working. I'd scale out the stateless API instances, enable or tighten rate limits, and temporarily turn off non-critical features, like recommendations or exports, using feature flags. The database is usually the real limit, because it doesn't scale out instantly, so I'd watch connections and slow queries, and move heavy reads to a cache or read replicas. Work that doesn't need to happen during the request, like emails, goes to a queue. After the peak, I'd load test to find the next bottleneck and set up autoscaling and alerts.",
    keyPhrases: ["real users or an attack", "keep the core flows working", "turn off non-critical features", "the database is usually the real limit", "goes to a queue"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you change a large table in production without downtime?",
    questionVi: "Bạn sẽ thay đổi một bảng lớn trên production mà không có downtime như thế nào?",
    outline: [
      {en: "Expand and contract: add, dual-write, backfill, switch, remove", vi: "Mở rộng rồi thu hẹp: thêm, ghi song song, điền dữ liệu, chuyển đổi, xóa"},
      {en: "Online schema change tools; backfill in small batches", vi: "Công cụ đổi schema online; điền dữ liệu theo lô nhỏ"},
      {en: "Every step backward compatible and reversible", vi: "Mỗi bước đều tương thích ngược và có thể quay lại"}
    ],
    answer: "I'd use the expand-and-contract pattern, so the application and the schema can change in small, safe steps. Say we want to rename a column. First, I add the new column, which is backward compatible. In MySQL 8 that's usually an instant ALTER, but for heavier changes I use an online schema change tool like gh-ost, because on a big table a plain ALTER could lock it or take hours. Then I deploy code that writes to both columns. Next, I backfill the old rows in small batches, with pauses, so I don't overload the database or the replicas. Once the data is complete and verified, I switch reads to the new column, and only after a while, when nothing uses the old one, do I remove it in a later migration. Every step can be rolled back, and there's never a moment where old and new code disagree.",
    keyPhrases: ["expand-and-contract", "backward compatible", "an online schema change", "in small batches", "can be rolled back"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design an audit log?",
    questionVi: "Bạn sẽ thiết kế nhật ký kiểm toán (audit log) như thế nào?",
    outline: [
      {en: "Who did what, to which record, when, from where, and the before/after", vi: "Ai làm gì, với bản ghi nào, khi nào, từ đâu, và giá trị trước/sau"},
      {en: "Append-only, tamper-evident, separate permissions", vi: "Chỉ ghi thêm, phát hiện được chỉnh sửa, phân quyền riêng"},
      {en: "Written in the same transaction or via an outbox; no secrets", vi: "Ghi trong cùng transaction hoặc qua outbox; không chứa secret"}
    ],
    answer: "Each audit entry records who did it, the user and their role, what action they took, which record was affected, when it happened, from which IP or service, and the relevant before and after values. The log must be append-only: application users can't update or delete entries, ideally even admins can't, and access to read it is restricted. For stronger guarantees, entries can be chained with hashes so tampering is detectable. To make sure no change is ever missing from the log, I write the audit entry in the same transaction as the business change, or through an outbox. I never store passwords, tokens or full card numbers in it. And there's a retention policy, because regulations often require keeping it for years.",
    keyPhrases: ["who did it", "before and after values", "append-only", "chained with hashes", "in the same transaction"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "A third-party API you depend on is slow and unreliable. What do you do?",
    questionVi: "Một API bên thứ ba bạn phụ thuộc vừa chậm vừa không ổn định. Bạn làm gì?",
    outline: [
      {en: "Isolate it: timeouts, circuit breaker, bulkhead", vi: "Cô lập nó: timeout, circuit breaker, bulkhead"},
      {en: "Move the call out of the user's request: queue and retry", vi: "Đưa lời gọi ra khỏi request của người dùng: hàng đợi và retry"},
      {en: "Cache, fallback, monitoring, and talk to the vendor with data", vi: "Cache, phương án dự phòng, giám sát, và trao đổi với nhà cung cấp bằng dữ liệu"}
    ],
    answer: "First, I'd make sure it can't take our system down: every call gets a strict timeout, a circuit breaker, and its own limited connection pool, so slow responses don't use up all our threads. Then I'd ask whether the user really needs to wait for it. If not, I'd move the call to a background job with a queue, retries with backoff, and idempotency keys, and show the user a pending status. If the data doesn't change often, I'd cache it and serve the last good value when the API fails. I'd also measure its latency and error rate on our side, because those numbers are what I need to discuss the SLA with the vendor, or to justify a second provider as a backup.",
    keyPhrases: ["can't take our system down", "a strict timeout", "a background job", "the last good value", "discuss the SLA with the vendor"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you handle data retention and archiving?",
    questionVi: "Bạn sẽ xử lý việc lưu giữ và lưu trữ dữ liệu cũ như thế nào?",
    outline: [
      {en: "Define retention per data type, with legal and business owners", vi: "Xác định thời gian lưu cho từng loại dữ liệu, cùng bộ phận pháp lý và kinh doanh"},
      {en: "Hot, warm, cold storage; partitions make archiving cheap", vi: "Lưu trữ nóng, ấm, lạnh; partition giúp việc lưu trữ dữ liệu cũ dễ và ít tốn kém"},
      {en: "Automated, auditable deletion and anonymization", vi: "Xóa và ẩn danh tự động, có thể kiểm toán"}
    ],
    answer: "First, retention is a business and legal decision, not just a technical one, so I'd agree on rules per data type with the owners: for example, financial transactions might be kept for ten years, logs for ninety days, and personal data only as long as the account is active. Then I'd design storage tiers. Recent data stays in the main database, older data moves to cheaper archive storage, like compressed files in object storage, which can still be queried if needed. Partitioning tables by month makes this easy, because we can move or drop a whole partition instead of deleting millions of rows. Deletion and anonymization run as automated, logged jobs, so we can prove to auditors that the policy is applied.",
    keyPhrases: ["a business and legal decision", "per data type", "storage tiers", "drop a whole partition", "prove to auditors"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you secure an API that external partners call?",
    questionVi: "Bạn sẽ bảo mật một API mà đối tác bên ngoài gọi vào như thế nào?",
    outline: [
      {en: "Strong client authentication: OAuth2 client credentials or mTLS", vi: "Xác thực client mạnh: OAuth2 client credentials hoặc mTLS"},
      {en: "Per-partner scopes, rate limits and IP allowlists", vi: "Phạm vi quyền, giới hạn tần suất và danh sách IP được phép theo từng đối tác"},
      {en: "Signed requests or webhooks, idempotency, full audit and key rotation", vi: "Request hoặc webhook có chữ ký, idempotency, audit đầy đủ và xoay vòng khóa"}
    ],
    answer: "Each partner gets its own credentials, so we know exactly who is calling and can revoke one partner without affecting the others. For authentication, I'd use OAuth2 client credentials with short-lived tokens, or mutual TLS for higher security. Each partner's token has scopes that limit which endpoints and data they can access, and the data is always filtered by the partner. I'd add rate limits per partner, an IP allowlist where possible, request size limits and strict input validation. For webhooks we send to them, I'd sign the payload with HMAC and include a timestamp, so they can verify it and reject replays. Every call is logged for audit, and keys are rotated regularly with a safe overlap period.",
    keyPhrases: ["its own credentials", "OAuth2 client credentials", "mutual TLS", "sign the payload with HMAC", "rotated regularly"]
  },
  // ---------- JAVA & WEB FUNDAMENTALS ----------
  {
    category: 'JAVA_CORE',
    question: "What's new in Java 25?",
    questionVi: "Java 25 có gì mới?",
    outline: [
      {en: "An LTS release (September 2025)", vi: "Bản LTS (tháng 9/2025)"},
      {en: "Final: scoped values, flexible constructor bodies, module imports, compact source files", vi: "Chính thức: scoped value, thân constructor linh hoạt, import module, file nguồn gọn"},
      {en: "JVM: compact object headers, generational Shenandoah, AOT startup improvements", vi: "JVM: compact object header, Shenandoah theo thế hệ, cải thiện khởi động AOT"}
    ],
    answer: "Java 25 is a long-term support release, so many teams will move to it from 21. On the language side, several features became final. Scoped values give a safer, cheaper alternative to ThreadLocal, especially with virtual threads. Flexible constructor bodies let us validate arguments before calling super. Module import declarations let us import a whole module with one line, and compact source files with instance main methods make small programs and scripts much simpler. On the JVM side, compact object headers, now a supported option you can turn on, reduce memory use, Shenandoah now has a generational mode, and there are ahead-of-time improvements that speed up startup and warm-up. Structured concurrency is still in preview, so I wouldn't use it in production code yet.",
    keyPhrases: ["a long-term support release", "Scoped values", "Flexible constructor bodies", "compact object headers", "still in preview"]
  },
  {
    category: 'JAVA_CORE',
    question: "How do you implement a thread-safe singleton in Java?",
    questionVi: "Bạn cài đặt singleton an toàn đa luồng trong Java như thế nào?",
    outline: [
      {en: "Enum singleton: simple, safe, serialization-proof", vi: "Singleton bằng enum: đơn giản, an toàn, chống lỗi khi serialize"},
      {en: "Holder idiom: lazy and thread-safe via class loading", vi: "Holder idiom: khởi tạo lười và an toàn nhờ cơ chế nạp class"},
      {en: "Double-checked locking needs volatile; in Spring, just use a bean", vi: "Double-checked locking cần volatile; trong Spring, chỉ cần dùng bean"}
    ],
    answer: "The simplest safe option is an enum with a single value, because the JVM guarantees it's created once, and it also handles serialization and reflection correctly. If I need lazy initialization, I use the holder idiom: a private static nested class holds the instance, and since the JVM loads that class only when it's first used, and class initialization is thread-safe, I get laziness without any locks. Double-checked locking also works, but only if the field is volatile, otherwise another thread can see a half-constructed object. In a Spring application, though, I almost never write a singleton by hand: a normal bean is a singleton by default, and it's much easier to test.",
    keyPhrases: ["an enum with a single value", "the holder idiom", "class initialization is thread-safe", "only if the field is volatile", "a singleton by default"]
  },
  {
    category: 'JAVA_CORE',
    question: "How does class loading work in Java?",
    questionVi: "Cơ chế nạp class trong Java hoạt động thế nào?",
    outline: [
      {en: "Load, link (verify, prepare, resolve), initialize - lazily", vi: "Nạp, liên kết (kiểm tra, chuẩn bị, phân giải), khởi tạo - theo kiểu lười"},
      {en: "Hierarchy: bootstrap, platform, application class loaders", vi: "Phân cấp: bootstrap, platform, application class loader"},
      {en: "Parent delegation; ClassNotFoundException vs NoClassDefFoundError", vi: "Ủy quyền cho cha; ClassNotFoundException và NoClassDefFoundError"}
    ],
    answer: "Classes are loaded lazily, the first time they're needed. Loading finds the bytecode and creates the class, linking verifies it and prepares static fields, and initialization runs the static initializers. There's a hierarchy of class loaders: the bootstrap loader for core JDK classes, the platform loader, and the application loader for our classpath. They use parent delegation: a loader first asks its parent, so core classes like String can't be replaced. Application servers and Spring Boot's fat jar use custom loaders. Two common errors: ClassNotFoundException when code loads a class by name and it isn't found, and NoClassDefFoundError when a class was there at compile time but is missing or failed to initialize at runtime, which often points to a dependency conflict.",
    keyPhrases: ["loaded lazily", "the bootstrap loader", "parent delegation", "ClassNotFoundException", "a dependency conflict"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What happens when you type a URL into the browser and press Enter?",
    questionVi: "Điều gì xảy ra khi bạn gõ một URL vào trình duyệt và nhấn Enter?",
    outline: [
      {en: "DNS lookup, TCP and TLS handshake", vi: "Tra cứu DNS, bắt tay TCP và TLS"},
      {en: "HTTP request through CDN, load balancer, to the application", vi: "Request HTTP đi qua CDN, load balancer, tới ứng dụng"},
      {en: "Response, then the browser parses, loads assets and renders", vi: "Phản hồi, rồi trình duyệt phân tích, tải tài nguyên và hiển thị"}
    ],
    answer: "First, the browser resolves the domain name to an IP address with DNS, checking caches on the way. Then it opens a TCP connection, or QUIC for HTTP/3, and does a TLS handshake to agree on encryption and verify the server's certificate. It sends the HTTP request with headers and cookies. On the server side, the request usually reaches a CDN or a load balancer first, then a reverse proxy, and finally our application, which might call a cache or a database before returning a response with a status code. The browser parses the HTML, downloads CSS, JavaScript and images, often in parallel over the same connection, builds the DOM and renders the page. For a single-page app like Angular, the JavaScript then takes over and calls the APIs.",
    keyPhrases: ["resolves the domain name", "a TLS handshake", "a CDN or a load balancer", "parses the HTML", "takes over and calls the APIs"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "Which HTTP methods are idempotent and safe?",
    questionVi: "HTTP method nào có tính idempotent và an toàn (safe)?",
    outline: [
      {en: "Safe: GET, HEAD, OPTIONS don't change state", vi: "Safe: GET, HEAD, OPTIONS không thay đổi trạng thái"},
      {en: "Idempotent: also PUT and DELETE", vi: "Idempotent: thêm PUT và DELETE"},
      {en: "POST and PATCH are not by default: use idempotency keys", vi: "POST và PATCH mặc định không idempotent: dùng idempotency key"}
    ],
    answer: "A safe method doesn't change anything on the server: GET, HEAD and OPTIONS. An idempotent method can be repeated many times with the same effect as doing it once. All safe methods are idempotent, and so are PUT, which replaces a resource with the same content, and DELETE, because deleting twice still leaves it deleted, even if the second call returns 404. POST is not idempotent: sending it twice can create two orders. PATCH isn't guaranteed either, for example a patch that increments a counter. This matters because clients, proxies and retry libraries may automatically repeat idempotent requests after a timeout. That's why GET must never change state, and why I add an idempotency key to POST requests that create payments.",
    keyPhrases: ["doesn't change anything on the server", "the same effect as doing it once", "deleting twice", "POST is not idempotent", "automatically repeat"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "REST vs gRPC vs GraphQL - when would you use each?",
    questionVi: "REST, gRPC và GraphQL - khi nào dùng cái nào?",
    outline: [
      {en: "REST: simple, cacheable, universal - public and most APIs", vi: "REST: đơn giản, cache được, phổ biến - API công khai và đa số API"},
      {en: "gRPC: binary, typed contracts, streaming - internal service calls", vi: "gRPC: nhị phân, hợp đồng có kiểu, streaming - gọi nội bộ giữa service"},
      {en: "GraphQL: client chooses fields - many different frontends", vi: "GraphQL: client tự chọn trường - nhiều frontend khác nhau"}
    ],
    answer: "REST over JSON is my default. It's simple, every client and tool understands it, it works well with HTTP caching, and it's easy to debug. gRPC uses Protocol Buffers over HTTP/2, so messages are smaller and faster, contracts are strictly typed and generate client code, and it supports streaming. I'd use it for high-volume calls between internal services, but it's less convenient for browsers and harder to inspect. GraphQL lets the client ask for exactly the fields it needs in one request, which helps when many different frontends, like web and several mobile versions, need different shapes of the same data. The cost is complexity on the server: caching, authorization per field, and protecting against very expensive queries.",
    keyPhrases: ["my default", "Protocol Buffers over HTTP/2", "strictly typed", "exactly the fields it needs", "very expensive queries"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How does HTTPS keep data secure?",
    questionVi: "HTTPS bảo vệ dữ liệu như thế nào?",
    outline: [
      {en: "TLS handshake: certificate proves the server's identity", vi: "Bắt tay TLS: chứng chỉ chứng minh danh tính server"},
      {en: "Key exchange creates a shared session key; symmetric encryption after", vi: "Trao đổi khóa tạo khóa phiên chung; sau đó mã hóa đối xứng"},
      {en: "Gives confidentiality, integrity and authentication", vi: "Đảm bảo tính bí mật, toàn vẹn và xác thực"}
    ],
    answer: "HTTPS is HTTP over TLS. During the handshake, the server sends its certificate, which is signed by a trusted certificate authority, and proves it holds the matching private key by signing the handshake, so the browser can verify it's really talking to that domain and not to an attacker in the middle. Then both sides use a key exchange, typically elliptic-curve Diffie-Hellman, to agree on a shared session key without ever sending it over the network. After that, all data is encrypted with fast symmetric encryption, like AES, and every message is authenticated, so it can't be read or changed in transit. TLS 1.3 made the handshake faster and removed old, weak algorithms. In our services, TLS usually ends at the load balancer, and HSTS tells browsers to always use HTTPS.",
    keyPhrases: ["HTTP over TLS", "a trusted certificate authority", "a shared session key", "symmetric encryption", "TLS 1.3"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What load balancing algorithms do you know?",
    questionVi: "Bạn biết những thuật toán cân bằng tải nào?",
    outline: [
      {en: "Round robin and weighted round robin", vi: "Round robin và weighted round robin"},
      {en: "Least connections / least response time", vi: "Ít kết nối nhất / thời gian phản hồi thấp nhất"},
      {en: "Hashing for stickiness; health checks always", vi: "Băm để giữ phiên (sticky); luôn có health check"}
    ],
    answer: "The simplest is round robin, where each new request goes to the next server in turn, and weighted round robin, which sends more traffic to bigger servers. When requests have very different costs, least connections is better, because it sends new requests to the server with the fewest active ones, and some load balancers use the lowest response time. If a client needs to reach the same server, for example for a local cache or a WebSocket, we can use sticky sessions, with a cookie, IP hashing or consistent hashing. But I prefer stateless services, so any instance can handle any request. Whatever the algorithm, health checks are essential, so traffic stops going to an instance that's down or still starting.",
    keyPhrases: ["round robin", "least connections", "sticky sessions", "stateless services", "health checks are essential"]
  },
  // ---------- MESSAGING, DOCKER, ENGINEERING PRACTICE ----------
  {
    category: 'SPRING',
    question: "How do you make a RabbitMQ consumer safe for redelivery?",
    questionVi: "Làm sao để consumer RabbitMQ an toàn khi message bị gửi lại?",
    outline: [
      {en: "Manual or auto ack only after successful processing", vi: "Chỉ ack sau khi xử lý thành công"},
      {en: "Idempotent processing with a message ID or business key", vi: "Xử lý idempotent bằng ID message hoặc khóa nghiệp vụ"},
      {en: "Don't block the listener thread with slow work", vi: "Không chặn thread listener bằng việc chậm"}
    ],
    answer: "RabbitMQ redelivers a message if the consumer dies or the connection drops before it acknowledges, so duplicates are normal, not an edge case. First, I acknowledge only after the work has succeeded, including the database commit. With Spring AMQP's default auto mode, that's when the listener method returns without an exception. Second, processing must be idempotent: each message carries a unique ID or a business key, and I record it with a unique constraint in the same transaction as the side effect, so a second delivery is detected and skipped. Third, I keep slow work, like browser automation or long database jobs, off the listener thread and acknowledge manually when it finishes, or set concurrency and prefetch carefully, so one slow message doesn't block the queue or cause timeouts.",
    keyPhrases: ["duplicates are normal", "acknowledge only after the work has succeeded", "must be idempotent", "a unique constraint", "off the listener thread"]
  },
  {
    category: 'SPRING',
    question: "How do you handle poison messages?",
    questionVi: "Bạn xử lý poison message (message luôn gây lỗi) như thế nào?",
    outline: [
      {en: "A message that always fails can block or loop forever", vi: "Message luôn lỗi có thể chặn hàng đợi hoặc lặp vô hạn"},
      {en: "Limited retries with backoff, then a dead-letter queue", vi: "Retry có giới hạn kèm backoff, rồi đưa vào dead-letter queue"},
      {en: "Alert on the DLQ; inspect, fix and replay", vi: "Cảnh báo khi DLQ có message; kiểm tra, sửa và chạy lại"}
    ],
    answer: "A poison message is one that will never succeed, for example because its payload is invalid or it hits a bug. If we simply reject and requeue it, it loops forever and can block the other messages. So I retry only a few times, with exponential backoff, for errors that might be temporary, like a timeout. For permanent errors, like a validation failure, I don't retry at all. After the retries, the message goes to a dead-letter queue, with headers that record the error and the original queue. We alert when the DLQ isn't empty, investigate the cause, fix the bug or the data, and then replay the messages from the DLQ with a small tool.",
    keyPhrases: ["will never succeed", "loops forever", "might be temporary", "a dead-letter queue", "replay the messages"]
  },
  {
    category: 'SPRING',
    question: "What is the prefetch count in RabbitMQ, and how do you choose it?",
    questionVi: "Prefetch count trong RabbitMQ là gì, và bạn chọn giá trị thế nào?",
    outline: [
      {en: "How many unacknowledged messages a consumer can hold", vi: "Số message chưa ack mà một consumer được giữ cùng lúc"},
      {en: "High prefetch: throughput, but uneven load and more redelivery", vi: "Prefetch cao: thông lượng tốt, nhưng tải không đều và gửi lại nhiều hơn"},
      {en: "Low prefetch for slow, heavy messages", vi: "Prefetch thấp cho message chậm và nặng"}
    ],
    answer: "Prefetch is the maximum number of unacknowledged messages the broker will push to one consumer at a time. A higher value improves throughput for small, fast messages, because the consumer always has work waiting and doesn't wait for a round trip. But for slow, heavy messages, like a job that drives a browser for a minute, a high prefetch is a problem: one consumer grabs many messages while others sit idle, and if it crashes, all of them are redelivered. So for heavy work I use a prefetch of one or a few, and scale with more consumers. For light messages, a few hundred is fine. As always, I tune it with metrics on queue depth and processing time.",
    keyPhrases: ["unacknowledged messages", "improves throughput", "sit idle", "a prefetch of one", "queue depth"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What makes a good Dockerfile for a Java service?",
    questionVi: "Thế nào là một Dockerfile tốt cho một service Java?",
    outline: [
      {en: "Multi-stage build: build with the JDK, run on a small JRE image", vi: "Build nhiều giai đoạn: build bằng JDK, chạy trên image JRE nhỏ"},
      {en: "Layer caching: dependencies before source code", vi: "Tận dụng cache layer: dependency trước, source code sau"},
      {en: "Non-root user, no secrets in the image, container-aware JVM settings", vi: "User không phải root, không có secret trong image, cấu hình JVM phù hợp container"}
    ],
    answer: "I use a multi-stage build. The first stage has the full JDK and Maven to build the jar, and the final stage uses a small JRE base image with only the application, which makes the image smaller and reduces the attack surface. I order the layers so dependencies are copied and downloaded before the source code, so a code change doesn't re-download everything. Spring Boot's layered jars help with that. The container runs as a non-root user, and there are never secrets in the image: they come from environment variables or a secret store at runtime. I set JVM memory as a percentage of the container limit, with MaxRAMPercentage, and add a health check.",
    keyPhrases: ["a multi-stage build", "the attack surface", "before the source code", "a non-root user", "MaxRAMPercentage"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What is the difference between a Docker image and a container?",
    questionVi: "Docker image và container khác nhau thế nào?",
    outline: [
      {en: "Image: read-only template made of layers", vi: "Image: bản mẫu chỉ đọc, gồm nhiều layer"},
      {en: "Container: a running instance with a writable layer", vi: "Container: một instance đang chạy, có layer ghi được"},
      {en: "Containers are disposable: data goes to volumes or external storage", vi: "Container dùng xong là bỏ: dữ liệu để ở volume hoặc lưu trữ bên ngoài"}
    ],
    answer: "An image is a read-only template: the application, its runtime and its dependencies, built as a stack of layers and identified by a tag or a digest. A container is a running instance of an image. Docker adds a thin writable layer on top and gives it its own process space, network and file system. I can run many containers from the same image. The important point is that containers are disposable: if one is deleted, anything written inside it is lost. So any data that must survive, like database files or uploads, goes to a volume or external storage, and configuration comes from environment variables, so the same image runs in every environment.",
    keyPhrases: ["a read-only template", "a running instance of an image", "a thin writable layer", "containers are disposable", "the same image runs in every environment"]
  },
  {
    category: 'PROJECT',
    question: "How do you review someone else's code?",
    questionVi: "Bạn review code của người khác như thế nào?",
    outline: [
      {en: "Understand the goal first; correctness and security before style", vi: "Hiểu mục tiêu trước; ưu tiên tính đúng và bảo mật hơn phong cách"},
      {en: "Look for tests, edge cases, readability", vi: "Xem test, trường hợp biên, khả năng đọc hiểu"},
      {en: "Kind, specific comments; label nits; approve quickly", vi: "Comment tế nhị, cụ thể; gắn nhãn nit; approve nhanh"}
    ],
    answer: "I start by reading the ticket and the description, so I understand what the change is supposed to do. Then I focus on what matters most: is it correct, including edge cases and error handling, is it secure, for example ownership checks and no sensitive data in logs, and are there tests that prove the behavior? After that, I look at readability and whether it fits the existing design. Style issues should be caught by the formatter, not by me. In my comments, I'm specific and kind, I explain why, and I label small suggestions as nits so the author knows they're optional. I also try to review within a few hours, because slow reviews block the whole team.",
    keyPhrases: ["what the change is supposed to do", "is it correct", "caught by the formatter", "label small suggestions as nits", "slow reviews block the whole team"]
  },
  {
    category: 'PROJECT',
    question: "How do you get up to speed quickly on a new codebase?",
    questionVi: "Bạn làm quen nhanh với một codebase mới như thế nào?",
    outline: [
      {en: "Run it locally and follow one real request end to end", vi: "Chạy được ở local và theo một request thật từ đầu tới cuối"},
      {en: "Read docs, tests and recent PRs; ask focused questions", vi: "Đọc tài liệu, test và PR gần đây; đặt câu hỏi tập trung"},
      {en: "Ship a small change early; write down what you learn", vi: "Giao một thay đổi nhỏ sớm; ghi lại những gì học được"}
    ],
    answer: "First, I get it running locally, because that alone teaches me a lot about the dependencies and the configuration. Then I pick one important user flow, like making a payment, and follow it end to end, from the controller to the database, with the debugger. I read the README, the architecture notes and the tests, because tests show how the code is supposed to be used. Recent pull requests show the team's conventions. I keep a list of questions and ask them in batches, after I've tried to find the answer myself. And I try to ship a small, real change in the first week, because nothing teaches the release process faster. I also update the onboarding docs with whatever was missing.",
    keyPhrases: ["get it running locally", "follow it end to end", "tests show how the code is supposed to be used", "ask them in batches", "ship a small, real change"]
  },
  {
    category: 'SPRING',
    question: "What makes a good unit test?",
    questionVi: "Thế nào là một unit test tốt?",
    outline: [
      {en: "Fast, isolated, repeatable", vi: "Nhanh, tách biệt, chạy lại cho cùng kết quả"},
      {en: "Tests behavior, not implementation; one reason to fail", vi: "Kiểm tra hành vi, không kiểm tra cách cài đặt; một lý do để fail"},
      {en: "Clear name and arrange-act-assert structure", vi: "Tên rõ ràng và cấu trúc arrange-act-assert"}
    ],
    answer: "A good unit test is fast, isolated and repeatable: it runs in milliseconds, doesn't depend on the network, the real clock or other tests, and gives the same result every time. It tests behavior through the public API, not private details, so I can refactor without rewriting the tests. Each test checks one thing, so when it fails, the reason is obvious. I name it after the behavior, like rejectsPaymentWhenBalanceIsInsufficient, and structure it as arrange, act, assert. I use realistic but minimal data, and I cover edge cases, like empty lists, zero amounts and boundaries, not only the happy path. And I make sure I've seen it fail at least once, so I know it actually tests something.",
    keyPhrases: ["fast, isolated and repeatable", "through the public API", "the reason is obvious", "arrange, act, assert", "seen it fail at least once"]
  },
  // ---------- YOUR OWN PROJECT ----------
  {
    category: 'PROJECT',
    question: "Walk me through the architecture of your current project.",
    questionVi: "Hãy trình bày kiến trúc dự án hiện tại của bạn.",
    outline: [
      {en: "Business purpose and users in one sentence", vi: "Mục đích kinh doanh và người dùng trong một câu"},
      {en: "Main components and how a request flows", vi: "Các thành phần chính và luồng đi của một request"},
      {en: "Your part, one key design decision, one thing you'd improve", vi: "Phần bạn làm, một quyết định thiết kế chính, một điều muốn cải thiện"}
    ],
    answer: "The product is [product], used by [users] to [main purpose]. At a high level, it's a [modular monolith or set of microservices] built with Spring Boot and [database], with an Angular front end and a mobile app. A request goes through [gateway or load balancer] to the API, which validates the token, checks ownership, and runs the business logic in the service layer inside a transaction. Slow work, like [example], is done asynchronously through [queue or scheduled jobs]. I mainly own [module], from the database schema to the API. One key design decision was [decision], because [reason]. If I could change one thing, I'd [improvement], because [reason].",
    keyPhrases: ["at a high level", "a request goes through", "inside a transaction", "done asynchronously", "one key design decision"]
  },
  {
    category: 'PROJECT',
    question: "Describe your development workflow, from ticket to production.",
    questionVi: "Hãy mô tả quy trình làm việc của bạn, từ ticket tới production.",
    outline: [
      {en: "Clarify the ticket and acceptance criteria", vi: "Làm rõ ticket và tiêu chí chấp nhận"},
      {en: "Branch, tests, small PR, review, CI", vi: "Tạo nhánh, viết test, PR nhỏ, review, CI"},
      {en: "Staging, QA, release, monitoring", vi: "Staging, QA, phát hành, giám sát"}
    ],
    answer: "First, I make sure the ticket is clear: the acceptance criteria, edge cases, and any API contract with other teams. Then I create a branch from main, write the tests and the code in small steps, and run them locally. I open a small pull request with a clear description and how to test it. The pipeline builds, runs unit and integration tests and static analysis, and at least one teammate reviews it. After merging, it's deployed automatically to staging, where QA tests it. Production releases happen [frequency], with a rollback plan, and after each release I watch the dashboards and error rates for a while. If something goes wrong, we roll back first and investigate after.",
    keyPhrases: ["the acceptance criteria", "a small pull request", "at least one teammate reviews it", "deployed automatically to staging", "roll back first"]
  },
  {
    category: 'PROJECT',
    question: "What is the biggest technical debt in your current project?",
    questionVi: "Nợ kỹ thuật lớn nhất trong dự án hiện tại của bạn là gì?",
    outline: [
      {en: "Name it honestly and explain how it came about", vi: "Nói thẳng nó là gì và vì sao có nó"},
      {en: "Its real cost: bugs, speed, risk", vi: "Chi phí thực tế: bug, tốc độ, rủi ro"},
      {en: "What you're doing about it", vi: "Bạn đang làm gì để xử lý"}
    ],
    answer: "Honestly, the biggest one is [area, for example the reporting module], which was built quickly for the first launch, with business logic mixed into SQL queries and very few tests. It made sense at the time, because we needed to go live fast. Today, the cost is clear: changes in that area take about [number] times longer, and it caused [number] production bugs last quarter. Instead of a big rewrite, we agreed to improve it step by step. We added characterization tests first, and every time we touch it for a feature, we move one part of the logic into the service layer. It's already [improvement, for example half done], and the bug rate in that area has dropped.",
    keyPhrases: ["built quickly for the first launch", "it made sense at the time", "the cost is clear", "instead of a big rewrite", "characterization tests"]
  },
  {
    category: 'PROJECT',
    question: "How do you make sure the code you write is secure?",
    questionVi: "Bạn bảo đảm code mình viết an toàn như thế nào?",
    outline: [
      {en: "Validate input at the boundary; authorize every request", vi: "Kiểm tra dữ liệu đầu vào ở biên; phân quyền cho mọi request"},
      {en: "Protect secrets and sensitive data; safe logging", vi: "Bảo vệ secret và dữ liệu nhạy cảm; log an toàn"},
      {en: "Reviews, scanning, tests for denied cases", vi: "Review, công cụ quét, test cho các trường hợp bị từ chối"}
    ],
    answer: "I treat everything that comes from outside as untrusted, so I validate input at the API boundary and use parameterized queries. For every endpoint, I check not only that the user is logged in, but that they're allowed to access that specific record, and I write tests for the denied cases too. Secrets come from the environment or a vault, never from the code, and I never log tokens, passwords or financial data. Errors return a stable code, not a stack trace. Our pipeline scans dependencies for known vulnerabilities, and in code reviews, security questions are part of my checklist. In a financial product, I also think about idempotency and audit trails as part of security.",
    keyPhrases: ["everything that comes from outside as untrusted", "that specific record", "tests for the denied cases", "never log tokens", "part of my checklist"]
  },
  {
    category: 'PROJECT',
    question: "If you could improve one thing in your current project, what would it be?",
    questionVi: "Nếu được cải thiện một điều trong dự án hiện tại, bạn sẽ chọn điều gì?",
    outline: [
      {en: "Pick something with real impact, not a trendy rewrite", vi: "Chọn điều có tác động thật, không phải viết lại theo trào lưu"},
      {en: "Explain the problem with evidence", vi: "Giải thích vấn đề kèm bằng chứng"},
      {en: "Describe a realistic plan and how you'd measure it", vi: "Mô tả kế hoạch thực tế và cách đo kết quả"}
    ],
    answer: "I'd improve our observability. Today, when something is slow in production, we mostly search through logs from different services by hand, and it took us [time] to find the cause of the last incident. I'd add distributed tracing with OpenTelemetry, put the trace ID in every log line, and define a few alerts based on user impact, like the error rate and p99 latency of the payment API. It's not a big rewrite: we can start with the two most important services. I'd measure success by how quickly we detect and fix incidents, and I'd expect it to also help us find performance problems before users notice them.",
    keyPhrases: ["improve our observability", "by hand", "distributed tracing", "not a big rewrite", "before users notice them"]
  },
  // ---------- FINTECH SYSTEM DESIGN ----------
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design monthly credit card statement generation?",
    questionVi: "Bạn sẽ thiết kế hệ thống tạo sao kê thẻ tín dụng hằng tháng như thế nào?",
    outline: [
      {en: "Batch job per billing cycle, partitioned by card", vi: "Job theo lô cho mỗi kỳ sao kê, chia theo thẻ"},
      {en: "Snapshot the totals; BigDecimal with explicit rounding", vi: "Chốt số liệu tổng; BigDecimal với quy tắc làm tròn rõ ràng"},
      {en: "Idempotent and resumable; statements are immutable", vi: "Idempotent và chạy tiếp được; sao kê không được sửa"}
    ],
    answer: "Each card has a statement date, so I'd run a scheduled job every day that finds the cards whose billing cycle closes today. Work is split into small batches by card, so several workers can process it in parallel, claiming batches with a locking read and SKIP LOCKED. For each card, the job collects the settled transactions in the period, sets the due date, and calculates the statement balance and the minimum payment with BigDecimal and explicit rounding rules, and saves the statement as an immutable record, with a unique constraint on card and period. That makes the job idempotent: if it crashes halfway and runs again, already generated statements are skipped. Pending transactions move to the next cycle. Then a separate step renders the PDF and sends the notification.",
    keyPhrases: ["whose billing cycle closes today", "small batches by card", "explicit rounding rules", "a unique constraint on card and period", "move to the next cycle"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design payment due-date reminders?",
    questionVi: "Bạn sẽ thiết kế tính năng nhắc hạn thanh toán như thế nào?",
    outline: [
      {en: "Store a schedule of reminders, not timers in memory", vi: "Lưu lịch nhắc trong database, không dùng timer trong bộ nhớ"},
      {en: "A scheduled job sends due reminders; respect time zones and preferences", vi: "Job định kỳ gửi các lời nhắc đến hạn; tôn trọng múi giờ và tùy chọn người dùng"},
      {en: "Idempotent sending; cancel when the bill is paid", vi: "Gửi idempotent; hủy khi đã thanh toán"}
    ],
    answer: "When a statement is created, I'd store reminder rows in the database, for example five days before, one day before and on the due date, each with a send time in the user's time zone. I wouldn't use in-memory timers, because they're lost on restart and don't work with several instances. A scheduled job runs every few minutes, claims the reminders that are due, and publishes them to the notification service through a queue. Each reminder has a unique ID, so retries don't send the same message twice. Before sending, the job checks whether the bill has already been paid, and if so, it cancels the remaining reminders. Users can choose their channels, like push or email, and we respect quiet hours.",
    keyPhrases: ["store reminder rows in the database", "lost on restart", "claims the reminders that are due", "don't send the same message twice", "quiet hours"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you reconcile your transactions with a bank's settlement file?",
    questionVi: "Bạn sẽ đối soát giao dịch của mình với file quyết toán của ngân hàng như thế nào?",
    outline: [
      {en: "Import the file idempotently and keep the raw copy", vi: "Nhập file theo cách idempotent và giữ bản gốc"},
      {en: "Match by reference, then by amount and date", vi: "Ghép theo mã tham chiếu, rồi theo số tiền và ngày"},
      {en: "Report breaks; resolve them with a reviewed workflow, never silently", vi: "Báo cáo chênh lệch; xử lý qua quy trình có duyệt, không âm thầm sửa"}
    ],
    answer: "Every day, the bank sends a settlement file. First, I store the raw file, and import it idempotently, using the file name and a checksum, so importing the same file twice does nothing. Then the matching runs: most records match exactly by the transaction reference, and the rest are matched by amount, currency and date within a small tolerance. The output has three groups: matched, missing on our side, and missing on the bank's side, plus amount mismatches. Those breaks go into a report and a queue for the finance team. We never change the ledger automatically to make the numbers fit. Any correction is a new, reviewed adjustment entry, so the audit trail stays complete.",
    keyPhrases: ["store the raw file", "importing the same file twice does nothing", "by the transaction reference", "never change the ledger automatically", "a new, reviewed adjustment entry"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you support multiple currencies in a wallet?",
    questionVi: "Bạn sẽ hỗ trợ nhiều loại tiền tệ trong một ví điện tử như thế nào?",
    outline: [
      {en: "Store amount plus currency code; one balance per currency", vi: "Lưu số tiền kèm mã tiền tệ; mỗi loại tiền một số dư"},
      {en: "Respect each currency's decimal places; BigDecimal", vi: "Tôn trọng số chữ số thập phân của từng loại tiền; BigDecimal"},
      {en: "Conversion as an explicit, quoted, recorded operation", vi: "Quy đổi là một thao tác rõ ràng, có báo giá và được ghi nhận"}
    ],
    answer: "I'd never store an amount without its currency. Every amount is a pair: a BigDecimal value and an ISO currency code, like VND or USD, and I'd model it as a Money value object, so the code can't accidentally add dong to dollars. Each wallet keeps a separate balance per currency. Currencies have different decimal places, for example VND has none and USD has two, so rounding depends on the currency. Converting between currencies is an explicit operation: we get a quote with the exchange rate and an expiry time, the user confirms it, and we record the rate and both amounts in the ledger. That way, every past conversion can be explained exactly, even after rates change.",
    keyPhrases: ["never store an amount without its currency", "a Money value object", "different decimal places", "an explicit operation", "record the rate and both amounts"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a simple fraud detection rule engine?",
    questionVi: "Bạn sẽ thiết kế một rule engine phát hiện gian lận đơn giản như thế nào?",
    outline: [
      {en: "Rules as data: amount limits, velocity, location, new device", vi: "Quy tắc dạng dữ liệu: hạn mức, tần suất, vị trí, thiết bị mới"},
      {en: "Decide allow, review or block, with a reason; fast path in the request", vi: "Quyết định cho phép, xem xét hoặc chặn, kèm lý do; xử lý nhanh ngay trong request"},
      {en: "Counters in Redis; audit every decision; tune with data", vi: "Bộ đếm trong Redis; lưu vết mọi quyết định; tinh chỉnh bằng dữ liệu"}
    ],
    answer: "I'd start with rules, not machine learning, because rules are easy to explain to auditors. Each rule is configuration, not code: for example, a single payment over a limit, more than five transfers in ten minutes, a login from a new device followed by a large transfer, or a payment from a new country. When a payment arrives, the engine evaluates the rules in a few milliseconds and returns allow, review or block, with the reasons. Velocity rules need fast counters, so I'd keep them in Redis with a TTL. Every decision is stored with the rule versions that produced it. Payments in review go to a queue for analysts, and their feedback helps us tune the thresholds to reduce false positives.",
    keyPhrases: ["rules are easy to explain to auditors", "configuration, not code", "allow, review or block", "fast counters", "false positives"]
  },
  // ---------- FREQUENTLY ASKED BASICS ----------
  {
    category: 'JAVA_CORE',
    question: "Runnable vs Callable - what's the difference?",
    questionVi: "Runnable và Callable khác nhau thế nào?",
    outline: [
      {en: "Runnable.run returns nothing and can't throw checked exceptions", vi: "Runnable.run không trả về gì và không ném được checked exception"},
      {en: "Callable.call returns a value and can throw", vi: "Callable.call trả về giá trị và có thể ném exception"},
      {en: "Submitted to an ExecutorService, both give a Future", vi: "Khi submit vào ExecutorService, cả hai đều trả về Future"}
    ],
    answer: "Both represent a task that can run on another thread. Runnable has a run method that returns nothing and can't throw checked exceptions, so it's for fire-and-forget work. Callable has a call method that returns a result and can throw any exception. When I submit either one to an ExecutorService, I get a Future. With a Callable, future.get returns the value, and if the task failed, get throws an ExecutionException that wraps the original error. In modern code, I often use CompletableFuture.supplyAsync instead, which plays a similar role to Callable but is easier to compose.",
    keyPhrases: ["returns nothing", "returns a result", "I get a Future", "an ExecutionException", "supplyAsync"]
  },
  {
    category: 'JAVA_CORE',
    question: "What is a functional interface?",
    questionVi: "Functional interface là gì?",
    outline: [
      {en: "An interface with exactly one abstract method", vi: "Interface có đúng một method trừu tượng"},
      {en: "Can be implemented with a lambda or method reference", vi: "Có thể cài đặt bằng lambda hoặc method reference"},
      {en: "Built-ins: Function, Supplier, Consumer, Predicate", vi: "Có sẵn: Function, Supplier, Consumer, Predicate"}
    ],
    answer: "A functional interface has exactly one abstract method, so it can be implemented with a lambda expression or a method reference. It can still have default and static methods. The @FunctionalInterface annotation is optional, but it makes the compiler check that there's only one abstract method. The JDK provides the common ones in java.util.function: Function takes a value and returns another, Supplier returns a value, Consumer accepts a value and returns nothing, and Predicate returns a boolean. Runnable and Comparator are also functional interfaces. They're what make streams and CompletableFuture so concise.",
    keyPhrases: ["exactly one abstract method", "a method reference", "the compiler check", "java.util.function", "Predicate returns a boolean"]
  },
  {
    category: 'JAVA_CORE',
    question: "What happens if a class implements two interfaces with the same default method?",
    questionVi: "Điều gì xảy ra nếu một class implement hai interface có cùng default method?",
    outline: [
      {en: "Compile error: the class must resolve the conflict", vi: "Lỗi biên dịch: class phải tự giải quyết xung đột"},
      {en: "Override it, optionally calling InterfaceName.super.method()", vi: "Override method đó, có thể gọi InterfaceName.super.method()"},
      {en: "Rules: class methods win; more specific interface wins", vi: "Quy tắc: method của class thắng; interface cụ thể hơn thắng"}
    ],
    answer: "That's the diamond problem with default methods. If two unrelated interfaces both provide a default method with the same signature, the compiler doesn't guess: it reports an error, and the class must override the method. Inside the override, I can call one of them explicitly with the interface name, dot super, dot the method name. There are also clear rules: a method from a superclass always wins over interface defaults, and if one interface extends the other, the more specific one wins. Because Java has no multiple inheritance of state, this conflict is easy to resolve.",
    keyPhrases: ["the diamond problem", "the compiler doesn't guess", "must override the method", "a superclass always wins", "the more specific one wins"]
  },
  {
    category: 'JAVA_CORE',
    question: "What are the pitfalls of autoboxing?",
    questionVi: "Autoboxing có những cạm bẫy gì?",
    outline: [
      {en: "Unboxing null throws NullPointerException", vi: "Unboxing giá trị null gây NullPointerException"},
      {en: "== on wrapper objects compares references", vi: "== trên wrapper so sánh tham chiếu"},
      {en: "Hidden allocations in loops; prefer primitives", vi: "Cấp phát ẩn trong vòng lặp; ưu tiên kiểu nguyên thủy"}
    ],
    answer: "Autoboxing converts between primitives and wrapper objects automatically, like int and Integer, which is convenient but hides a few traps. The most common one is a NullPointerException when a null Integer is unboxed, for example when a map returns null for a missing key and we assign it to an int. The second is comparing wrappers with double equals, which compares references, so it may work for small values because of the Integer cache, and then fail for larger ones. The third is performance: boxing inside a tight loop creates lots of objects, so for heavy calculations I use primitives or primitive streams like IntStream.",
    keyPhrases: ["converts between primitives and wrapper objects", "a null Integer is unboxed", "compares references", "the Integer cache", "primitive streams"]
  },
  {
    category: 'SPRING',
    question: "What does @Transactional with readOnly set to true do?",
    questionVi: "@Transactional(readOnly = true) có tác dụng gì?",
    outline: [
      {en: "A hint: Hibernate skips dirty checking and flushing", vi: "Một gợi ý: Hibernate bỏ qua dirty checking và flush"},
      {en: "The JDBC connection can be set read-only; routing to replicas", vi: "Kết nối JDBC có thể đặt chỉ đọc; định tuyến sang replica"},
      {en: "Not a security mechanism", vi: "Không phải cơ chế bảo mật"}
    ],
    answer: "It marks the transaction as read-only, which is mainly an optimization hint. Hibernate sets the session's flush mode to manual and can skip dirty checking, so it doesn't keep snapshots of every loaded entity or check them at the end, which saves memory and CPU for big queries. Spring also marks the JDBC connection as read-only, which some databases and drivers can optimize, and a routing data source can use it to send the query to a read replica. It still gives a consistent read within the transaction. But it isn't a security feature: I wouldn't rely on it to prevent writes, and it doesn't replace proper authorization.",
    keyPhrases: ["an optimization hint", "skip dirty checking", "marks the JDBC connection as read-only", "a read replica", "isn't a security feature"]
  },
  {
    category: 'SPRING',
    question: "How do you validate requests in a Spring Boot API?",
    questionVi: "Bạn kiểm tra dữ liệu request trong API Spring Boot như thế nào?",
    outline: [
      {en: "Bean Validation annotations on DTOs; @Valid on the parameter", vi: "Annotation Bean Validation trên DTO; @Valid ở tham số"},
      {en: "Consistent 400 errors through a global handler", vi: "Lỗi 400 nhất quán qua handler toàn cục"},
      {en: "Business rules in the service; custom validators for reusable rules", vi: "Quy tắc nghiệp vụ trong service; custom validator cho quy tắc dùng lại"}
    ],
    answer: "For the shape of the input, I use Bean Validation on the request DTOs, with annotations like NotBlank, Size, Email, and Positive or DecimalMin for amounts, and I put @Valid on the controller parameter. If validation fails, Spring throws a MethodArgumentNotValidException, and my global exception handler turns it into a consistent 400 response that lists each invalid field. For reusable rules, like a valid IBAN, I write a custom constraint annotation. But rules that need the database or business context, like whether the account has enough balance or belongs to the user, belong in the service layer, not in annotations. And I never trust the client's validation alone.",
    keyPhrases: ["Bean Validation", "MethodArgumentNotValidException", "a consistent 400 response", "a custom constraint annotation", "belong in the service layer"]
  },
  {
    category: 'SPRING',
    question: "@Controller vs @RestController - what's the difference?",
    questionVi: "@Controller và @RestController khác nhau thế nào?",
    outline: [
      {en: "@RestController = @Controller + @ResponseBody", vi: "@RestController = @Controller + @ResponseBody"},
      {en: "Return values are serialized to JSON", vi: "Giá trị trả về được chuyển thành JSON"},
      {en: "@Controller returns view names for server-side templates", vi: "@Controller trả về tên view cho template phía server"}
    ],
    answer: "@RestController is a shortcut for @Controller plus @ResponseBody on every method. With it, the value a handler method returns is written directly into the HTTP response body, usually serialized to JSON by Jackson. With a plain @Controller, the return value is normally treated as a view name, and a template engine like Thymeleaf renders HTML on the server. So for a REST API consumed by Angular or a mobile app, I use @RestController, and I return DTOs or a ResponseEntity when I need to control the status code and headers.",
    keyPhrases: ["a shortcut for @Controller plus @ResponseBody", "directly into the HTTP response body", "treated as a view name", "for a REST API", "a ResponseEntity"]
  },
  {
    category: 'SPRING',
    question: "How does Spring handle circular dependencies?",
    questionVi: "Spring xử lý phụ thuộc vòng (circular dependency) như thế nào?",
    outline: [
      {en: "Constructor injection cycles fail at startup", vi: "Vòng phụ thuộc với constructor injection sẽ lỗi khi khởi động"},
      {en: "Spring Boot 2.6+ forbids cycles by default", vi: "Spring Boot 2.6+ mặc định cấm phụ thuộc vòng"},
      {en: "Fix the design: extract a third class or use events", vi: "Sửa thiết kế: tách ra class thứ ba hoặc dùng event"}
    ],
    answer: "If bean A needs B in its constructor and B needs A, Spring can't create either one, so startup fails with a clear error about the cycle. With field or setter injection, Spring used to resolve some cycles by injecting an early reference, but since Spring Boot 2.6, circular references are prohibited by default, which I think is a good decision. A cycle usually means the responsibilities are mixed up. My fix is to change the design: extract the shared logic into a third class that both can depend on, or decouple them with an application event. Using @Lazy can hide the problem, but I'd treat it as a temporary workaround.",
    keyPhrases: ["startup fails", "an early reference", "prohibited by default", "extract the shared logic into a third class", "a temporary workaround"]
  },
  {
    category: 'DATABASE',
    question: "What is a composite index, and what is the leftmost prefix rule?",
    questionVi: "Composite index là gì, và quy tắc leftmost prefix là gì?",
    outline: [
      {en: "An index on several columns, sorted by the first, then the second…", vi: "Index trên nhiều cột, sắp theo cột đầu, rồi cột thứ hai…"},
      {en: "Usable only from the leftmost columns, without gaps", vi: "Chỉ dùng được từ các cột bên trái, không được bỏ qua cột ở giữa"},
      {en: "Order: equality columns first, then range or sort", vi: "Thứ tự: cột so sánh bằng trước, rồi tới cột khoảng hoặc sắp xếp"}
    ],
    answer: "A composite index covers several columns, for example user ID, status and created date. It's sorted by the first column, then by the second within it, and so on, like a phone book sorted by last name and then first name. The leftmost prefix rule says the database can use it only for conditions that start from the leftmost column. So it helps queries on user ID, or user ID and status, but not a query on status alone. When I design one, I put the columns used in equality conditions first, and then a column used for a range or for ORDER BY, so one index can both filter and return rows already sorted. One well-designed composite index often replaces several single-column ones.",
    keyPhrases: ["covers several columns", "like a phone book", "start from the leftmost column", "not a query on status alone", "already sorted"]
  },
  // ---------- CLASSIC HR QUESTIONS ----------
  {
    category: 'PROJECT',
    question: "Why should we hire you?",
    questionVi: "Vì sao chúng tôi nên tuyển bạn?",
    outline: [
      {en: "Match two or three requirements of the role with proof", vi: "Ghép hai hoặc ba yêu cầu của vị trí với bằng chứng"},
      {en: "One thing that makes you different", vi: "Một điều khiến bạn khác biệt"},
      {en: "End with enthusiasm for this team", vi: "Kết thúc bằng sự hào hứng với nhóm này"}
    ],
    answer: "From the job description, you need someone who can build reliable Java and Spring Boot services, tune SQL performance, and communicate well with clients. That's exactly what I've been doing for [number] years. For example, I [achievement with a number, like reduced report time by sixty percent]. What makes me a bit different is that I care a lot about correctness in financial systems: idempotency, audit trails and tests for money logic. I'm also comfortable explaining technical trade-offs to non-technical people. I'm really excited about this role, and I'm confident I can contribute from the first few weeks.",
    keyPhrases: ["from the job description", "that's exactly what I've been doing", "what makes me a bit different", "explaining technical trade-offs", "from the first few weeks"]
  },
  {
    category: 'PROJECT',
    question: "What motivates you at work?",
    questionVi: "Điều gì tạo động lực cho bạn trong công việc?",
    outline: [
      {en: "Something genuine and related to the job", vi: "Điều chân thật và liên quan tới công việc"},
      {en: "A short example", vi: "Một ví dụ ngắn"},
      {en: "Connect it to this role", vi: "Liên hệ với vị trí này"}
    ],
    answer: "I'm most motivated when I can see the real impact of my work on users. For example, after we fixed a slow statement page, we got messages from support saying customers had stopped complaining, and that felt great. I also enjoy solving hard problems, like tracking down a bug that only happens in production, and I like learning from people who are better than me. That's one reason this role appeals to me: the systems you build are used by many clients, and I'd be working with very experienced engineers.",
    keyPhrases: ["the real impact of my work", "that felt great", "solving hard problems", "learning from people who are better than me", "this role appeals to me"]
  },
  {
    category: 'PROJECT',
    question: "How would your colleagues describe you?",
    questionVi: "Đồng nghiệp sẽ mô tả bạn như thế nào?",
    outline: [
      {en: "Three adjectives", vi: "Ba tính từ"},
      {en: "Back them up with real feedback or examples", vi: "Chứng minh bằng nhận xét hoặc ví dụ thật"},
      {en: "Optionally, one honest area to improve", vi: "Có thể thêm một điểm cần cải thiện một cách trung thực"}
    ],
    answer: "I think they'd say I'm reliable, helpful and calm under pressure. Reliable, because when I say something will be done by Friday, it's done, or I warn people early. In my last review, my lead wrote that I was the person the team trusts with critical releases. Helpful, because I often pair with newer teammates and answer questions in our channel. And calm, because during incidents I focus on the facts instead of panicking. They might also say I sometimes go too deep into details, which I'm working on by timeboxing my investigations.",
    keyPhrases: ["reliable, helpful and calm under pressure", "I warn people early", "in my last review", "focus on the facts", "timeboxing my investigations"]
  },
  {
    category: 'PROJECT',
    question: "What is your biggest professional achievement?",
    questionVi: "Thành tựu nghề nghiệp lớn nhất của bạn là gì?",
    outline: [
      {en: "Pick one achievement with a clear, measurable result", vi: "Chọn một thành tựu có kết quả rõ ràng, đo được"},
      {en: "Explain your personal contribution, not just the team's", vi: "Giải thích đóng góp của riêng bạn, không chỉ của nhóm"},
      {en: "Why it matters to you", vi: "Vì sao nó có ý nghĩa với bạn"}
    ],
    answer: "My biggest achievement was leading the migration of our payment service to a new architecture without any downtime. The old service often failed during peak hours, and every failure meant customers couldn't pay. I designed the plan to move one endpoint at a time behind a feature flag, wrote most of the idempotency and reconciliation logic, and coordinated with QA and the operations team. After the migration, payment errors dropped by [number] percent, and we handled twice the traffic on payday. It matters to me because it was the first time I owned something that big from start to finish.",
    keyPhrases: ["without any downtime", "one endpoint at a time", "wrote most of the idempotency", "dropped by", "from start to finish"]
  },
  {
    category: 'PROJECT',
    question: "How do you handle stress and pressure?",
    questionVi: "Bạn xử lý căng thẳng và áp lực như thế nào?",
    outline: [
      {en: "Acknowledge that pressure is normal", vi: "Thừa nhận áp lực là bình thường"},
      {en: "Concrete habits: break down work, prioritize, communicate", vi: "Thói quen cụ thể: chia nhỏ việc, ưu tiên, giao tiếp"},
      {en: "Recovery outside work", vi: "Cách hồi phục ngoài giờ làm"}
    ],
    answer: "Some pressure is normal in our work, and it actually helps me focus. What I do is break the problem into small steps, so it doesn't feel overwhelming, and decide what really matters first. I also communicate early: if I see that something isn't realistic, I say it, instead of silently working until midnight. During incidents, I follow the runbook and focus on facts. Outside work, I [activity, for example play badminton or go running], which helps me reset. And after a stressful period, I like to do a short retro, so the next time is calmer.",
    keyPhrases: ["it actually helps me focus", "break the problem into small steps", "communicate early", "follow the runbook", "helps me reset"]
  },
  {
    category: 'PROJECT',
    question: "What kind of manager or team do you work best with?",
    questionVi: "Bạn làm việc tốt nhất với kiểu quản lý hay nhóm như thế nào?",
    outline: [
      {en: "Be positive and flexible, not demanding", vi: "Tích cực và linh hoạt, không đòi hỏi"},
      {en: "Clear goals, trust, honest feedback", vi: "Mục tiêu rõ ràng, sự tin tưởng, góp ý thẳng thắn"},
      {en: "Show that you adapt", vi: "Cho thấy bạn có thể thích nghi"}
    ],
    answer: "I work best with a manager who sets clear goals and priorities, then trusts the team to decide how to reach them, and who gives honest feedback regularly, not only once a year. In a team, I like a culture where people share knowledge, review each other's code kindly, and can admit mistakes without fear. That said, I've worked with very different styles, from very hands-on managers to very hands-off ones, and I adapt. For example, with a hands-off manager, I make sure to send short written updates, so they always know where things stand.",
    keyPhrases: ["sets clear goals and priorities", "trusts the team", "admit mistakes without fear", "I adapt", "short written updates"]
  },
  {
    category: 'PROJECT',
    question: "What do you do outside of work?",
    questionVi: "Ngoài giờ làm việc bạn làm gì?",
    outline: [
      {en: "One or two real interests, briefly", vi: "Một hoặc hai sở thích thật, ngắn gọn"},
      {en: "What you get from them", vi: "Bạn nhận được gì từ chúng"},
      {en: "Optional: side projects or learning", vi: "Có thể nhắc: dự án cá nhân hoặc việc học"}
    ],
    answer: "Outside work, I [hobby, for example play badminton twice a week], which keeps me healthy and is a good way to switch off from screens. I also enjoy [second interest, for example cooking or travelling], and recently I [something specific, for example visited Da Lat with friends]. On the learning side, I'm working on my English every day, mostly by listening to tech podcasts and practising speaking, and I sometimes build small side projects, like a personal finance app, to try new technologies.",
    keyPhrases: ["switch off from screens", "on the learning side", "working on my English every day", "small side projects", "try new technologies"]
  },
  // ---------- CLASSIC DESIGN PROBLEMS ----------
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a ticket booking system that prevents double booking?",
    questionVi: "Bạn sẽ thiết kế hệ thống đặt vé chống đặt trùng chỗ như thế nào?",
    outline: [
      {en: "Hold a seat for a few minutes with an expiry", vi: "Giữ chỗ trong vài phút kèm thời hạn"},
      {en: "Unique constraint or conditional update decides the winner", vi: "Ràng buộc unique hoặc cập nhật có điều kiện quyết định ai thắng"},
      {en: "Pay within the hold; release expired holds; idempotent payment", vi: "Thanh toán trong thời gian giữ; giải phóng chỗ hết hạn; thanh toán idempotent"}
    ],
    answer: "The key problem is that many users try to book the same seat at the same moment. When a user selects a seat, I create a hold with an expiry, for example ten minutes. The database decides who wins: a conditional update that changes the seat from available to held only if it's still available, or a unique constraint on the event and seat in a holds table. Only one request succeeds, and the others get a clear message to choose another seat. The user pays within the hold time, using an idempotency key, and the payment confirms the booking only if the hold is still valid; a late payment after expiry is refunded. A scheduled job releases expired holds. For very popular events, I'd add a virtual waiting room in front, so the system isn't flooded.",
    keyPhrases: ["at the same moment", "a hold with an expiry", "the database decides who wins", "only one request succeeds", "a virtual waiting room"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a distributed job scheduler?",
    questionVi: "Bạn sẽ thiết kế một bộ lập lịch job phân tán như thế nào?",
    outline: [
      {en: "Jobs stored in a database with next run time and status", vi: "Job lưu trong database với thời gian chạy tiếp theo và trạng thái"},
      {en: "Workers claim due jobs with SKIP LOCKED; lease with timeout", vi: "Worker nhận job đến hạn bằng SKIP LOCKED; giữ quyền xử lý có thời hạn (lease)"},
      {en: "Retries, idempotency, history and monitoring", vi: "Retry, idempotency, lịch sử và giám sát"}
    ],
    answer: "I'd store each job definition in a database table, with its schedule, the next run time and a status. Several worker instances poll for due jobs and claim them with SELECT FOR UPDATE SKIP LOCKED, so each job is picked by exactly one worker without blocking the others. A claimed job gets a lease with a timeout: if the worker crashes, the lease expires and another worker can pick it up. That means a job can run more than once, so job handlers must be idempotent. Failed runs are retried with backoff up to a limit, and every run is recorded in a history table with its duration and error. We alert on jobs that fail repeatedly or haven't run on time. For simpler needs, a library like Quartz in cluster mode does most of this.",
    keyPhrases: ["the next run time", "exactly one worker", "a lease with a timeout", "must be idempotent", "a history table"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design the checkout flow of an online shop?",
    questionVi: "Bạn sẽ thiết kế luồng thanh toán của một cửa hàng online như thế nào?",
    outline: [
      {en: "Order created as pending; reserve stock; idempotent payment", vi: "Tạo đơn ở trạng thái chờ; giữ hàng tồn kho; thanh toán idempotent"},
      {en: "Payment provider webhook confirms; state machine for the order", vi: "Webhook của nhà cung cấp thanh toán xác nhận; máy trạng thái cho đơn hàng"},
      {en: "Compensate on failure: release stock, refund", vi: "Bù trừ khi lỗi: trả lại tồn kho, hoàn tiền"}
    ],
    answer: "When the user clicks pay, I create the order in a pending state, with the prices and totals calculated on the server, never trusted from the client. I reserve the stock with a conditional update, so we can't sell more than we have. Then I start the payment with the provider, using the order ID as the idempotency key. The final result usually arrives through a webhook, which I verify with the provider's signature and handle idempotently, because webhooks can be sent more than once. The order follows a clear state machine, like pending, paid, shipped or cancelled. If the payment fails, or it times out and the provider confirms it wasn't charged, a compensation step releases the stock, and a late success after that is refunded. Confirmation emails are sent asynchronously through a queue.",
    keyPhrases: ["in a pending state", "never trusted from the client", "the idempotency key", "verify with the provider's signature", "a clear state machine"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How would you design a distributed cache?",
    questionVi: "Bạn sẽ thiết kế một hệ thống cache phân tán như thế nào?",
    outline: [
      {en: "Partition keys across nodes with consistent hashing", vi: "Chia key cho các node bằng consistent hashing"},
      {en: "Eviction (LRU), TTL, memory limits", vi: "Cơ chế loại bỏ (LRU), TTL, giới hạn bộ nhớ"},
      {en: "Replication for availability; hot keys; usually just use Redis Cluster", vi: "Sao chép để tăng tính sẵn sàng; hot key; thường chỉ cần dùng Redis Cluster"}
    ],
    answer: "In practice I'd use Redis Cluster or a managed service, but the design ideas are the same. Keys are partitioned across nodes, using consistent hashing or hash slots, so adding a node only moves a small part of the keys. Each node has a memory limit and an eviction policy, usually least recently used, and entries have a TTL. For availability, each partition has a replica that can take over if the primary fails, accepting that the replica may be slightly behind. Clients route requests directly to the right node. Two common problems are hot keys, which I'd handle with a small local cache in front or by splitting the key, and cache stampedes, which I'd handle with TTL jitter and a lock when rebuilding a value.",
    keyPhrases: ["Redis Cluster", "hash slots", "an eviction policy", "a replica that can take over", "hot keys"]
  },
  // ---------- PRACTICAL BACKEND: TIME, MONEY, SPRING DATA ----------
  {
    category: 'JAVA_CORE',
    question: "How do you handle dates, times and time zones in Java?",
    questionVi: "Bạn xử lý ngày, giờ và múi giờ trong Java như thế nào?",
    outline: [
      {en: "Store moments as Instant in UTC", vi: "Lưu thời điểm dưới dạng Instant theo UTC"},
      {en: "LocalDate for business dates like a due date; ZonedDateTime for display", vi: "LocalDate cho ngày nghiệp vụ như hạn thanh toán; ZonedDateTime để hiển thị"},
      {en: "Never use the server's default time zone; inject a Clock", vi: "Không bao giờ dựa vào múi giờ mặc định của server; inject một Clock"}
    ],
    answer: "I use the java.time API and choose the type by meaning. A moment in time, like when a payment was made, is an Instant stored in UTC, in a timestamp column. A business date without a time, like a statement date or a due date, is a LocalDate, and I'm careful to define which time zone decides that date, for example Vietnam time. I only convert to a ZonedDateTime with the user's zone when I display it. I never rely on the server's default time zone, because containers often run in UTC while users are in UTC plus seven. And I inject a Clock instead of calling now directly, so the code is easy to test.",
    keyPhrases: ["the java.time API", "an Instant stored in UTC", "a LocalDate", "the server's default time zone", "inject a Clock"]
  },
  {
    category: 'JAVA_CORE',
    question: "What are the pitfalls of using BigDecimal for money?",
    questionVi: "Dùng BigDecimal cho tiền tệ có những cạm bẫy gì?",
    outline: [
      {en: "Never construct from a double; use strings or valueOf", vi: "Không khởi tạo từ double; dùng chuỗi hoặc valueOf"},
      {en: "equals compares scale; use compareTo", vi: "equals so sánh cả scale; dùng compareTo"},
      {en: "Always set scale and rounding mode on division and conversion", vi: "Luôn đặt scale và rounding mode khi chia và quy đổi"}
    ],
    answer: "BigDecimal is the right type for money, but there are classic traps. First, never create it from a double, because new BigDecimal of zero point one gives a long, inexact number. I use the string constructor or BigDecimal.valueOf. Second, equals also compares the scale, so one point zero and one point zero zero are not equal, which is why I compare amounts with compareTo. Third, division without a rounding mode throws an ArithmeticException for results like one divided by three, so I always pass the scale and a rounding mode, usually half-up or half-even, as the business rule defines. I also round only at defined points, like the final statement amount, not after every step, and I store the currency with the amount.",
    keyPhrases: ["never create it from a double", "BigDecimal.valueOf", "also compares the scale", "throws an ArithmeticException", "round only at defined points"]
  },
  {
    category: 'SPRING',
    question: "How do you test code that depends on the current time?",
    questionVi: "Bạn test code phụ thuộc vào thời gian hiện tại như thế nào?",
    outline: [
      {en: "Inject java.time.Clock as a bean", vi: "Inject java.time.Clock như một bean"},
      {en: "Use Clock.fixed in tests, or a mutable test clock", vi: "Dùng Clock.fixed trong test, hoặc một clock test có thể thay đổi"},
      {en: "Test boundaries: midnight, month end, time zones", vi: "Test các ranh giới: nửa đêm, cuối tháng, múi giờ"}
    ],
    answer: "Code that calls LocalDate.now directly is hard to test, because the result changes every day. So I inject a java.time.Clock, defined once as a bean, and the code calls LocalDate.now with that clock. In unit tests, I pass Clock.fixed with a specific instant and zone, so the test always behaves the same. For flows where time passes, like a hold that expires after ten minutes, I use a small mutable test clock that I can move forward. That makes it easy to test the tricky boundaries: just before and after midnight, the last day of the month, a leap year, and the difference between UTC and Vietnam time.",
    keyPhrases: ["calls LocalDate.now directly", "inject a java.time.Clock", "Clock.fixed", "a small mutable test clock", "the tricky boundaries"]
  },
  {
    category: 'SPRING',
    question: "Derived queries, @Query or Specifications - how do you choose in Spring Data JPA?",
    questionVi: "Derived query, @Query hay Specification - bạn chọn thế nào trong Spring Data JPA?",
    outline: [
      {en: "Derived queries for simple lookups", vi: "Derived query cho các truy vấn đơn giản"},
      {en: "@Query with JPQL or native SQL for anything complex", vi: "@Query với JPQL hoặc SQL gốc cho truy vấn phức tạp"},
      {en: "Specifications or Querydsl for dynamic filters", vi: "Specification hoặc Querydsl cho bộ lọc động"}
    ],
    answer: "For simple lookups, derived query methods are great, like findByOwnerIdAndStatus, because they're readable and checked at startup. When the method name would become very long, or I need joins, aggregations or a fetch join, I write the query explicitly with @Query in JPQL, or as native SQL when I need database-specific features, like JSON functions or index hints. For search screens where the user can combine many optional filters, I use Specifications, or Querydsl, to build the query dynamically instead of writing every combination. In all cases, I add Pageable for lists and check the generated SQL, especially for N plus one problems.",
    keyPhrases: ["derived query methods", "checked at startup", "with @Query in JPQL", "many optional filters", "check the generated SQL"]
  },
  {
    category: 'SPRING',
    question: "What are projections in Spring Data, and why use them?",
    questionVi: "Projection trong Spring Data là gì, và vì sao nên dùng?",
    outline: [
      {en: "Select only the fields a use case needs", vi: "Chỉ lấy các trường mà use case cần"},
      {en: "Interface or record (DTO) projections", vi: "Projection dạng interface hoặc record (DTO)"},
      {en: "Faster queries, no lazy-loading issues, no accidental exposure", vi: "Query nhanh hơn, không lỗi lazy loading, không vô tình lộ dữ liệu"}
    ],
    answer: "A projection lets a repository return only the fields a use case needs, instead of full entities. I can declare an interface with getters, or, my preference, a record DTO, and Spring Data selects just those columns. For example, a statement list only needs the ID, the period, the balance and the status, not every transaction. This makes queries faster and uses less memory, avoids lazy-loading surprises because there are no entity relationships to traverse, and makes it much harder to accidentally return a sensitive field to the client. Because the results aren't managed entities, there's also no dirty checking cost, which is ideal for read-only screens.",
    keyPhrases: ["only the fields a use case needs", "a record DTO", "uses less memory", "lazy-loading surprises", "no dirty checking cost"]
  },
  // ---------- PLATFORM & OPERATIONS BASICS ----------
  {
    category: 'JAVA_CORE',
    question: "What is the difference between a process and a thread?",
    questionVi: "Process và thread khác nhau thế nào?",
    outline: [
      {en: "A process has its own memory; threads share the process's memory", vi: "Process có vùng nhớ riêng; các thread dùng chung bộ nhớ của process"},
      {en: "Threads are cheaper to create and switch, but need synchronization", vi: "Thread rẻ hơn khi tạo và chuyển đổi, nhưng cần đồng bộ hóa"},
      {en: "A JVM is one process with many threads", vi: "Một JVM là một process với nhiều thread"}
    ],
    answer: "A process is a running program with its own memory space, file handles and resources, isolated from other processes by the operating system. A thread is a unit of execution inside a process, and all threads of a process share the same heap memory, while each has its own stack. That makes threads cheaper to create and to switch between, and it makes communication easy, but it also means shared data needs synchronization. A crash in one process doesn't affect another, but a bad thread can corrupt the state of its whole process. A Java application is one JVM process with many threads, like request threads, GC threads and, today, virtual threads on top of a few carrier threads.",
    keyPhrases: ["its own memory space", "share the same heap memory", "its own stack", "needs synchronization", "one JVM process with many threads"]
  },
  {
    category: 'SPRING',
    question: "How does single sign-on work with SAML or OpenID Connect?",
    questionVi: "Single sign-on (SSO) hoạt động thế nào với SAML hoặc OpenID Connect?",
    outline: [
      {en: "Users log in once at an identity provider", vi: "Người dùng đăng nhập một lần tại identity provider"},
      {en: "SAML: signed XML assertions; OIDC: ID token (JWT) on top of OAuth2", vi: "SAML: assertion XML có chữ ký; OIDC: ID token (JWT) dựa trên OAuth2"},
      {en: "The app trusts the provider's signature, not a password", vi: "Ứng dụng tin chữ ký của provider, không phải mật khẩu"}
    ],
    answer: "With single sign-on, users authenticate once with a central identity provider, like Microsoft Entra ID, Okta or Keycloak, and then access many applications without logging in again. Our application never sees the password. In SAML, which is older and common in enterprises, the identity provider sends a signed XML assertion through the browser, and our app verifies the signature and reads the user's attributes. OpenID Connect is a modern identity layer on top of OAuth2: the app uses the authorization code flow and receives an ID token, a signed JWT with claims about the user. In Spring Boot, Spring Security supports both. For a consulting client, SSO also means central control: when someone leaves the company, disabling one account blocks new logins everywhere, and short sessions and tokens limit what is left.",
    keyPhrases: ["a central identity provider", "never sees the password", "a signed XML assertion", "on top of OAuth2", "central control"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What is the twelve-factor app methodology?",
    questionVi: "Phương pháp twelve-factor app là gì?",
    outline: [
      {en: "Principles for cloud-friendly services", vi: "Các nguyên tắc cho service thân thiện với cloud"},
      {en: "Config in the environment, stateless processes, backing services as resources", vi: "Cấu hình qua môi trường, process không trạng thái, dịch vụ phụ trợ như tài nguyên"},
      {en: "Logs as streams, disposability, dev/prod parity", vi: "Log là luồng dữ liệu, dễ khởi động/tắt, môi trường dev và prod tương đồng"}
    ],
    answer: "It's a set of principles for building services that run well in the cloud. The ones I apply most are: keep configuration in the environment, not in the code, so the same build runs everywhere; build once, then release that same artifact with different configuration; keep processes stateless, so any instance can be killed or added, with state in a database or cache; treat backing services, like the database or a queue, as attached resources defined by a URL; write logs to standard output as a stream and let the platform collect them; and make processes start fast and shut down gracefully. It also says development and production should be as similar as possible. Spring Boot and containers fit these principles very naturally.",
    keyPhrases: ["configuration in the environment", "build once", "keep processes stateless", "attached resources", "shut down gracefully"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How do you deploy a new version without downtime?",
    questionVi: "Bạn triển khai phiên bản mới mà không có downtime như thế nào?",
    outline: [
      {en: "Rolling, blue-green or canary deployment behind a load balancer", vi: "Triển khai rolling, blue-green hoặc canary phía sau load balancer"},
      {en: "Readiness probes and graceful shutdown", vi: "Readiness probe và tắt ứng dụng an toàn (graceful shutdown)"},
      {en: "Backward-compatible database and API changes", vi: "Thay đổi database và API tương thích ngược"}
    ],
    answer: "I deploy several instances behind a load balancer and replace them gradually, with a rolling or canary deployment, or switch all traffic at once with blue-green. Two details make it truly zero-downtime. First, a new instance only receives traffic when its readiness probe says it's ready, for example after the connection pool and caches are warmed up. Second, old instances shut down gracefully: they stop accepting new requests, finish the ones in progress, and only then exit. Spring Boot does graceful shutdown by default since version three point four, and I only tune the timeout. The part people often forget is compatibility: during the rollout, old and new versions run at the same time, so database migrations and API changes must be backward compatible, using the expand-and-contract approach.",
    keyPhrases: ["replace them gradually", "its readiness probe", "shut down gracefully", "old and new versions run at the same time", "expand-and-contract"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What is backpressure, and how do you handle it?",
    questionVi: "Backpressure là gì, và bạn xử lý thế nào?",
    outline: [
      {en: "A consumer can't keep up with a producer", vi: "Bên tiêu thụ không theo kịp bên tạo dữ liệu"},
      {en: "Options: buffer with a limit, slow the producer, drop or reject", vi: "Lựa chọn: đệm có giới hạn, làm chậm bên tạo, bỏ bớt hoặc từ chối"},
      {en: "Examples: bounded queues, prefetch, 429 responses, reactive streams", vi: "Ví dụ: hàng đợi có giới hạn, prefetch, phản hồi 429, reactive stream"}
    ],
    answer: "Backpressure is what happens when one part of the system produces work faster than the next part can handle it. Without control, queues and memory grow until something crashes. There are a few ways to handle it. We can buffer, but only with a bounded queue, so it fails clearly instead of running out of memory. We can let the consumer set the pace, for example with a limited prefetch in RabbitMQ, or reactive streams in WebFlux, where the consumer requests only as many items as it can process. Or we can reject or drop work, like returning 429 Too Many Requests to clients. The key is to choose the behavior on purpose and monitor queue length and processing lag.",
    keyPhrases: ["faster than the next part can handle it", "a bounded queue", "a limited prefetch", "429 Too Many Requests", "on purpose"]
  },
  // ---------- CONSULTING CASE QUESTIONS ----------
  {
    category: 'SYSTEM_DESIGN',
    question: "A client wants to move a legacy system to the cloud. How would you approach it?",
    questionVi: "Khách hàng muốn chuyển một hệ thống cũ lên cloud. Bạn sẽ tiếp cận thế nào?",
    outline: [
      {en: "Understand the goals and constraints: cost, speed, compliance", vi: "Hiểu mục tiêu và ràng buộc: chi phí, tốc độ, tuân thủ"},
      {en: "Assess the current system; choose a strategy per component (rehost, replatform, refactor)", vi: "Đánh giá hệ thống hiện tại; chọn chiến lược cho từng thành phần (rehost, replatform, refactor)"},
      {en: "Migrate in waves with a pilot, rollback plan and measurable success", vi: "Di chuyển theo từng đợt, có thí điểm, kế hoạch rollback và tiêu chí thành công đo được"}
    ],
    answer: "First, I'd ask why they want to move, because the goal shapes everything: is it cost, scalability, getting out of a data center, or faster releases? I'd also check constraints like data residency and regulations, which matter a lot in banking. Then I'd assess the current system: its components, dependencies, data volumes and pain points. Not everything needs the same treatment. Some parts can simply be rehosted as they are, some replatformed, for example onto a managed database, and only the parts that really need it get refactored. I'd start with a low-risk pilot, migrate in waves, keep a rollback plan for each wave, and define success up front, like cost per month, deployment frequency and incident rate.",
    keyPhrases: ["why they want to move", "data residency", "the same treatment", "a low-risk pilot", "define success up front"]
  },
  {
    category: 'PROJECT',
    question: "You join a new engagement with a large legacy codebase. What do you do in the first two weeks?",
    questionVi: "Bạn tham gia một dự án mới với codebase cũ rất lớn. Bạn làm gì trong hai tuần đầu?",
    outline: [
      {en: "Talk to people: business goals, pain points, who knows what", vi: "Nói chuyện với mọi người: mục tiêu kinh doanh, vấn đề, ai biết gì"},
      {en: "Map the system: run it, trace key flows, check tests, deployments, incidents", vi: "Vẽ bản đồ hệ thống: chạy thử, lần theo luồng chính, xem test, triển khai, sự cố"},
      {en: "Share a short assessment with quick wins and risks", vi: "Chia sẻ bản đánh giá ngắn với các cải thiện nhanh và rủi ro"}
    ],
    answer: "In the first days, I'd focus on people before code: I'd meet the client's product owner and the developers to understand the business goals, the biggest pain points, and who knows which parts of the system. Then I'd get it running locally, and trace the two or three most important flows end to end. I'd look at the things that tell me about health: test coverage, how deployments work, recent incidents, and which areas change most often. By the end of the second week, I'd share a short written assessment: how the system works at a high level, the main risks, a few quick wins we could deliver soon, and questions that still need answers. Delivering something small early also builds the client's trust.",
    keyPhrases: ["people before code", "who knows which parts", "trace the two or three most important flows", "a short written assessment", "builds the client's trust"]
  },
  {
    category: 'PROJECT',
    question: "How would you present a serious technical risk to a non-technical executive?",
    questionVi: "Bạn sẽ trình bày một rủi ro kỹ thuật nghiêm trọng cho lãnh đạo không chuyên kỹ thuật như thế nào?",
    outline: [
      {en: "Lead with business impact and likelihood, not technology", vi: "Bắt đầu bằng tác động kinh doanh và khả năng xảy ra, không phải công nghệ"},
      {en: "Offer clear options with cost and time", vi: "Đưa ra các lựa chọn rõ ràng kèm chi phí và thời gian"},
      {en: "Make a recommendation and ask for a decision", vi: "Đề xuất một hướng và đề nghị ra quyết định"}
    ],
    answer: "I'd start with the impact in business terms, in one sentence. For example: our payment system runs on a database version that stops receiving security patches in three months, and if it's attacked, customer data could be exposed and we could be fined. Then I'd explain how likely it is, without exaggerating. Next, I'd present two or three options, each with cost, time and remaining risk, like starting the upgrade now, which takes about six weeks, or adding extra protection as a temporary measure. I'd give a clear recommendation and ask for a decision by a specific date. I'd keep technical details in an appendix, so they're available if asked, but not in the way.",
    keyPhrases: ["in business terms", "without exaggerating", "cost, time and remaining risk", "a clear recommendation", "in an appendix"]
  },
  {
    category: 'PROJECT',
    question: "The client asks for extra work that isn't in the contract. What do you do?",
    questionVi: "Khách hàng yêu cầu thêm việc không có trong hợp đồng. Bạn làm gì?",
    outline: [
      {en: "Stay positive and understand the request", vi: "Giữ thái độ tích cực và hiểu rõ yêu cầu"},
      {en: "Don't promise on the spot; check it against the scope with your manager", vi: "Không hứa ngay; đối chiếu với phạm vi cùng quản lý của bạn"},
      {en: "Use the change request process: impact on time and cost", vi: "Dùng quy trình change request: tác động tới thời gian và chi phí"}
    ],
    answer: "I'd stay positive, because a new request often means the client sees more value in what we're building. But I wouldn't agree on the spot, even if it looks small, because many small additions are how projects go over budget. First, I'd make sure I understand what they need and why. Then I'd check it against the statement of work, together with my engagement manager. If it's out of scope, we'd raise a change request with a clear estimate of the impact on time and cost, so the client can decide whether it's worth it, or what to drop instead. That keeps the relationship good and protects both sides.",
    keyPhrases: ["sees more value", "on the spot", "go over budget", "against the statement of work", "a change request"]
  },
  // ---------- FULL-STACK: ANGULAR + SPRING ----------
  {
    category: 'ANGULAR',
    question: "How do you handle errors end to end, from Spring to the Angular UI?",
    questionVi: "Bạn xử lý lỗi xuyên suốt từ Spring tới giao diện Angular như thế nào?",
    outline: [
      {en: "Backend: one error format with a stable code and trace ID", vi: "Backend: một định dạng lỗi với mã ổn định và trace ID"},
      {en: "Frontend: an interceptor for common cases; features map codes to translated messages", vi: "Frontend: interceptor cho trường hợp chung; từng tính năng ánh xạ mã lỗi sang thông báo đã dịch"},
      {en: "Never show raw server messages; always offer a next step", vi: "Không hiển thị nguyên văn lỗi từ server; luôn gợi ý bước tiếp theo"}
    ],
    answer: "On the backend, every error goes through one global handler and returns the same JSON shape: an HTTP status, a stable error code, like CARD NOT FOUND, and a trace ID, but never a stack trace. On the frontend, an HTTP interceptor handles the cross-cutting cases, like refreshing the token on 401 or showing a generic message when the server is unreachable. The feature itself handles business errors: it maps the error code to a translated, friendly message, for example in English and Vietnamese, and shows a clear next step, like retry or contact support. I never show the raw server message to users. When users report a problem, the trace ID on the error screen lets us find the exact request in the logs.",
    keyPhrases: ["the same JSON shape", "a stable error code", "an HTTP interceptor", "a translated, friendly message", "the trace ID"]
  },
  {
    category: 'ANGULAR',
    question: "How do you implement a file download from a Spring API in Angular?",
    questionVi: "Bạn cài đặt tải file từ API Spring trong Angular như thế nào?",
    outline: [
      {en: "Spring streams the file with Content-Type and Content-Disposition", vi: "Spring stream file kèm Content-Type và Content-Disposition"},
      {en: "Angular requests a Blob and creates an object URL", vi: "Angular yêu cầu kiểu Blob và tạo object URL"},
      {en: "Check ownership on the server; for large files use a signed URL", vi: "Kiểm tra quyền sở hữu ở server; file lớn thì dùng signed URL"}
    ],
    answer: "On the Spring side, the endpoint checks that the user owns the file, then streams it with the right Content-Type and a Content-Disposition header that suggests a file name, without loading the whole file into memory. In Angular, I call it with HttpClient using responseType blob, create an object URL from the blob, and trigger the download with a temporary link, then revoke the URL to free memory. Because the request goes through HttpClient, the auth interceptor still adds the token. For very large files, I'd rather have the API return a short-lived signed URL to object storage, so the browser downloads directly and our servers don't have to stream it.",
    keyPhrases: ["checks that the user owns the file", "Content-Disposition", "responseType blob", "revoke the URL", "a short-lived signed URL"]
  },
  {
    category: 'ANGULAR',
    question: "How do you implement pagination end to end?",
    questionVi: "Bạn cài đặt phân trang xuyên suốt hai đầu như thế nào?",
    outline: [
      {en: "API: page and size parameters with a maximum, plus total or a next cursor", vi: "API: tham số page và size có giới hạn tối đa, kèm tổng số hoặc cursor tiếp theo"},
      {en: "Stable sort order; keyset for big or live data", vi: "Thứ tự sắp xếp ổn định; dùng keyset cho dữ liệu lớn hoặc thay đổi liên tục"},
      {en: "UI keeps page state in the URL; loading, empty and error states", vi: "Giao diện giữ trạng thái trang trên URL; có trạng thái tải, trống và lỗi"}
    ],
    answer: "On the API, the client sends page and size parameters, and the server enforces a maximum size, so nobody can request a million rows. The response contains the items plus metadata, like the total count and the number of pages. I always sort by a stable key, for example created date and then ID, otherwise rows can jump between pages. For very large or fast-changing tables, I switch to keyset pagination, where the client sends the last seen ID, and the response includes a cursor for the next page. In Angular, I keep the current page and filters in the URL query parameters, so refreshing or sharing the link keeps the same view, and the table shows clear loading, empty and error states.",
    keyPhrases: ["enforces a maximum size", "the total count", "a stable key", "keyset pagination", "in the URL query parameters"]
  },
  {
    category: 'ANGULAR',
    question: "How do you configure an Angular app for different environments?",
    questionVi: "Bạn cấu hình ứng dụng Angular cho nhiều môi trường như thế nào?",
    outline: [
      {en: "Relative API URLs plus a dev proxy avoid CORS and rebuilds", vi: "URL API dạng tương đối cộng với proxy khi dev giúp tránh CORS và build lại"},
      {en: "Build-time environment files only for non-secret values", vi: "File environment lúc build chỉ dành cho giá trị không bí mật"},
      {en: "Never put secrets in frontend code", vi: "Không bao giờ đặt secret trong code frontend"}
    ],
    answer: "My preferred setup is that the app calls the API with relative URLs, like slash api slash v1. In development, the Angular dev server proxies those calls to the local backend, and in production, the same build is served behind a reverse proxy that routes slash api to the backend. That way there are no CORS issues and one build works in every environment. When I do need different values per environment, like an analytics key, I use the environment files at build time, or load a small config file at startup. The important rule is that everything in the frontend bundle is public, so it must never contain secrets like API keys for paid services or database passwords.",
    keyPhrases: ["relative URLs", "proxies those calls", "one build works in every environment", "load a small config file at startup", "everything in the frontend bundle is public"]
  },
  // ---------- STREAMS IN PRACTICE ----------
  {
    category: 'JAVA_CORE',
    question: "How do you group a list of transactions by category and sum the amounts with streams?",
    questionVi: "Làm sao nhóm danh sách giao dịch theo danh mục và tính tổng số tiền bằng stream?",
    outline: [
      {en: "Collectors.groupingBy with a downstream collector", vi: "Collectors.groupingBy với một collector phía sau"},
      {en: "For BigDecimal, use reducing with BigDecimal.ZERO and add", vi: "Với BigDecimal, dùng reducing với BigDecimal.ZERO và add"},
      {en: "Choose the map type, e.g. TreeMap or EnumMap, if order matters", vi: "Chọn kiểu map, ví dụ TreeMap hoặc EnumMap, nếu cần thứ tự"}
    ],
    answer: "I'd use Collectors.groupingBy with the category as the key, and a downstream collector that sums the amounts. For primitive values, there's summingLong or summingDouble, but for money I use BigDecimal, so the downstream collector is reducing, starting from BigDecimal.ZERO, mapping each transaction to its amount, and combining them with add. The result is a map from category to total. By default it's a HashMap with no order, so if I need the categories sorted, I pass a map factory, like TreeMap, or EnumMap when the category is an enum. For very large data, I'd rather do this aggregation in SQL with GROUP BY, so we don't load every row into memory.",
    keyPhrases: ["Collectors.groupingBy", "a downstream collector", "BigDecimal.ZERO", "a map factory", "in SQL with GROUP BY"]
  },
  {
    category: 'JAVA_CORE',
    question: "What is the difference between map and flatMap in streams?",
    questionVi: "map và flatMap trong stream khác nhau thế nào?",
    outline: [
      {en: "map: one input element to one output element", vi: "map: một phần tử vào thành một phần tử ra"},
      {en: "flatMap: one element to a stream of elements, then flattened", vi: "flatMap: một phần tử thành một stream phần tử, rồi làm phẳng"},
      {en: "Same idea in Optional and in RxJS", vi: "Ý tưởng tương tự trong Optional và RxJS"}
    ],
    answer: "map transforms each element into exactly one new element, for example a list of accounts into a list of account IDs. flatMap is for when each element turns into several elements, or a stream of them. For example, if each account has a list of transactions, mapping would give me a stream of lists, but flatMap gives me one flat stream of all the transactions. The same idea exists elsewhere: Optional.flatMap avoids an Optional inside an Optional, and in RxJS the flattening operators, like switchMap or mergeMap, do the same for observables, with different rules for concurrency.",
    keyPhrases: ["exactly one new element", "several elements", "a stream of lists", "one flat stream", "an Optional inside an Optional"]
  },
  {
    category: 'JAVA_CORE',
    question: "How do you remove duplicates from a list while keeping the original order?",
    questionVi: "Làm sao xóa phần tử trùng trong danh sách mà vẫn giữ thứ tự ban đầu?",
    outline: [
      {en: "LinkedHashSet keeps insertion order", vi: "LinkedHashSet giữ thứ tự chèn"},
      {en: "Or stream().distinct(), which is stable for ordered streams", vi: "Hoặc stream().distinct(), giữ ổn định với stream có thứ tự"},
      {en: "Duplicates are decided by equals and hashCode; by key, use a seen set", vi: "Trùng hay không do equals và hashCode quyết định; nếu theo key, dùng một set đã gặp"}
    ],
    answer: "The simplest way is to copy the list into a LinkedHashSet, which removes duplicates and keeps the insertion order, and then back into a list if I need one. With streams, distinct does the same, and for an ordered stream like a list, it keeps the first occurrence of each element. Both rely on equals and hashCode, so those must be implemented correctly. If I want to remove duplicates by one field, for example keep only the first transaction per reference number, I keep a set of keys I've already seen and filter on whether adding the key succeeds, or I collect to a LinkedHashMap keyed by that field.",
    keyPhrases: ["a LinkedHashSet", "the insertion order", "keeps the first occurrence", "rely on equals and hashCode", "a set of keys I've already seen"]
  },
  {
    category: 'JAVA_CORE',
    question: "What is the difference between Stream.toList() and Collectors.toList()?",
    questionVi: "Stream.toList() và Collectors.toList() khác nhau thế nào?",
    outline: [
      {en: "Stream.toList() (Java 16+) returns an unmodifiable list", vi: "Stream.toList() (Java 16+) trả về danh sách không thể sửa"},
      {en: "Collectors.toList() gives no guarantee; in practice an ArrayList", vi: "Collectors.toList() không cam kết; thực tế là ArrayList"},
      {en: "Changing the call can break code that adds to the list", vi: "Đổi cách gọi có thể làm hỏng code đang thêm phần tử vào danh sách"}
    ],
    answer: "Stream.toList, added in Java 16, is shorter and returns an unmodifiable list, so calling add or remove on it throws an UnsupportedOperationException. It also allows null elements. Collectors.toList makes no promise about the list type or whether it can be changed, but in practice it returns an ArrayList that can be modified. So I prefer Stream.toList by default, because results that can't be changed are safer. But when I replace collect with toList in existing code, I check that nobody modifies the result afterwards, otherwise I'd introduce a runtime error. If I really need a mutable list, I use Collectors.toCollection with ArrayList.",
    keyPhrases: ["added in Java 16", "an unmodifiable list", "UnsupportedOperationException", "makes no promise", "Collectors.toCollection"]
  },
  // ---------- QUICK JAVA CHECKS ----------
  {
    category: 'JAVA_CORE',
    question: "What does the default hashCode return if you don't override it?",
    questionVi: "hashCode mặc định trả về gì nếu bạn không override?",
    outline: [
      {en: "An identity hash code, stable for the object's lifetime", vi: "Một identity hash code, ổn định trong suốt vòng đời object"},
      {en: "Not the memory address, even though people often say so", vi: "Không phải địa chỉ bộ nhớ, dù nhiều người hay nói vậy"},
      {en: "Two equal-looking objects usually get different codes", vi: "Hai object trông giống nhau thường có mã khác nhau"}
    ],
    answer: "Without an override, Object.hashCode returns an identity hash code. It's generated by the JVM and stays the same for that object as long as it lives, but it's not guaranteed to be the memory address, especially because the garbage collector moves objects around. The important consequence is that two different objects with the same field values usually get different hash codes, and the default equals compares identity, so they're treated as different keys in a HashMap. That's correct for objects that represent identity, like a service, but wrong for value objects, which is why value classes override both equals and hashCode, or are simply records.",
    keyPhrases: ["an identity hash code", "not guaranteed to be the memory address", "different hash codes", "value objects", "simply records"]
  },
  {
    category: 'JAVA_CORE',
    question: "Do final fields make a class thread-safe?",
    questionVi: "Field final có làm class an toàn đa luồng không?",
    outline: [
      {en: "final guarantees safe publication of the field after construction", vi: "final đảm bảo field được công bố an toàn sau khi khởi tạo"},
      {en: "A final reference to a mutable object is still mutable", vi: "Tham chiếu final tới object có thể thay đổi thì vẫn thay đổi được"},
      {en: "Fully immutable classes are thread-safe", vi: "Class bất biến hoàn toàn thì an toàn đa luồng"}
    ],
    answer: "Partly. The Java memory model guarantees that once a constructor finishes, other threads see the correct values of final fields, without synchronization, as long as the reference to this doesn't escape during construction. So a class whose fields are all final and point to immutable values, like String or BigDecimal, is thread-safe. But a final field only means the reference can't change. If it points to a mutable object, like an ArrayList, other threads can still modify that list, so I'd copy it with List.copyOf or protect it. In short, final helps a lot, but real thread safety comes from immutability.",
    keyPhrases: ["the Java memory model", "doesn't escape during construction", "the reference can't change", "List.copyOf", "comes from immutability"]
  },
  {
    category: 'JAVA_CORE',
    question: "What does the transient keyword do?",
    questionVi: "Từ khóa transient có tác dụng gì?",
    outline: [
      {en: "Excludes a field from Java serialization", vi: "Loại một field khỏi cơ chế serialization của Java"},
      {en: "Used for secrets, caches and derived values", vi: "Dùng cho secret, cache và giá trị suy ra được"},
      {en: "JSON libraries and JPA have their own annotations", vi: "Thư viện JSON và JPA có annotation riêng"}
    ],
    answer: "A transient field is skipped by Java's built-in serialization, so after deserialization it gets its default value, like null or zero. I'd use it for things that shouldn't be written out, like a password, a cache or a value that can be recalculated. In modern applications, though, we rarely use Java serialization, because JSON is more common and safer. Jackson has its own way to ignore fields, @JsonIgnore, and in JPA, a field that shouldn't be stored in the database is marked with the @Transient annotation, which is a different thing from the keyword.",
    keyPhrases: ["skipped by Java's built-in serialization", "its default value", "rarely use Java serialization", "@JsonIgnore", "a different thing from the keyword"]
  },
  // ---------- QUICK OPERATIONS CHECKS ----------
  {
    category: 'SYSTEM_DESIGN',
    question: "What is the difference between a liveness probe and a readiness probe?",
    questionVi: "Liveness probe và readiness probe khác nhau thế nào?",
    outline: [
      {en: "Liveness: is the process stuck? If it fails, restart it", vi: "Liveness: process có bị treo không? Nếu lỗi thì khởi động lại"},
      {en: "Readiness: can it take traffic now? If it fails, stop sending requests", vi: "Readiness: có nhận traffic được chưa? Nếu lỗi thì ngừng gửi request"},
      {en: "Don't put dependency checks in liveness", vi: "Không đưa việc kiểm tra dependency vào liveness"}
    ],
    answer: "A liveness probe answers whether the application is still alive or stuck, for example deadlocked. If it fails, Kubernetes restarts the container. A readiness probe answers whether the instance can handle traffic right now, for example after startup has finished. If it fails, the instance is removed from the load balancer, but it isn't restarted. A common mistake is checking the database in the liveness probe: if the database has a short outage, every pod gets restarted at the same time, which makes things worse. So I keep liveness very simple, and put dependency checks, if any, in readiness. Spring Boot Actuator exposes both groups.",
    keyPhrases: ["still alive or stuck", "Kubernetes restarts the container", "removed from the load balancer", "checking the database in the liveness probe", "keep liveness very simple"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "What is the difference between a connect timeout and a read timeout?",
    questionVi: "Connect timeout và read timeout khác nhau thế nào?",
    outline: [
      {en: "Connect timeout: how long to wait to open the connection", vi: "Connect timeout: thời gian chờ để mở kết nối"},
      {en: "Read timeout: how long to wait for data once connected", vi: "Read timeout: thời gian chờ dữ liệu sau khi đã kết nối"},
      {en: "Set both, plus an overall deadline for the request", vi: "Đặt cả hai, cộng thêm thời hạn tổng cho request"}
    ],
    answer: "The connect timeout is how long the client waits to establish the connection with the server. It's usually short, like one or two seconds, because if a server can't even accept a connection, waiting longer rarely helps. The read timeout, sometimes called the socket timeout, is how long the client waits for data after the connection is open, so it depends on how long the operation normally takes, for example based on its p99 latency. Many clients default to waiting forever, so I always set both. On top of that, it's useful to have an overall deadline for the whole call, including retries, so the user never waits longer than our own response target.",
    keyPhrases: ["establish the connection", "rarely helps", "sometimes called the socket timeout", "default to waiting forever", "an overall deadline"]
  },
  {
    category: 'SYSTEM_DESIGN',
    question: "How do you choose a TTL for cached data?",
    questionVi: "Bạn chọn TTL cho dữ liệu cache như thế nào?",
    outline: [
      {en: "Ask how stale the data is allowed to be for the business", vi: "Hỏi dữ liệu được phép cũ tới mức nào về mặt nghiệp vụ"},
      {en: "Short TTL for changing data, long TTL plus eviction on write for stable data", vi: "TTL ngắn cho dữ liệu hay đổi, TTL dài kèm xóa khi ghi cho dữ liệu ổn định"},
      {en: "Add jitter; measure hit rate and adjust", vi: "Thêm jitter; đo tỉ lệ hit và điều chỉnh"}
    ],
    answer: "I start with a business question: how old can this data be before it causes a problem? A list of bank names can be a day old, an exchange rate maybe a minute, and an account balance usually shouldn't be cached at all, or only for a very short time with eviction on every change. For data that changes rarely, I use a long TTL and evict the entry whenever it's written, so the TTL is only a safety net. I add some random jitter, so many keys don't expire at the same moment. Then I watch the hit rate and the load on the database, and adjust the TTL based on real numbers.",
    keyPhrases: ["a business question", "shouldn't be cached at all", "a safety net", "random jitter", "watch the hit rate"]
  },
  // ---------- QUICK SPRING CHECKS ----------
  {
    category: 'SPRING',
    question: "@Value or @ConfigurationProperties - which do you prefer?",
    questionVi: "@Value hay @ConfigurationProperties - bạn thích dùng cái nào hơn?",
    outline: [
      {en: "@Value: quick, for one or two single values", vi: "@Value: nhanh gọn, cho một hai giá trị lẻ"},
      {en: "@ConfigurationProperties: typed, grouped, validated, easy to test", vi: "@ConfigurationProperties: có kiểu, gom nhóm, được kiểm tra, dễ test"},
      {en: "Records work well as properties classes", vi: "Record rất hợp làm class chứa cấu hình"}
    ],
    answer: "For a single value, @Value is quick, but for anything more, I prefer @ConfigurationProperties. It binds a whole group of related settings, like everything under app dot payment, into one typed class, so there are no repeated string keys scattered around the code. I can add validation annotations, so the application fails at startup if a value is missing or invalid, and I get relaxed binding, so environment variables map to the properties automatically. It's also easier to test, because I can just create the object. A record works nicely as a properties class, and since Spring Boot 3 it doesn't even need the constructor binding annotation.",
    keyPhrases: ["a whole group of related settings", "one typed class", "fails at startup", "relaxed binding", "a record works nicely"]
  },
  {
    category: 'SPRING',
    question: "@Primary vs @Qualifier - how do you choose between beans of the same type?",
    questionVi: "@Primary và @Qualifier - bạn chọn giữa các bean cùng kiểu như thế nào?",
    outline: [
      {en: "Two beans of one type cause an ambiguity error at injection", vi: "Hai bean cùng kiểu gây lỗi mơ hồ khi inject"},
      {en: "@Primary sets the default; @Qualifier picks a specific one", vi: "@Primary đặt bean mặc định; @Qualifier chọn đích danh một bean"},
      {en: "Or inject all of them as a List or Map", vi: "Hoặc inject tất cả dưới dạng List hoặc Map"}
    ],
    answer: "When there are two beans of the same type, for example two payment providers, Spring can't decide which one to inject and fails at startup. With @Primary, I mark one of them as the default, which is used wherever nobody asks for a specific one. With @Qualifier, the injection point names exactly which bean it wants, and that always wins over @Primary. I use @Primary for a clear default, like the main data source, and @Qualifier when a class really needs a specific implementation. And when the code should choose at runtime, I inject all implementations as a Map keyed by bean name, which works well with the strategy pattern.",
    keyPhrases: ["can't decide which one to inject", "as the default", "always wins over @Primary", "a clear default", "a Map keyed by bean name"]
  },
  // ---------- QUICK SQL CHECKS ----------
  {
    category: 'DATABASE',
    question: "DELETE vs TRUNCATE vs DROP - what's the difference?",
    questionVi: "DELETE, TRUNCATE và DROP khác nhau thế nào?",
    outline: [
      {en: "DELETE removes chosen rows, row by row, inside a transaction", vi: "DELETE xóa các dòng được chọn, từng dòng, trong transaction"},
      {en: "TRUNCATE empties the whole table quickly; in MySQL it can't be rolled back", vi: "TRUNCATE xóa sạch bảng rất nhanh; trong MySQL không rollback được"},
      {en: "DROP removes the table itself", vi: "DROP xóa luôn cả bảng"}
    ],
    answer: "DELETE removes the rows that match a WHERE clause, one row at a time. It's logged, it fires triggers, it respects foreign keys, and it can be rolled back inside a transaction, but it's slow for huge tables. TRUNCATE removes all rows at once by recreating the table, so it's very fast and resets the auto-increment counter. In MySQL it's treated as a DDL statement, which means it commits implicitly and can't be rolled back. DROP removes the whole table, including its structure and indexes. In production, I almost never run TRUNCATE or DROP by hand, and for financial data we don't delete at all, we keep an audit trail.",
    keyPhrases: ["one row at a time", "it can be rolled back", "resets the auto-increment counter", "commits implicitly", "removes the whole table"]
  },
  {
    category: 'DATABASE',
    question: "UNION vs UNION ALL - which one do you use?",
    questionVi: "UNION và UNION ALL - bạn dùng cái nào?",
    outline: [
      {en: "UNION removes duplicates, which needs extra work", vi: "UNION loại bỏ dòng trùng, tốn thêm công xử lý"},
      {en: "UNION ALL keeps every row and is faster", vi: "UNION ALL giữ mọi dòng và nhanh hơn"},
      {en: "Default to UNION ALL unless you really need distinct rows", vi: "Mặc định dùng UNION ALL trừ khi thật sự cần dòng không trùng"}
    ],
    answer: "Both combine the results of two queries with the same columns. UNION removes duplicate rows, which means the database has to sort or hash the combined result, and that costs time and memory on large data sets. UNION ALL simply appends the results and keeps every row, including duplicates, so it's faster. I use UNION ALL by default, for example when combining card transactions and bank transfers into one history, because the two sources can't overlap anyway. I only use UNION when duplicates are really possible and must be removed, and even then I check whether a better query or a DISTINCT on a smaller set would be clearer.",
    keyPhrases: ["removes duplicate rows", "sort or hash the combined result", "simply appends the results", "by default", "can't overlap anyway"]
  },
  // ---------- MORE QUICK JAVA ----------
  {
    category: 'JAVA_CORE',
    question: "What is the difference between fail-fast and fail-safe iterators?",
    questionVi: "Iterator fail-fast và fail-safe khác nhau thế nào?",
    outline: [
      {en: "Fail-fast: throws ConcurrentModificationException on structural changes", vi: "Fail-fast: ném ConcurrentModificationException khi cấu trúc collection bị thay đổi"},
      {en: "Fail-safe or weakly consistent: work on a copy or tolerate changes", vi: "Fail-safe hoặc weakly consistent: duyệt trên bản sao hoặc chấp nhận thay đổi"},
      {en: "Examples: ArrayList and HashMap vs CopyOnWriteArrayList and ConcurrentHashMap", vi: "Ví dụ: ArrayList, HashMap so với CopyOnWriteArrayList, ConcurrentHashMap"}
    ],
    answer: "Iterators of normal collections, like ArrayList and HashMap, are fail-fast. They keep a modification count, and if the collection is structurally changed while iterating, except through the iterator itself, the next call throws a ConcurrentModificationException. It's a best-effort check to expose bugs early, not a guarantee of thread safety. Concurrent collections behave differently. CopyOnWriteArrayList iterates over a snapshot, so changes made during iteration are simply not visible. ConcurrentHashMap's iterators are weakly consistent: they never throw, and they may or may not show changes made after the iteration started. The trade-off is that you don't always see the very latest data.",
    keyPhrases: ["are fail-fast", "a modification count", "a best-effort check", "iterates over a snapshot", "weakly consistent"]
  }
];
