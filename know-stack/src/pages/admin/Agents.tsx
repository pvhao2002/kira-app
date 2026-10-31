import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, useApi } from '../../api';
import { ErrorBox, Spinner } from '../../components/Badge';
import { ago } from '../../format';

type Task = { id: number; goal: string; status: 'queued' | 'running' | 'paused' | 'done' | 'failed'; log: string; articleId: number | null; createdAt: number; updatedAt: number };

const STATUS_STYLE: Record<Task['status'], string> = {
  queued: 'bg-surface-container-high text-on-surface-variant',
  running: 'bg-secondary-container/20 text-secondary',
  paused: 'bg-[rgba(245,158,11,0.12)] text-[#fbbf24]',
  done: 'bg-primary-container/20 text-primary',
  failed: 'bg-error-container/30 text-error',
};
const card = 'p-space-md rounded-xl bg-surface-container-low';

export default function Agents() {
  const tasks = useApi<Task[]>('/admin/agent-tasks');
  const [goal, setGoal] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const running = tasks.data?.filter((t) => t.status === 'running') ?? [];
  const current = tasks.data?.find((t) => t.id === selected) ?? running[0] ?? tasks.data?.[0];
  const today = Date.now() / 1000 - 86400;

  // Poll while an agent is working so the log streams in.
  useEffect(() => {
    if (!running.length) return;
    const t = setInterval(tasks.reload, 5000);
    return () => clearInterval(t);
  }, [running.length, tasks.reload]);

  async function act(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      tasks.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const assign = (e: FormEvent) => {
    e.preventDefault();
    act(async () => {
      await api('/admin/agent-tasks', { body: { goal } });
      setGoal('');
    });
  };
  const setStatus = (t: Task, status: string) => act(() => api(`/admin/agent-tasks/${t.id}`, { method: 'PATCH', body: { status } }));

  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <div className="flex items-center gap-2 font-label-caps text-label-caps text-outline uppercase">
          KnowStack Studio · Computer Use Environment
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-secondary normal-case"><span className="w-1.5 h-1.5 rounded-full bg-secondary" />{running.length} running</span>
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">Autonomous AI Agent Studio</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
          Assign research goals to your computer-use agent. It claims tasks, streams its action log, and hands back a draft that a human reviews in the AI Article Editor — agents can never publish.
        </p>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-space-md">
        {[
          ['Active Agents', running.length, 'smart_toy'],
          ['Completed (24h)', tasks.data?.filter((t) => t.status === 'done' && t.updatedAt >= today).length ?? 0, 'task_alt'],
          ['Queued Goals', tasks.data?.filter((t) => t.status === 'queued').length ?? 0, 'pending_actions'],
          ['Failed / Needs HITL', tasks.data?.filter((t) => t.status === 'failed').length ?? 0, 'front_hand'],
        ].map(([label, value, icon]) => (
          <div key={label} className={`${card} flex items-center gap-3`}>
            <span className="material-symbols-outlined text-headline-md text-primary">{icon}</span>
            <div>
              <span className="block font-headline-md text-headline-md text-on-surface">{value}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={assign} className={`${card} flex flex-col md:flex-row gap-space-sm`}>
        <label htmlFor="goal" className="sr-only">New goal</label>
        <input id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} minLength={10} maxLength={1000} required placeholder="e.g. Draft an MVCC deep dive and verify isolation claims with a pgbench run" className="flex-1 px-3 py-2 bg-[#0f172a] text-on-surface placeholder:text-outline font-body-sm text-body-sm rounded-lg border border-[#334155] focus:outline-none focus:border-[#6366f1]" />
        <button type="submit" className="flex items-center justify-center gap-1.5 px-space-md h-10 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-badge-label text-badge-label"><span className="material-symbols-outlined text-title-md">add_task</span>Assign New Goal</button>
      </form>
      {error && <ErrorBox message={error} />}

      {tasks.error ? <ErrorBox message={tasks.error.message} onRetry={tasks.reload} /> : !tasks.data ? <Spinner /> : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-space-md">
          <section className={`${card} xl:col-span-2 flex flex-col gap-2`}>
            <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2"><span className="material-symbols-outlined text-primary">smart_toy</span>Agent Task Swarm</h2>
            {tasks.data.length === 0 && <p className="font-body-sm text-body-sm text-outline">No goals assigned yet.</p>}
            <ul className="flex flex-col gap-2">
              {tasks.data.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setSelected(t.id)} aria-pressed={current?.id === t.id} className={`w-full text-left p-3 rounded-lg border ${current?.id === t.id ? 'border-[#6366f1] bg-[#6366f1]/5' : 'border-transparent bg-surface-container hover:bg-surface-container-high'}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-label-caps text-label-caps text-outline">TASK #{t.id} · {ago(t.updatedAt)}</span>
                      <span className={`px-2 py-0.5 rounded-full font-badge-label text-badge-label capitalize ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface line-clamp-2">{t.goal}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="xl:col-span-3 flex flex-col gap-space-md">
            {current && (
              <div className={`${card} flex flex-col gap-space-sm`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2"><span className="material-symbols-outlined text-primary">terminal</span>Tool & Computer Action Log · #{current.id}</h2>
                  <div className="flex gap-2">
                    {(current.status === 'queued' || current.status === 'running') && <button type="button" onClick={() => setStatus(current, 'paused')} className="flex items-center gap-1 px-3 h-8 rounded-lg border border-[#334155] hover:bg-[#1e293b] text-on-surface font-badge-label text-badge-label"><span className="material-symbols-outlined text-title-md">pause_circle</span>Pause</button>}
                    {(current.status === 'paused' || current.status === 'failed') && <button type="button" onClick={() => setStatus(current, 'queued')} className="flex items-center gap-1 px-3 h-8 rounded-lg border border-[#334155] hover:bg-[#1e293b] text-on-surface font-badge-label text-badge-label"><span className="material-symbols-outlined text-title-md">replay</span>Requeue</button>}
                    {current.status === 'running' && <button type="button" onClick={() => setStatus(current, 'failed')} className="flex items-center gap-1 px-3 h-8 rounded-lg border border-error/40 text-error font-badge-label text-badge-label"><span className="material-symbols-outlined text-title-md">pan_tool</span>Take Over</button>}
                    {current.articleId && <Link to={`/admin/editor/${current.articleId}`} className="flex items-center gap-1 px-3 h-8 rounded-lg bg-[#6366f1] text-white font-badge-label text-badge-label"><span className="material-symbols-outlined text-title-md">edit_note</span>Review Draft</Link>}
                  </div>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{current.goal}</p>
                <pre aria-live="polite" className="bg-[#0d1117] border border-[#1e293b] rounded-lg p-3 h-72 overflow-auto font-code-block text-code-block text-[#4edea3] whitespace-pre-wrap">
                  {current.log || (current.status === 'queued' ? 'Waiting for an agent to claim this goal…' : 'No log lines yet.')}
                </pre>
              </div>
            )}
            <div className={`${card} flex flex-col gap-2`}>
              <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2"><span className="material-symbols-outlined text-primary">security</span>Agent Integration & Guardrails</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">The agent runs in its own sandbox and calls this API with the <code className="font-code-inline text-code-inline text-primary">AGENT_TOKEN</code> secret. It can only create drafts.</p>
              <pre className="bg-[#0d1117] border border-[#1e293b] rounded-lg p-3 overflow-x-auto font-code-block text-code-block text-on-surface-variant">{`POST /api/agent/tasks/claim          → next queued goal (204 if none)
POST /api/agent/tasks/:id/log        { "line": "bash.exec mvn test ..." }
POST /api/agent/tasks/:id/complete   { title, summary, bodyMd, categorySlug, difficulty, tags }
POST /api/agent/tasks/:id/fail
Authorization: Bearer $AGENT_TOKEN`}</pre>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
