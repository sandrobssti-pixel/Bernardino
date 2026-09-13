import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Logo } from './Logo';
import { InboxIcon, WhatsappIcon, GearIcon, LogoutIcon } from './icons';

const navItems = [
  { to: '/', label: 'Caixa de entrada', hint: 'Conversas em tempo real', icon: InboxIcon },
  { to: '/whatsapp', label: 'Conexão WhatsApp', hint: 'QR Code e sessões', icon: WhatsappIcon },
  { to: '/settings', label: 'Configurações', hint: 'Atendentes e filas', icon: GearIcon },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-ink-950/60 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
        <Logo />
        <div>
          <span className="font-display text-lg font-semibold text-white">AtendeFlow</span>
          <p className="font-mono text-[10px] tracking-wide text-slate-500">v1.1.0 · multi atendimento</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Navegação</p>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-500/15 text-white shadow-[inset_0_0_0_1px_rgba(109,94,252,0.4)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`h-[18px] w-[18px] ${isActive ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300'}`}
                />
                <span className="flex flex-col">
                  <span>{item.label}</span>
                  <span className="text-[11px] font-normal text-slate-500">{item.hint}</span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient font-display text-sm font-semibold text-white">
            {(user?.name || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{user?.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {user?.role === 'ADMIN' ? 'Administrador · online' : 'Atendente · online'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/5 py-2 text-xs font-medium text-slate-400 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300"
        >
          <LogoutIcon className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
