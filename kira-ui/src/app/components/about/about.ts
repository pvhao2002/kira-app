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
import {ThreeBackground} from './three-background/three-background';

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

@Component({
  selector: 'app-about',
  imports: [ThreeBackground],
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
    {id: 'contact', label: 'Contact'},
  ];

  readonly typingText = signal('');
  readonly visibleSections = signal<Set<string>>(new Set());

  readonly roles = [
    'Java Developer',
    'Spring Boot Backend Engineer',
    'Full-stack with Angular',
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

  readonly skillGroups: SkillGroup[] = [
    {
      label: 'Backend',
      skills: [
        {name: 'Java', icon: 'coffee', accent: 'java'},
        {name: 'Spring Boot', icon: 'eco', accent: 'spring'},
        {name: 'JPA / Hibernate', icon: 'storage', accent: 'jpa'},
        {name: 'REST API', icon: 'api', accent: 'api'},
        {name: 'RabbitMQ', icon: 'queue', accent: 'rabbitmq'},
        {name: 'MySQL', icon: 'database', accent: 'mysql'},
      ],
    },
    {
      label: 'Front-end',
      skills: [
        {name: 'Angular', icon: 'web', accent: 'angular'},
        {name: 'TypeScript', icon: 'javascript', accent: 'typescript'},
      ],
    },
    {
      label: 'Tools & Data',
      skills: [
        {name: 'Docker', icon: 'deployed_code', accent: 'docker'},
        {name: 'Data Crawling', icon: 'cloud_download', accent: 'api'},
      ],
    },
  ];

  readonly experience: Experience = {
    role: 'Java Developer (Spring Boot + Angular)',
    period: '03/2024 – Present',
    project: 'Real-time trading, risk-control & back-office accounting platform',
    summary: 'I build and maintain the systems that traders, risk teams and accountants rely on every day: '
      + 'real-time monitoring and risk reports, accounting modules, a trader portal and automation jobs. '
      + 'I work directly with business and QC through QAT → STG → PROD release cycles.',
    highlights: [
      {
        title: 'Trader portal, end to end',
        text: 'Built the Angular app, multi-role user management, account configuration and new Spring Boot services, plus a WebSocket heartbeat that tracks online users every 30 seconds.',
      },
      {
        title: 'Real-time monitoring and position reports',
        text: 'Delivered config-driven filters (time bands, VIP groups) with server-side validation.',
      },
      {
        title: 'Data collection',
        text: 'Wrote scheduled crawlers that pull real-time data from external sources and store it for risk reports.',
      },
      {
        title: 'Entity-mapping automation',
        text: 'Built a scheduled job using Jaro-Winkler name matching with an optional AI check, real-time alerts and a confirmation flow in the UI.',
      },
      {
        title: 'Accounting features',
        text: 'Built Journal, Ledger, Fund Control and Chart of Accounts, including ERC20/TRC20 wallet linking with a rule-driven balance parser configured from the database.',
      },
      {
        title: 'Performance',
        text: 'Fixed production timeouts by rewriting heavy SQL (index hints, pre-aggregated tables) and partitioning scheduler jobs.',
      },
      {
        title: 'Stability',
        text: 'Tracked down and fixed memory leaks in long-running services, keeping memory usage stable and reducing out-of-memory restarts.',
      },
      {
        title: 'Large data handling',
        text: 'Removed browser freezes with virtual scrolling for huge lists, and fixed failing exports by caching Apache POI cell styles for large Excel/PDF files.',
      },
      {
        title: 'Financial accuracy',
        text: 'Fixed bugs in price and currency conversion, truncation rules and Debit/Credit placement in ledgers.',
      },
    ],
  };

  readonly aboutEnParagraphs = [
    'I am a Java Developer with a degree in Information Technology from HCMUTE. I can work on both front-end and back-end, but my main strength is the backend: designing and building services with Java and Spring Boot.',
    'On the backend I focus on clean REST APIs, solid data modeling with JPA and MySQL, message-driven processing with RabbitMQ, and performance tuning. On the front-end I build responsive Angular interfaces that connect smoothly to those services.',
    'I especially enjoy end-to-end data projects: analyzing sources, implementing crawlers, cleaning and structuring data, storing it efficiently, and exposing it through APIs and admin dashboards.',
    'I have worked across multiple domains including real estate and English exam content such as TOEIC and IELTS. My goal is always to build crawling systems that are reliable, scalable, and truly useful for real-world business needs.',
    'If you need a custom internal tool, website, or app related to data crawling, data processing, content operations, or a complete digital product, I am available to help from idea to deployment.',
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
      {threshold: 0.12, rootMargin: '0px 0px -40px 0px'},
    );

    root.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));

    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
