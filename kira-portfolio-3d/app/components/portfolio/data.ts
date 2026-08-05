import type { Project, RoomContent } from './types';

export const rooms: RoomContent[] = [
  { id: 'projects', label: 'Projects', summary: 'A gallery of systems designed to make complex work feel calm and useful.', world: 'Project gallery' },
  { id: 'experience', label: 'Experience', summary: 'A timeline of product, engineering, and operational work.', world: 'Timeline room' },
  { id: 'about', label: 'About', summary: 'The principles and capabilities behind the work.', world: 'Reading room' },
  { id: 'contact', label: 'Contact', summary: 'A quiet place to start a useful conversation.', world: 'Writing desk' },
];

export const projects: Project[] = [
  { title: 'TaskFlow API', description: 'A modular API for task orchestration, retries, and real-time status.', stack: ['Node.js', 'TypeScript', 'PostgreSQL'], href: '#' },
  { title: 'Streamline', description: 'A collaborative workflow surface that helps teams ship with clarity.', stack: ['Next.js', 'Tailwind', 'Zod'], href: '#' },
  { title: 'InsightBoard', description: 'An analytics workspace that turns dense data into actionable views.', stack: ['React', 'D3', 'WebSockets'], href: '#' },
];

export const experience = [
  { year: '2024—Now', title: 'Senior software engineer', text: 'Designing dependable tools, services, and workflows for complex operations.' },
  { year: '2021—2024', title: 'Product engineer', text: 'Turning product needs into thoughtful systems across web, data, and integrations.' },
  { year: '2018—2021', title: 'Full-stack developer', text: 'Building foundations, interfaces, and shared engineering practices.' },
];

export const capabilities = ['Product systems', 'Backend design', 'TypeScript', 'Data workflows', 'Angular & React', 'API integrations', 'Technical discovery', 'Design collaboration'];
