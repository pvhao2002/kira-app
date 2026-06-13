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
  vi: string;
}

interface ProjectRepoLink {
  label: string;
  url: string;
}

interface Project {
  name: string;
  descriptionEn: string;
  descriptionVi: string;
  tech: string[];
  url?: string;
  repoLinks?: ProjectRepoLink[];
}

interface NavItem {
  id: string;
  labelEn: string;
  labelVi: string;
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

  readonly navItems: NavItem[] = [
    {id: 'hero', labelEn: 'Home', labelVi: 'Trang chủ'},
    {id: 'about', labelEn: 'About', labelVi: 'Giới thiệu'},
    {id: 'experience', labelEn: 'Experience', labelVi: 'Kinh nghiệm'},
    {id: 'projects', labelEn: 'Projects', labelVi: 'Dự án'},
    {id: 'education', labelEn: 'Education', labelVi: 'Học vấn'},
  ];

  readonly roles = [
    'Java Developer',
    'Lập trình viên Java Developer',
  ];

  readonly socialLinks: SocialLink[] = [
    {label: 'GitHub', url: 'https://github.com/pvhao2002', icon: 'code'},
    {label: 'LinkedIn', url: 'https://www.linkedin.com/in/haopv23/', icon: 'work'},
    {label: 'Facebook', url: 'https://www.facebook.com/kira.ph2308', icon: 'group'},
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
      vi: 'Chịu trách nhiệm mapping dữ liệu và tạo bảng dữ liệu tổng hợp, đề xuất giải pháp tối ưu và kế hoạch dự phòng.',
    },
    {
      en: 'Developed and maintained Java and Spring Boot backend systems for data management, trading support, and financial reporting, ensuring regulatory compliance.',
      vi: 'Phát triển và bảo trì hệ thống backend Java/Spring Boot cho quản lý dữ liệu, hỗ trợ giao dịch và báo cáo tài chính, đảm bảo tuân thủ quy định.',
    },
    {
      en: 'Created and maintained RESTful APIs and responsive Angular front-ends, improving system integration and user experience.',
      vi: 'Xây dựng và duy trì RESTful API cùng giao diện Angular responsive, cải thiện tích hợp hệ thống và trải nghiệm người dùng.',
    },
    {
      en: 'Optimized database indexes and queries to improve query performance.',
      vi: 'Tối ưu index và truy vấn cơ sở dữ liệu để cải thiện hiệu năng.',
    },
    {
      en: 'Supported migrating the entire system from legacy technology to modern stack, collaborating with cross-functional teams.',
      vi: 'Hỗ trợ migrate toàn bộ hệ thống từ công nghệ cũ sang công nghệ mới, phối hợp với các team liên quan.',
    },
  ];

  readonly projects: Project[] = [
    {
      name: 'Kira App',
      descriptionEn: 'Full-stack platform for sports data crawling, event management, predictions, and financial tools — Java microservices with Angular UI.',
      descriptionVi: 'Nền tảng full-stack crawl dữ liệu thể thao, quản lý sự kiện, dự đoán và công cụ tài chính — Java microservices kết hợp Angular.',
      tech: ['Java', 'Spring Boot', 'Angular', 'RabbitMQ', 'MySQL'],
      url: 'https://github.com/pvhao2002/kira-app',
    },
    {
      name: 'Toeicute BE + FE',
      descriptionEn: 'TOEIC learning platform — Spring Boot backend and Angular front-end for practice tests and user management.',
      descriptionVi: 'Nền tảng học TOEIC — backend Spring Boot và frontend Angular cho luyện đề thi và quản lý người dùng.',
      tech: ['Spring Boot', 'Angular', 'MySQL'],
      repoLinks: [
        {label: 'BE', url: 'https://github.com/pvhao2002/toeicute-be'},
        {label: 'FE', url: 'https://github.com/pvhao2002/toeicute-fe'},
      ],
    },
  ];

  readonly aboutParagraphs = [
    {
      en: 'I was born and raised in Thai Binh — a peaceful land that shaped my character from an early age. Later, I moved to Dong Nai to pursue my studies and build my life there. From a young age, I have carried a deep passion for programming — a dream that drives me to constantly learn, explore new technologies, and turn ideas into real-world solutions.',
      vi: 'Tôi là người con xứ Thái Bình — vùng đất bình yên nơi tôi sinh ra và lớn lên, hun đúc nên tính cách từ nhỏ. Sau này, tôi đến Đồng Nai để học tập và sinh sống. Từ sớm, tôi đã mang trong mình ước mơ và đam mê mãnh liệt với ngành lập trình — thứ thôi thúc tôi không ngừng học hỏi, khám phá công nghệ mới và biến ý tưởng thành giải pháp thực tế.',
    },
    {
      en: 'I am a passionate Java Developer, graduated in Information Technology from HCMUTE. I specialize in data crawling and backend development with Java & Spring Boot, building systems that collect and process data reliably for thousands of users.',
      vi: 'Tôi là Java Developer đam mê công nghệ, tốt nghiệp CNTT tại HCMUTE. Tôi chuyên về crawl dữ liệu và phát triển backend với Java & Spring Boot, xây dựng hệ thống thu thập và xử lý dữ liệu ổn định cho hàng nghìn người dùng.',
    },
    {
      en: 'I am highly responsible, a strong team player, and eager to learn new technologies. With a solid technical foundation and real-world experience, I am looking forward to taking on new challenges in an international environment where I can contribute meaningfully and grow my career in the long term.',
      vi: 'Tôi là người có trách nhiệm cao, làm việc nhóm tốt và luôn sẵn sàng học hỏi công nghệ mới. Với nền tảng kỹ thuật vững chắc và kinh nghiệm thực tế, tôi mong muốn đón nhận những thử thách mới trong môi trường quốc tế để đóng góp ý nghĩa và phát triển sự nghiệp lâu dài.',
    },
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
