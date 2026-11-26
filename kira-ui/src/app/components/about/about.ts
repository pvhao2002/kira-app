import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {ThreeBackground} from './three-background/three-background';
import {PROJECTS} from './projects.data';

interface SocialLink {
  label: string;
  url: string;
  icon: string;
}

interface Skill {
  name: string;
  icon: string;
  accent: string;
}

interface SkillGroup {
  label: string;
  skills: Skill[];
}

interface FocusArea {
  title: string;
  icon: string;
  summary: string;
  points: string[];
  primary?: boolean;
}

interface Experience {
  role: string;
  period: string;
  project: string;
  summary: string;
  highlights: {title: string; text: string}[];
}

interface InfraNode {
  icon: string;
  name: string;
  detail: string;
  /** Label on the arrow coming into this node from the one before it. */
  via?: string;
}

/** One step of the deployment diagram. A named step is drawn as a box around its nodes. */
interface InfraStep {
  name?: string;
  icon?: string;
  detail?: string;
  /** Label on the arrow coming into this step. */
  via?: string;
  nodes: InfraNode[];
}

@Component({
  selector: 'app-about',
  imports: [NgTemplateOutlet, ThreeBackground],
  templateUrl: './about.html',
  styleUrl: './about.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly rootRef = viewChild<ElementRef<HTMLElement>>('root');

  // Replace with a clear headshot (e.g. assets/images/avatar.jpg) when available.
  readonly avatarUrl = 'assets/images/kira_logo.png';
  readonly currentYear = new Date().getFullYear();
  readonly navLinks = [
    {id: 'about', label: 'About'},
    {id: 'skills', label: 'Skills'},
    {id: 'experience', label: 'Experience'},
    {id: 'projects', label: 'Projects'},
    {id: 'contact', label: 'Contact'},
  ];

  readonly projects = PROJECTS;

  readonly typingText = signal('');
  readonly visibleSections = signal<Set<string>>(new Set());

  readonly roles = [
    'Full-Stack Java Developer',
  ];

  readonly socialLinks: SocialLink[] = [
    {label: 'GitHub', url: 'https://github.com/pvhao2002', icon: 'code'},
    {label: 'LinkedIn', url: 'https://www.linkedin.com/in/haopv23/', icon: 'work'},
    {label: 'Email', url: 'mailto:hao.phamvan2308@gmail.com', icon: 'mail'},
  ];

  readonly focusAreas: FocusArea[] = [
    {
      title: 'Backend Engineering',
      icon: 'dns',
      summary: 'My core strength: designing and building reliable services with Java and Spring Boot.',
      points: ['REST API design', 'Data modeling with JPA & MySQL', 'Messaging with RabbitMQ', 'Query & index tuning'],
      primary: true,
    },
    {
      title: 'Front-end',
      icon: 'web',
      summary: 'Responsive Angular interfaces that connect cleanly to the services behind them.',
      points: ['Angular & TypeScript', 'Signals & RxJS', 'Tailwind CSS'],
    },
    {
      title: 'Data Crawling',
      icon: 'cloud_download',
      summary: 'End-to-end pipelines from raw sources to clean data exposed through APIs.',
      points: ['Source analysis', 'Crawlers & scheduling', 'Cleaning & storage'],
    },
  ];

  // Deployment of the self-hosted apps, as checked on the server. Names no specific app on purpose.
  readonly infraSteps: InfraStep[] = [
    {nodes: [{icon: 'language', name: 'kira.id.vn', detail: 'One subdomain per app: *.kira.id.vn'}]},
    {
      name: 'Cloudflare',
      icon: 'cloud',
      detail: 'DNS and edge network',
      via: 'DNS lookup',
      nodes: [
        {icon: 'dns', name: 'DNS', detail: 'Authoritative DNS, proxied records'},
        {icon: 'shield', name: 'Edge', detail: 'CDN cache · Universal SSL · DDoS mitigation', via: 'proxied'},
      ],
    },
    {
      name: 'Oracle Cloud VPS',
      icon: 'computer',
      detail: 'Always Free · Ampere A1 (ARM64) · 4 OCPU · 24 GB RAM · Ubuntu · firewall: 22, 80, 443',
      via: 'HTTPS · Full (strict)',
      nodes: [
        {icon: 'router', name: 'nginx (host)', detail: 'TLS, HTTP → HTTPS, HSTS; routes each subdomain'},
        {icon: 'web', name: 'Angular', detail: 'nginx web container serving the build', via: '127.0.0.1 only'},
        {
          icon: 'coffee',
          name: 'Java + other services',
          detail: 'Spring Boot on Java 25 · Node.js · log stack',
          via: '/api · same origin',
        },
        {
          icon: 'database',
          name: 'Databases',
          detail: 'PostgreSQL 17 · MySQL 8 on named volumes',
          via: 'Docker network',
        },
      ],
    },
  ];

  readonly infraNotes = [
    {icon: 'lock', text: 'TLS mode Full (strict) with a wildcard Cloudflare Origin Certificate for *.kira.id.vn'},
    {icon: 'my_location', text: 'nginx trusts CF-Connecting-IP only from Cloudflare\'s published IP ranges'},
    {icon: 'block', text: 'Every container port is bound to 127.0.0.1; databases are never published publicly'},
    {icon: 'cached', text: 'Hashed bundles are cached for a year; index.html is never cached'},
    {icon: 'monitor_heart', text: 'Docker health checks and restart policies; Grafana + Loki + Alloy for logs'},
    {icon: 'perm_media', text: 'Object storage on Cloudflare R2 (S3 API) and Hugging Face private datasets'},
  ];

  readonly deploySteps = ['push to master', 'tests', 'package', 'SSH', 'docker compose up -d --build',
    'health-check loop'];

  readonly freeTiers = [
    {
      name: 'Oracle Cloud Always Free',
      text: 'Ampere A1 compute up to 4 OCPUs and 24 GB of memory, up to 200 GB of block storage and 10 TB of '
        + 'outbound data per month, at no cost.',
    },
    {
      name: 'Cloudflare Free plan',
      text: 'Authoritative DNS, CDN caching, Universal SSL, free Origin CA certificates (valid up to 15 years) '
        + 'and unmetered DDoS mitigation.',
    },
    {name: 'Cloudflare R2', text: 'A free storage tier and no egress fees.'},
    {name: 'Hugging Face', text: 'Private datasets hold large media for free.'},
  ];

  readonly performancePoints = [
    'Cloudflare\'s edge serves cached static bundles and immutable media, so the VPS mostly answers API calls.',
    'ARM cores and 24 GB of RAM fit every app, its database and the log stack on one host.',
    'Spring Boot runs on Java virtual threads, with capped JVM memory.',
    'Same-origin /api proxying: no CORS preflights, and SameSite=Strict cookies work.',
  ];

  readonly skillGroups: SkillGroup[] = [
    {
      label: 'Backend',
      skills: [
        {name: 'Java', icon: 'coffee', accent: 'java'},
        {name: 'Spring Boot', icon: 'eco', accent: 'spring'},
        {name: 'JPA / Hibernate', icon: 'storage', accent: 'jpa'},
        {name: 'REST APIs', icon: 'api', accent: 'api'},
        {name: 'RabbitMQ', icon: 'queue', accent: 'rabbitmq'},
      ],
    },
    {
      label: 'Frontend',
      skills: [
        {name: 'Angular', icon: 'web', accent: 'angular'},
        {name: 'TypeScript', icon: 'javascript', accent: 'typescript'},
        {name: 'RxJS', icon: 'stream', accent: 'angular'},
        {name: 'Signals', icon: 'sensors', accent: 'angular'},
        {name: 'Tailwind CSS', icon: 'palette', accent: 'typescript'},
      ],
    },
    {
      label: 'Database & Data',
      skills: [
        {name: 'MySQL', icon: 'database', accent: 'mysql'},
        {name: 'SQL optimization', icon: 'speed', accent: 'mysql'},
        {name: 'Web crawling', icon: 'cloud_download', accent: 'api'},
        {name: 'Data processing', icon: 'dataset', accent: 'api'},
      ],
    },
    {
      label: 'Deployment & Tools',
      skills: [
        {name: 'Docker', icon: 'deployed_code', accent: 'docker'},
        {name: 'NGINX', icon: 'router', accent: 'spring'},
        {name: 'Cloudflare', icon: 'cloud', accent: 'rabbitmq'},
        {name: 'Oracle Cloud', icon: 'cloud', accent: 'angular'},
        {name: 'AWS', icon: 'cloud', accent: 'java'},
      ],
    },
  ];

  readonly experience: Experience = {
    role: 'Java Developer (Spring Boot + Angular)',
    period: '03/2024 – Present',
    project: 'Real-time trading, risk-control & back-office accounting platform',
    summary: 'I build and maintain the systems that traders, risk teams and accountants rely on every day: '
      + 'monitoring and risk reports, accounting modules, a trader portal and automation jobs. '
      + 'I collaborate with business and QA teams to deliver features through testing, staging and production.',
    highlights: [
      {
        title: 'Trader portal',
        text: 'Built the Angular app and Spring Boot services, including role-based user management and account configuration.',
      },
      {
        title: 'Risk monitoring and reporting',
        text: 'Delivered monitoring and risk report features, backed by scheduled jobs that collect data from external sources.',
      },
      {
        title: 'Accounting modules',
        text: 'Built Journal, Ledger, Fund Control and Chart of Accounts.',
      },
      {
        title: 'Production performance',
        text: 'Fixed production timeouts by optimizing heavy SQL, adding pre-aggregated tables and splitting scheduled jobs.',
      },
      {
        title: 'Stability',
        text: 'Investigated and fixed memory leaks in long-running services.',
      },
      {
        title: 'Large data handling',
        text: 'Added virtual scrolling for large lists and fixed failing Excel exports by reusing Apache POI cell styles.',
      },
    ],
  };

  readonly aboutEnParagraphs = [
    'I am a Java developer based in Ho Chi Minh City and an Information Technology graduate of HCMUTE. Since March 2024, I have worked on a trading, risk monitoring, and back-office accounting platform, developing Spring Boot services and Angular interfaces.',
    'My strengths include API development, data modeling, SQL optimization, and troubleshooting production issues. I also build scheduled data collection and processing workflows, and have hands-on experience deploying web applications using NGINX, Cloudflare, Oracle Cloud, and AWS.',
    'I am seeking a Java Backend or Full-Stack Developer role where I can contribute to reliable business applications and deepen my backend engineering expertise.',
  ];

  private roleIndex = 0;
  private charIndex = 0;
  private isDeleting = false;
  private typingTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.typingText.set(this.roles[0]);
      return;
    }
    this.startTypingEffect();
  }

  ngAfterViewInit(): void {
    this.setupScrollReveal();
  }

  isSectionVisible(id: string): boolean {
    return this.visibleSections().has(id);
  }

  scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  private startTypingEffect(): void {
    const type = () => {
      const currentRole = this.roles[this.roleIndex];

      if (!this.isDeleting) {
        this.typingText.set(currentRole.substring(0, this.charIndex + 1));
        this.charIndex++;

        if (this.charIndex === currentRole.length) {
          this.isDeleting = true;
          this.typingTimer = setTimeout(type, 2000);
          return;
        }
      } else {
        this.typingText.set(currentRole.substring(0, this.charIndex - 1));
        this.charIndex--;

        if (this.charIndex === 0) {
          this.isDeleting = false;
          this.roleIndex = (this.roleIndex + 1) % this.roles.length;
        }
      }

      const speed = this.isDeleting ? 40 : 80;
      this.typingTimer = setTimeout(type, speed);
    };

    this.typingTimer = setTimeout(type, 500);

    this.destroyRef.onDestroy(() => {
      if (this.typingTimer) {
        clearTimeout(this.typingTimer);
      }
    });
  }

  private setupScrollReveal(): void {
    const root = this.rootRef()?.nativeElement;
    if (!root) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            this.visibleSections.update((set) => {
              const next = new Set(set);
              next.add(id);
              return next;
            });
          }
        });
      },
      // threshold 0: a ratio threshold never fires for a section taller than viewport / ratio (phones).
      {threshold: 0, rootMargin: '0px 0px -40px 0px'},
    );

    root.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));

    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
