import { DIFFICULTY_LABEL, type Difficulty } from '../types';

// DESIGN.md difficulty badge colors.
const STYLE: Record<Difficulty, string> = {
  junior: 'bg-[rgba(16,185,129,0.12)] text-[#34d399] border-[rgba(16,185,129,0.25)]',
  mid: 'bg-[rgba(6,182,212,0.12)] text-[#22d3ee] border-[rgba(6,182,212,0.25)]',
  senior: 'bg-[rgba(245,158,11,0.12)] text-[#fbbf24] border-[rgba(245,158,11,0.25)]',
  staff: 'bg-[rgba(244,63,94,0.12)] text-[#fb7185] border-[rgba(244,63,94,0.25)]',
};

export const DifficultyBadge = ({ level }: { level: Difficulty }) => (
  <span className={`px-2 py-0.5 rounded-full border font-badge-label text-badge-label whitespace-nowrap ${STYLE[level]}`}>{DIFFICULTY_LABEL[level]}</span>
);

export const TechBadge = ({ children }: { children: string }) => (
  <span className="px-2 py-0.5 rounded bg-[#1e293b] border border-[#334155] text-[#94a3b8] font-code-inline text-code-inline whitespace-nowrap">{children}</span>
);

export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div role="status" className="flex items-center gap-2 py-space-xl justify-center text-outline font-body-sm text-body-sm">
    <span className="material-symbols-outlined animate-spin">progress_activity</span>
    {label}
  </div>
);

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div role="alert" className="flex items-center gap-3 p-space-md rounded-xl bg-error-container/20 border border-error/30 text-error font-body-sm text-body-sm">
    <span className="material-symbols-outlined">error</span>
    <span className="flex-1">{message}</span>
    {onRetry && <button onClick={onRetry} className="underline" type="button">Retry</button>}
  </div>
);
