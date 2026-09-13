import { BoltIcon } from './icons';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const icon = size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow`}
    >
      <BoltIcon className={icon} />
    </div>
  );
}
