import { ReactNode } from 'react';

export function Topbar({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 bg-ink-900/60 px-6 py-4 backdrop-blur-xl">
      <div>
        <h1 className="font-display text-lg font-semibold text-white">{title}</h1>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
