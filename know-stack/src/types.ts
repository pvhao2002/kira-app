export type Difficulty = 'junior' | 'mid' | 'senior' | 'staff';

export type User = { id: number; email: string; name: string; isAdmin: boolean };

export type Category = { slug: string; name: string; icon: string; count: number };

export type ArticleItem = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
  difficulty: Difficulty;
  tags: string[];
  readMinutes: number;
  views: number;
  saves: number;
  source: 'human' | 'ai';
  publishedAt: number | null;
  bookmarked: boolean;
};

export type ArticleDetail = ArticleItem & { bodyMd: string; status: 'draft' | 'published'; categoryName: string };

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { junior: 'Junior', mid: 'Mid-Level', senior: 'Senior', staff: 'Staff / Principal' };
