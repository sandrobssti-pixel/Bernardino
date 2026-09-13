import { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-brand-400 ring-1 ring-white/10">
        {icon}
      </div>
      <p className="font-display text-base font-semibold text-slate-100">{title}</p>
      <p className="max-w-xs text-sm text-slate-400">{description}</p>
      {action}
    </div>
  );
}
