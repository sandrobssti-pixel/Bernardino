import { ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'neutral' | 'danger' | 'info';

const toneClasses: Record<Tone, string> = {
  success: 'bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30',
  warning: 'bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/30',
  neutral: 'bg-slate-400/10 text-slate-300 ring-1 ring-inset ring-slate-400/20',
  danger: 'bg-rose-400/10 text-rose-300 ring-1 ring-inset ring-rose-400/30',
  info: 'bg-accent-400/10 text-accent-400 ring-1 ring-inset ring-accent-400/30',
};

const dotClasses: Record<Tone, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  neutral: 'bg-slate-400',
  danger: 'bg-rose-400',
  info: 'bg-accent-400',
};

export function StatusPill({
  tone,
  children,
  pulse = false,
  icon,
}: {
  tone: Tone;
  children: ReactNode;
  pulse?: boolean;
  icon?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${toneClasses[tone]}`}
    >
      {icon ? (
        icon
      ) : (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotClasses[tone]} opacity-60`} />
          )}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotClasses[tone]}`} />
        </span>
      )}
      {children}
    </span>
  );
}
