// Projects shown in the About page "Projects" section. Every fact here comes from the module's README,
// AGENTS.override.md, docs or package files in this monorepo. Edit this file only; the page renders from it.
//
// PLACEHOLDERS to fill in: `liveUrl` (leave '' until the site is public) and `screenshots`
// (paths under `public/assets/...`, e.g. 'assets/images/projects/kira-memory-1.png'). Empty values render a
// "coming soon" placeholder on the page.

export interface DiagramNode {
  name: string;
  detail?: string;
}

/** One row of the architecture diagram. Rows are drawn top to bottom with an arrow between them. */
export interface DiagramLayer {
  /** Label on the arrow coming into this row from the row above (e.g. the protocol). */
  via?: string;
  nodes: DiagramNode[];
}

export interface Project {
  id: string;
  name: string;
  /** Folder in the monorepo. */
  folder: string;
  tagline: string;
  description: string;
  /** PLACEHOLDER: public domain / live URL, '' until available. */
  liveUrl: string;
  /** PLACEHOLDER: demo screenshot paths, [] until available. */
  screenshots: string[];
  diagram: DiagramLayer[];
  stack: string[];
  features: string[];
  /** Optional "why it is hard" cards, shown before the architecture. */
  challenges?: {icon: string; title: string; text: string}[];
  /** Optional rewrite story, shown after the architecture. */
  migration?: ProjectMigration;
}

export interface ProjectMigration {
  from: string;
  to: string;
  points: string[];
  /** Optional side-by-side diagrams of the part that changed, drawn like `Project.diagram`. */
  diagrams?: {before: DiagramLayer[]; after: DiagramLayer[]};
}

