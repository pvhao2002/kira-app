// Seed data: categories + the sample articles in seed/articles/*.md (front matter + body).
// Safe to re-run on a live database: INSERT OR IGNORE never deletes or overwrites existing rows.
// Run: node seed/build.mjs  → writes seed/seed.sql
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readMinutes } from '../worker/text.ts';

const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const categories = [
  ['core-cs-and-systems', 'Core CS & Systems', 'terminal', 1],
  ['java-and-spring-boot', 'Java & Spring Boot', 'code', 2],
  ['databases-and-caching', 'Databases & Caching', 'database', 3],
  ['cloud-and-devops', 'Cloud & DevOps', 'cloud', 4],
  ['microservices-architecture', 'Microservices Architecture', 'hub', 5],
  ['system-design', 'System Design', 'account_tree', 6],
];

export function seedStatements() {
  const dir = new URL('./articles/', import.meta.url).pathname;
  const now = Math.floor(Date.now() / 1000);
  const out = categories.map((c) => `INSERT OR IGNORE INTO categories (slug, name, icon, sort) VALUES (${c.map(q).join(', ')});`);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const [, fm, body] = readFileSync(join(dir, file), 'utf8').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const meta = Object.fromEntries(fm.split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim().replace(/^"(.*)"$/, '$1')]));
    const published = now - Number(meta.daysAgo) * 86400;
    const tags = JSON.stringify(meta.tags.split(',').map((t) => t.trim()));
    out.push(
      `INSERT OR IGNORE INTO articles (slug, title, summary, body_md, category_slug, difficulty, tags, read_minutes, status, source, views, created_at, updated_at, published_at) VALUES (${[
        file.replace(/\.md$/, ''), meta.title, meta.summary, body.trim(), meta.category, meta.difficulty, tags,
        readMinutes(body), 'published', meta.source ?? 'human', Number(meta.views), published, published, published,
      ].map(q).join(', ')});`,
    );
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const statements = seedStatements();
  writeFileSync(new URL('./seed.sql', import.meta.url), statements.join('\n') + '\n');
  console.log(`wrote ${statements.length} statements`);
}
