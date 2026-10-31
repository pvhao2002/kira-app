// No imports: shared by the worker, the editor (browser) and seed/build.mjs (plain Node).

export const nowSec = () => Math.floor(Date.now() / 1000);

export const slugify = (title: string) =>
  title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'untitled';

export const readMinutes = (md: string) => Math.max(1, Math.ceil(md.split(/\s+/).filter(Boolean).length / 220));