export const PROJECTS: Project[] = [
  {
    id: 'kira-crawl',
    name: 'Kira Crawl',
    folder: 'kira-queue',
    tagline: 'Distributed crawler for a large, heavily protected live-score website',
    description:
      'Collects match lists and per-match detail data from www.aiscore.com, a large live-score '
      + 'website behind Cloudflare bot protection. A scheduler publishes crawl jobs to RabbitMQ, '
      + 'horizontally scaled workers fetch the data through warm browser sessions, and the results '
      + 'land in MySQL.',
    liveUrl: '',
    screenshots: [],
    challenges: [
      {
        icon: 'shield',
        title: 'Bot protection',
        text: '"Just a moment" interstitials guard the pages and API calls can come back with '
          + 'cf-mitigated: challenge. Plain HTTP clients fail; it takes a real browser.',
      },
      {
        icon: 'cookie',
        title: 'Session-bound clearance',
        text: 'The cf_clearance cookie is bound to the browser session that earned it, so every '
          + 'API request has to run inside that same session.',
      },
      {
        icon: 'data_object',
        title: 'A binary API',
        text: 'The site\'s own API answers in binary Protocol Buffers, not JSON. Every response is '
          + 'decoded in-process with the upstream protobuf.json schema.',
      },
      {
        icon: 'memory',
        title: 'Chromium is heavy',
        text: 'Every worker runs Playwright with a full Chromium, so each one gets its own EC2 '
          + 'instance: t3.small or larger, and 4 GB of RAM once Portainer runs beside it.',
      },
      {
        icon: 'sync_lock',
        title: 'One thread per browser',
        text: 'Playwright for Java is not thread-safe, so each browser lane owns a dedicated '
          + 'driver thread and runs its requests one at a time.',
      },
      {
        icon: 'front_hand',
        title: 'Blocks mid-crawl',
        text: 'Any call can come back 403, 429, 503 or as a challenge. Each one is a hard stop '
          + 'with a domain error code, never a blind retry, and captchas are never solved '
          + 'automatically.',
      },
    ],
    diagram: [
      {
        nodes: [
          {name: 'kira-producer', detail: 'Spring Boot scheduler'},
          {name: 'kira-data-manager', detail: 'crawl dates · failures · requeue'},
        ],
      },
      {
        via: 'publish jobs',
        nodes: [{name: 'RabbitMQ', detail: 'crawl_exchange · crawlByDate · event'}],
      },
      {
        via: 'consume (redelivery-safe)',
        nodes: [{name: 'kira-queue workers', detail: 'Docker · several EC2 instances'}],
      },
      {nodes: [{name: 'Warm browser lanes', detail: '1 match-list lane + up to 5 detail lanes'}]},
      {
        via: 'in-page fetch() + cf_clearance',
        nodes: [{name: 'www.aiscore.com', detail: 'Cloudflare · Protocol Buffers API'}],
      },
      {
        via: 'decoded in-process',
        nodes: [
          {name: 'MySQL 8', detail: 'shared schema: kira-schema'},
          {name: 'kira-gateway', detail: 'crawl callbacks'},
        ],
      },
    ],
    stack: ['Java 21', 'Spring Boot', 'Playwright for Java', 'Virtual threads', 'RabbitMQ',
      'MySQL 8', 'Protocol Buffers', 'Docker', 'AWS EC2', 'Node.js 22', 'patchright', 'amqplib',
      'mysql2', 'protobufjs', 'Chrome MV3 extension'],
    features: [
      'Warm browser lanes open once on the home page; in-page fetch() then reuses that session and '
        + 'its clearance instead of navigating per request',
      'One lane for match lists plus up to 5 parallel lanes for per-match detail',
      'Lean network: images, fonts and media are blocked',
      'HTTP handlers run on Java virtual threads and hand browser calls to each lane\'s driver '
        + 'thread',
      'A challenge pauses the run until a person completes the verification in the open browser, '
        + 'with remote display over VNC',
      'A persistent browser profile keeps a legitimately earned clearance across restarts',
      'Redelivery-safe consumers: each message is acked after its handler settles',
      'Chrome MV3 extension variant that fetches inside the operator\'s own tab through a shared '
        + 'limiter (default 1 request/second)',
    ],
    migration: {
      from: 'Java 21 + Playwright',
      to: 'Node.js 22 + Patchright',
      points: [
        'patchright is a Playwright fork for Chromium with a patched, less detectable automation '
          + 'fingerprint',
        'No user-agent or extra-header overrides, so the browser keeps its real Chrome fingerprint',
        'Playwright for Java drives a bundled Node.js driver process: JVM → Node driver → browser '
          + 'becomes Node → browser',
        'In-page fetch() runs in the page\'s main world, so the browser sends the clearance cookie',
        'One persistent browser context per lane, and a promise-chain mutex instead of driver '
          + 'threads',
        'Same queue names, message payloads and database writes as v1, so both versions can run '
          + 'side by side',
        'Plain ESM JavaScript with no build step; node --test runs against fake pages, database '
          + 'and AMQP',
      ],
      diagrams: {
        before: [
          {nodes: [{name: 'kira-queue', detail: 'Java 21 · Spring Boot'}]},
          {
            via: 'Playwright for Java',
            nodes: [{name: 'Node.js driver', detail: 'bundled subprocess'}],
          },
          {nodes: [{name: 'Chromium', detail: 'driver thread per lane'}]},
        ],
        after: [
          {nodes: [{name: 'kira-queue-v2', detail: 'Node.js 22 · plain ESM'}]},
          {via: 'patchright', nodes: [{name: 'Chromium', detail: 'persistent context per lane'}]},
        ],
      },
    },
  },
  {
    id: 'kira-tool',
    name: 'Kira Tool',
    folder: 'kira-tool',
    tagline: 'Google Drive / Scribd to PDF export',
    description:
      'A public, no-login tool that renders Google Drive and Scribd documents to PDF. A standalone rewrite '
      + 'that replaces the legacy kira-tool-service and the /tool page of kira-ui.',
    liveUrl: '',
    screenshots: [],
    diagram: [
      {nodes: [{name: 'kira-tool-ui', detail: 'Angular 22 · Signals'}]},
      {via: 'same origin', nodes: [{name: 'nginx', detail: '/tool-service/ proxy'}]},
      {nodes: [{name: 'kira-tool-service', detail: 'Express 5 · job API + bounded worker pool'}]},
      {
        nodes: [
          {name: 'patchright', detail: 'one browser per job'},
          {name: 'node:sqlite', detail: 'tool_job table'},
          {name: 'PDF storage', detail: 'files by job id'},
        ],
      },
    ],
    stack: ['Node.js 22 (native TypeScript)', 'Express 5', 'patchright (Playwright fork)', 'node:sqlite',
      'Angular 22', 'Signals', 'nginx'],
    features: [
      'Link allowlist (https Google Drive and Scribd only); the browser only opens a URL rebuilt from the document ID',
      'Bounded worker pool with a queue of 20; a full queue answers 429 QUEUE_FULL',
      'Job lifecycle QUEUED → RUNNING → SUCCEEDED / FAILED / CANCELLED, retry up to 3 attempts, expiry after retention',
      'Jobs left RUNNING by a restart are re-queued automatically',
      'Never solves captchas: a bot-challenge page fails the job fast with PROVIDER_BLOCKED',
      'Anonymous owner cookie scopes each browser to its own jobs; CSRF and per-IP rate limit (10/min)',
      'RFC 9457 problem+json errors with stable codes',
    ],
  },
  {
    id: 'know-stack',
    name: 'KnowStack',
    folder: 'know-stack',
    tagline: 'Developer knowledge library & interview-prep vault',
    description:
      'A knowledge library for developers and interview preparation, running as one Cloudflare Worker: '
      + 'a Hono API and a React SPA served as static assets, with Cloudflare D1 as the database.',
    liveUrl: '',
    screenshots: [],
    diagram: [
      {nodes: [{name: 'React SPA', detail: 'library · articles · admin'}, {name: 'External agent', detail: 'bearer token'}]},
      {via: '/api/*', nodes: [{name: 'Cloudflare Worker', detail: 'Hono API + static assets'}]},
      {
        nodes: [
          {name: 'Cloudflare D1', detail: 'Drizzle ORM'},
          {name: 'Workers AI', detail: 'article drafts'},
          {name: 'ip-api.com', detail: 'visitor geo, cached per IP'},
        ],
      },
    ],
    stack: ['React', 'React Router', 'TypeScript', 'Vite', 'Hono', 'Cloudflare Workers', 'Cloudflare D1',
      'Drizzle ORM', 'Workers AI', 'Mermaid', 'DOMPurify', 'Vitest'],
    features: [
      'Knowledge library with search, tags, category, seniority filter and bookmarks',
      'Article pages with table of contents, callouts, Mermaid diagrams, listen and export',
      'Ask a question with similar-topic search and local drafts',
      'Admin question queue that turns questions into draft articles',
      'AI article editor: Workers AI drafts, split preview, publish',
      'Analytics for traffic, engagement and visitor geography',
      'Agent studio: goals for an external agent whose API can only create drafts, never publish',
    ],
  },
  {
    id: 'microsoft-point',
    name: 'Microsoft Point',
    folder: 'microsoft-point',
    tagline: 'Self-hosted Microsoft Rewards script with a dashboard',
    description:
      'A Docker Compose deployment of two open-source images: a Microsoft Rewards script with a control API, '
      + 'and a web dashboard that manages its schedule and configuration.',
    liveUrl: '',
    screenshots: [],
    diagram: [
      {nodes: [{name: 'Browser', detail: 'dashboard login'}]},
      {nodes: [{name: 'rewards-dashboard', detail: 'port 8890'}]},
      {via: 'control API + token', nodes: [{name: 'microsoft-rewards-script', detail: 'up to 4 accounts'}]},
      {nodes: [{name: 'Docker volumes', detail: 'config · sessions · dashboard data'}]},
    ],
    stack: ['Docker Compose', 'microsoft-rewards-script (open source)', 'rewards-dashboard (open source)'],
    features: [
      'Does not run on deploy; runs are tested by hand from the dashboard first',
      'Dashboard can edit the schedule and configuration through the control API',
      'Keeps the script\'s random delays',
      'Credentials and tokens come from environment variables',
      'Health check and no-new-privileges on both containers',
    ],
  },
  {
    id: 'kira-news-247',
    name: 'Kira News 247',
    folder: 'kira-news-247',
    tagline: 'Vietnamese news site with AI-drafted articles',
    description:
      'A Vietnamese news website. An AI agent (ChatGPT Codex with computer use) writes drafts every day through '
      + 'the admin pages; the owner approves them or leaves comments for the AI to fix.',
    liveUrl: '',
    screenshots: [],
    diagram: [
      {nodes: [{name: 'Reader browser'}, {name: 'AI agent', detail: 'Codex, computer use'}, {name: 'ipinfo.io', detail: 'read enrichment'}]},
      {via: 'HTML (SSR)', nodes: [{name: 'Express SSR', detail: 'Angular 21 · :4300'}]},
      {via: 'protobuf', nodes: [{name: 'kira-news-247-service', detail: 'Spring Boot · :8090'}]},
      {nodes: [{name: 'Oracle Autonomous Database', detail: 'Flyway'}]},
    ],
    stack: ['Java 25', 'Spring Boot 3.5', 'Spring Security', 'JPA', 'Flyway', 'Oracle Autonomous Database',
      'Protocol Buffers', 'Angular 21 SSR', 'Signals', 'httpResource', 'RxJS', 'Tailwind CSS v4', 'spartan-ng'],
    features: [
      'Review workflow DRAFT → IN_REVIEW → (CHANGES_REQUESTED) → PUBLISHED → ARCHIVED, plus REJECTED',
      'The AI editor role can only submit; it can never publish or read analytics',
      'Owner comments must be resolved before a resubmit; every save keeps a revision',
      'Protobuf-only API shared by service and UI from one .proto contract',
      'Server-rendered public pages with title, canonical and JSON-LD, plus sitemap.xml, rss.xml and robots.txt',
      'Read tracking enriched by ipinfo.io in the reader\'s browser, never blocking reading',
      'Admin dashboard and reads report; 5 failed logins lock for 15 minutes',
    ],
  },
  {
    id: 'kira-memory',
    name: 'Kira Memory',
    folder: 'kira-memory',
    tagline: 'Private photo & video memories for two',
    description:
      'A private site for two fixed accounts to keep photos, videos and messages. Media is stored on Hugging Face '
      + 'or Cloudflare R2 and served through signed, Cloudflare-cacheable URLs.',
    liveUrl: '',
    screenshots: [],
    diagram: [
      {nodes: [{name: 'kira-memory-ui', detail: 'Angular 22 · zoneless'}]},
      {via: '/api · /m (same origin)', nodes: [{name: 'Cloudflare cache', detail: 'caches /m/* media'}]},
      {nodes: [{name: 'kira-memory-service', detail: 'Spring Boot · SSE · :8086'}]},
      {
        nodes: [
          {name: 'MySQL 8', detail: 'Flyway · JdbcClient'},
          {name: 'Hugging Face', detail: 'private dataset'},
          {name: 'Cloudflare R2', detail: 'S3 API'},
        ],
      },
    ],
    stack: ['Java 25', 'Spring Boot 3.5', 'MySQL 8', 'Flyway', 'JdbcClient', 'JWT cookie session',
      'Server-Sent Events', 'Hugging Face', 'Cloudflare R2', 'Angular 22', 'Angular CDK virtual scroll',
      'Testcontainers'],
    features: [
      'Two fixed accounts (admin and viewer), no registration',
      'Albums with pinning, captions and bulk move',
      'Uploads up to 2 GB in 32 MB chunks; re-sending a chunk is safe',
      'Storage provider (Hugging Face or R2) switchable per new upload',
      'Cookie-free, immutable, HMAC-signed media URLs with Range streaming',
      'Realtime message box over SSE',
      'Message widget shapes (heart, star, flower…), the same on every device',
    ],
  },
  {
    id: 'kira-affilate',
    name: 'Kira Affiliate',
    folder: 'kira-affilate',
    tagline: 'Shopee Affiliate platform for Vietnamese users',
    description:
      'A platform for Shopee affiliates: link conversion, order and commission tracking, reports, product and '
      + 'campaign lookup, guides, and tax/legal reference content.',
    liveUrl: '',
    screenshots: [],
    diagram: [
      {nodes: [{name: 'kira-affilate-ui', detail: 'Angular 22 · Chart.js'}]},
      {via: '/api', nodes: [{name: 'kira-affilate-service', detail: 'Spring Boot · :8082'}]},
      {
        nodes: [
          {name: 'MySQL 8', detail: 'Flyway · per-user rows'},
          {name: 'Shopee Affiliate Open API', detail: 'per-user AppID/Secret'},
        ],
      },
    ],
    stack: ['Java 25', 'Spring Boot 3.5', 'MySQL 8', 'Flyway', 'Angular 22', 'Tailwind CSS v4', 'Chart.js',
      'Testcontainers', 'Playwright'],
    features: [
      'Affiliate link conversion',
      'Order and commission sync with idempotent upserts',
      'Reports and statistics with charts',
      'Product and campaign lookup',
      'Each user enters their own Shopee credentials; the secret is AES-256-GCM encrypted and never returned',
      'Every query is scoped to the signed-in user',
      'Honest about Shopee limits: no click counts or "paid" status are invented',
      'Tax and legal reference content that cites its source and marks what is verified',
    ],
  },
  {
    id: 'kira-bank',
    name: 'Kira Life (kira-bank)',
    folder: 'kira-bank',
    tagline: 'Personal finance, health and travel manager',
    description:
      'Manages credit cards, statements, payments and investment account history imported from images by AI, '
      + 'plus Health, Travel and Personal modules. One modular-monolith API serves web, mobile and desktop clients.',
    liveUrl: '',
    screenshots: [],
    diagram: [
      {
        nodes: [
          {name: 'kira-bank-ui', detail: 'Angular 22'},
          {name: 'kira-life-mobile', detail: 'Expo / React Native'},
          {name: 'Desktop', detail: 'Tauri v2 shell · Go + Fyne'},
        ],
      },
      {via: '/api/v1 · JWT', nodes: [{name: 'kira-bank-service', detail: 'Spring Boot modular monolith'}]},
      {
        nodes: [
          {name: 'MySQL 8', detail: 'Flyway'},
          {name: 'Cloudflare Workers AI', detail: 'image reading, failover'},
          {name: 'Cloudflare R2', detail: 'attachments'},
        ],
      },
    ],
    stack: ['Java 25', 'Spring Boot 3.5', 'Spring Security / JWT', 'JPA', 'Flyway', 'MySQL 8', 'OpenAPI',
      'Angular 22', 'Chart.js', 'Expo', 'React Native', 'Tauri v2', 'Go + Fyne', 'Cloudflare Workers AI',
      'Cloudflare R2'],
    features: [
      'Credit cards, statements, payments and a credit card dashboard',
      'AI reads statement images; the user reviews and confirms before anything is saved',
      'Card recommendation by MCC and amount, plus cashback progress',
      'Investment account profiles with transaction history imported from images',
      'Health: body profile, BMI, calorie target, AI-drafted meal and workout plans, journal',
      'Travel: trips, itinerary, packing checklist, group cost split, bookings, map, countdown',
      'Personal: karaoke favourites and a job application tracker',
      'Admin-managed Cloudflare accounts with Workers AI failover',
    ],
  },
  {
    id: 'farm-market',
    name: 'Kira Farm (farm-market)',
    folder: 'farm-market',
    tagline: 'Multi-branch e-commerce for a farm',
    description:
      'An online shop for a farm business selling eggs, animal feed, breeding stock and blog content. Customers '
      + 'order from the nearest branch; staff and admins manage orders, stock and promotions per branch.',
    liveUrl: '',
    screenshots: [],
    diagram: [
      {nodes: [{name: 'farm-market-ui', detail: 'Angular 22 · shop + admin'}, {name: 'Admin desktop', detail: 'Tauri v2 shell'}]},
      {via: '/api/v1 · JWT + TOTP', nodes: [{name: 'farm-market-service', detail: 'Spring Boot modular monolith'}]},
      {
        nodes: [
          {name: 'MySQL 8', detail: 'Flyway'},
          {name: 'Local disk', detail: 'product & review images'},
          {name: 'VietQR', detail: 'bank transfer QR image'},
        ],
      },
    ],
    stack: ['Java 25', 'Spring Boot 3.5', 'Spring Security / JWT', 'JPA', 'Flyway', 'MySQL 8', 'OpenAPI',
      'Angular 22', 'Signals', 'Tauri v2', 'Testcontainers'],
    features: [
      'Product catalog, checkout and customer account (orders, addresses, wishlist, reviews)',
      'Loyalty points (1 point = 100đ) with configurable rewards; cancelling an order refunds points and vouchers',
      'Admin: dashboard, orders, products, inventory, customers, promotions, branches and branch theme colors',
      'Roles: customer, staff (own branch only), manager, admin',
      'Real TOTP second factor for staff, managers and admins',
      'COD and VietQR bank transfer, with staff confirming payments',
      'Password reset and image upload checked by magic bytes',
    ],
  },
];
