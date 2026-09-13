import { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  tone?: 'brand' | 'cyan' | 'emerald' | 'amber';
}) {
  const iconTone: Record<string, string> = {
    brand: 'bg-brand-500/15 text-brand-300',
    cyan: 'bg-accent-500/15 text-accent-400',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-300',
  };

  return (
    <div className="glass flex items-center gap-3 rounded-xl px-4 py-3 shadow-card">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconTone[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-xl font-semibold text-white">{value}</span>
          {hint && <span className="truncate text-[11px] text-slate-500">{hint}</span>}
        </div>
      </div>
    </div>
  );
}
