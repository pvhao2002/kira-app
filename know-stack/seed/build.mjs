// Compiles seed/articles/*.md (front matter + body) into seed/seed.sql. Run: node seed/build.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('./articles/', import.meta.url).pathname;
const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const categories = [
  ['core-cs-and-systems', 'Core CS & Systems', 'terminal', 1],
  ['java-and-spring-boot', 'Java & Spring Boot', 'code', 2],
  ['databases-and-caching', 'Databases & Caching', 'database', 3],
  ['cloud-and-devops', 'Cloud & DevOps', 'cloud', 4],
  ['microservices-architecture', 'Microservices Architecture', 'hub', 5],
  ['system-design', 'System Design', 'account_tree', 6],
];

const now = Math.floor(Date.now() / 1000);
const lines = ['DELETE FROM bookmarks;', 'DELETE FROM articles;', 'DELETE FROM categories;'];
for (const c of categories) lines.push(`INSERT INTO categories (slug, name, icon, sort) VALUES (${c.map(q).join(', ')});`);

for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
  const [, fm, body] = readFileSync(join(dir, file), 'utf8').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = Object.fromEntries(fm.split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim().replace(/^"(.*)"$/, '$1')]));
  const words = body.split(/\s+/).filter(Boolean).length;
  const published = now - Number(meta.daysAgo) * 86400;
  const tags = JSON.stringify(meta.tags.split(',').map((t) => t.trim()));
  lines.push(
    `INSERT INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES (${[
      file.replace(/\.md$/, ''), meta.title, meta.summary, body.trim(), meta.category, meta.difficulty, tags,
      Math.max(1, Math.ceil(words / 220)), 'published', meta.source ?? 'human', Number(meta.views), published, published, published,
    ].map(q).join(', ')});`,
  );
}
writeFileSync(new URL('./seed.sql', import.meta.url), lines.join('\n') + '\n');
console.log(`wrote ${lines.length} statements`);
