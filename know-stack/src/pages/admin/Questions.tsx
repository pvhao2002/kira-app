import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api, useApi } from '../../api';
import { DifficultyBadge, ErrorBox, Spinner } from '../../components/Badge';
import { ago } from '../../format';
import type { Difficulty } from '../../types';

type Question = {
  id: number; title: string; domain: string; difficulty: Difficulty; context: string; code: string; codeLang: string;
  companies: string[]; urgency: string; status: 'pending' | 'drafted' | 'rejected'; articleId: number | null;
  createdAt: number; author: string; authorEmail: string;
};

const TABS = [['pending', 'Pending'], ['drafted', 'Drafted'], ['rejected', 'Rejected'], ['', 'All']] as const;

export default function Questions() {
  const [status, setStatus] = useState('pending');
  const list = useApi<Question[]>(`/admin/questions${status ? `?status=${status}` : ''}`);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function run(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const draft = (q: Question) =>
    run(async () => {
      const { articleId } = await api<{ articleId: number }>(`/admin/questions/${q.id}/draft`, { method: 'POST' });
      navigate(`/admin/editor/${articleId}`);
    });

  return (
    <div className="flex flex-col gap-space-lg max-w-[1100px]">
      <header>
        <span className="font-label-caps text-label-caps text-outline uppercase">Admin Studio</span>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">Question Queue</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Community submissions, interview-urgent first. Draft one to open it in the AI Article Editor.</p>
      </header>

      <div role="tablist" className="flex gap-1 p-1 bg-surface-container-low rounded-xl self-start">
        {TABS.map(([v, t]) => (
          <button key={v} role="tab" aria-selected={status === v} type="button" onClick={() => setStatus(v)} className={`px-space-md py-1.5 rounded-lg font-badge-label text-badge-label ${status === v ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}>{t}</button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}
      {list.error ? (
        <ErrorBox message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <Spinner />
      ) : list.data.length === 0 ? (
        <div className="p-space-xl rounded-xl bg-surface-container-low flex flex-col items-center gap-2 text-on-surface-variant font-body-md text-body-md">
          <span className="material-symbols-outlined text-headline-lg text-outline">inbox</span>Queue is empty.
        </div>
      ) : (
        <ul className="flex flex-col gap-space-sm">
          {list.data.map((q) => (
            <li key={q.id} className="rounded-xl bg-surface-container-low">
              <button type="button" aria-expanded={open === q.id} onClick={() => setOpen(open === q.id ? null : q.id)} className="w-full text-left p-space-md flex flex-col md:flex-row md:items-center gap-space-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {q.urgency === 'interview' && <span className="px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.12)] text-[#fbbf24] font-badge-label text-badge-label">Interview &lt; 48h</span>}
                    <DifficultyBadge level={q.difficulty} />
                    <span className="font-label-caps text-label-caps text-outline uppercase">{q.domain.replace(/-/g, ' ')}</span>
                  </div>
                  <p className="font-title-md text-title-md text-on-surface">{q.title}</p>
                  <p className="font-body-sm text-body-sm text-outline">{q.author} · {q.authorEmail} · {ago(q.createdAt)}</p>
                </div>
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">{q.status}</span>
                <span className="material-symbols-outlined text-outline">{open === q.id ? 'expand_less' : 'expand_more'}</span>
              </button>
              {open === q.id && (
                <div className="px-space-md pb-space-md flex flex-col gap-space-sm">
                  <p className="whitespace-pre-wrap font-body-sm text-body-sm text-on-surface-variant">{q.context}</p>
                  {q.code && (
                    <pre className="bg-[#0d1117] border border-[#1e293b] rounded-lg p-3 overflow-x-auto font-code-block text-code-block text-on-surface">
                      <span className="block font-label-caps text-label-caps text-outline mb-2">{q.codeLang}</span>{q.code}
                    </pre>
                  )}
                  {q.companies.length > 0 && <p className="font-body-sm text-body-sm text-outline">Targets: {q.companies.join(', ')}</p>}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {q.status === 'drafted' && q.articleId ? (
                      <button type="button" onClick={() => navigate(`/admin/editor/${q.articleId}`)} className="px-space-md h-9 rounded-lg bg-[#6366f1] text-white font-badge-label text-badge-label">Open Draft</button>
                    ) : (
                      <button type="button" onClick={() => draft(q)} className="flex items-center gap-1 px-space-md h-9 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-badge-label text-badge-label"><span className="material-symbols-outlined text-title-md">edit_note</span>Draft Article</button>
                    )}
                    {q.status === 'pending' && <button type="button" onClick={() => run(() => api(`/admin/questions/${q.id}`, { method: 'PATCH', body: { status: 'rejected' } }))} className="px-space-md h-9 rounded-lg border border-[#334155] hover:bg-[#1e293b] text-on-surface font-badge-label text-badge-label">Reject</button>}
                    {(q.status === 'rejected' || (q.status === 'drafted' && !q.articleId)) && <button type="button" onClick={() => run(() => api(`/admin/questions/${q.id}`, { method: 'PATCH', body: { status: 'pending' } }))} className="px-space-md h-9 rounded-lg border border-[#334155] hover:bg-[#1e293b] text-on-surface font-badge-label text-badge-label">Reopen</button>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
