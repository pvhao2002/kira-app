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
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

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

interface ExperienceItem {
  en: string;
}

interface ProjectRepoLink {
  label: string;
  url: string;
}

interface Project {
  name: string;
  descriptionEn: string;
  tech: string[];
  url?: string;
  repoLinks?: ProjectRepoLink[];
}

interface HeroStackIcon {
  name: string;
  icon: string;
  color: string;
  position: string;
  delay: string;
  duration: string;
}

@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.html',
  styleUrl: './about.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly rootRef = viewChild<ElementRef<HTMLElement>>('root');

  readonly typingText = signal('');
  readonly showCursor = signal(true);
  readonly visibleSections = signal<Set<string>>(new Set());

  readonly roles = [
    'Java Developer',
    'Data Crawling Specialist',
  ];

  readonly socialLinks: SocialLink[] = [
    {label: 'GitHub', url: 'https://github.com/pvhao2002', icon: 'code'},
    {label: 'LinkedIn', url: 'https://www.linkedin.com/in/haopv23/', icon: 'work'},
    {label: 'Email', url: 'mailto:hao.phamvan2308@gmail.com', icon: 'mail'},
  ];

  readonly heroStackIcons: HeroStackIcon[] = [
    {name: 'Java', icon: 'coffee', color: '#f89820', position: 'top-[6%] left-[4%]', delay: '0s', duration: '16s'},
    {name: 'Spring', icon: 'eco', color: '#6db33f', position: 'top-[38%] left-[2%]', delay: '-3s', duration: '20s'},
    {name: 'JPA', icon: 'storage', color: '#6db33f', position: 'bottom-[18%] left-[6%]', delay: '-6s', duration: '18s'},
    {name: 'Angular', icon: 'web', color: '#dd0031', position: 'top-[10%] right-[5%]', delay: '-2s', duration: '17s'},
    {name: 'TypeScript', icon: 'javascript', color: '#3178c6', position: 'top-[45%] right-[3%]', delay: '-5s', duration: '19s'},
    {name: 'RxJS', icon: 'sync', color: '#dd0031', position: 'bottom-[12%] right-[6%]', delay: '-8s', duration: '21s'},
    {name: 'MySQL', icon: 'database', color: '#00758f', position: 'bottom-[32%] left-[12%]', delay: '-4s', duration: '22s'},
    {name: 'REST API', icon: 'api', color: '#5382a1', position: 'top-[62%] right-[10%]', delay: '-7s', duration: '15s'},
  ];

  readonly skills: Skill[] = [
    {name: 'Java', icon: 'coffee', accent: 'java'},
    {name: 'Spring Boot', icon: 'eco', accent: 'spring'},
    {name: 'Angular', icon: 'web', accent: 'angular'},
    {name: 'TypeScript', icon: 'javascript', accent: 'typescript'},
    {name: 'MySQL', icon: 'database', accent: 'mysql'},
    {name: 'REST API', icon: 'api', accent: 'api'},
    {name: 'JPA', icon: 'storage', accent: 'jpa'},
    {name: 'RxJS', icon: 'sync', accent: 'rxjs'},
    {name: 'Data Crawling', icon: 'cloud_download', accent: 'api'},
    {name: 'Docker', icon: 'deployed_code', accent: 'docker'},
    {name: 'RabbitMQ', icon: 'queue', accent: 'rabbitmq'},
    {name: 'Git', icon: 'account_tree', accent: 'git'},
  ];

  readonly experienceItems: ExperienceItem[] = [
    {
      en: 'Responsibility for mapping data and generating summarized data tables, with solutions to enhance performance and fallback plans.',
    },
    {
      en: 'Developed and maintained Java and Spring Boot backend systems for data management, trading support, and financial reporting, ensuring regulatory compliance.',
    },
    {
      en: 'Created and maintained RESTful APIs and responsive Angular front-ends, improving system integration and user experience.',
    },
    {
      en: 'Optimized database indexes and queries to improve query performance.',
    },
    {
      en: 'Supported migrating the entire system from legacy technology to modern stack, collaborating with cross-functional teams.',
    },
  ];

  readonly projects: Project[] = [
    {
      name: 'Kira App',
      descriptionEn: 'Full-stack platform for sports data crawling, event management, predictions, and financial tools — Java microservices with Angular UI.',
      tech: ['Java', 'Spring Boot', 'Angular', 'RabbitMQ', 'MySQL'],
      url: 'https://github.com/pvhao2002/kira-app',
    },
    {
      name: 'Toeicute BE + FE',
      descriptionEn: 'TOEIC learning platform — Spring Boot backend and Angular front-end for practice tests and user management.',
      tech: ['Spring Boot', 'Angular', 'MySQL'],
      repoLinks: [
        {label: 'BE', url: 'https://github.com/pvhao2002/toeicute-be'},
        {label: 'FE', url: 'https://github.com/pvhao2002/toeicute-fe'},
      ],
    },
  ];

  readonly aboutEnParagraphs = [
    'I am a Java Developer with a degree in Information Technology from HCMUTE, focused on backend engineering with Java, Spring Boot, Angular, and production-ready data systems.',
    'My strongest area is building end-to-end data crawling projects: analyzing data sources, implementing crawlers, cleaning and structuring data, storing it efficiently, exposing APIs, and delivering admin dashboards or complete products.',
    'I have worked across multiple domains including real estate, English exam content such as TOEIC and IELTS, and football and sports match data. My goal is always to build crawling systems that are reliable, scalable, and truly useful for real-world business needs.',
    'If you need a custom internal tool, website, or app related to data crawling, data processing, content operations, or a complete digital product, I am available to help from idea to deployment.',
  ];

  private roleIndex = 0;
  private charIndex = 0;
  private isDeleting = false;
  private typingTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.startTypingEffect();
    this.startCursorBlink();
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

  private startCursorBlink(): void {
    const interval = setInterval(() => {
      this.showCursor.update((v) => !v);
    }, 530);

    this.destroyRef.onDestroy(() => clearInterval(interval));
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
