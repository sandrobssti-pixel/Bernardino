import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { to: '/', label: 'Caixa de entrada', icon: '💬' },
  { to: '/whatsapp', label: 'Conexão WhatsApp', icon: '📱' },
  { to: '/settings', label: 'Configurações', icon: '⚙️' },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <span className="text-lg font-semibold text-brand-700">AtendeFlow</span>
        <p className="text-[11px] text-slate-400">v1.0.0</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4 text-sm">
        <p className="font-medium">{user?.name}</p>
        <p className="mb-3 text-xs text-slate-500">{user?.role === 'ADMIN' ? 'Administrador' : 'Atendente'}</p>
        <button onClick={logout} className="text-xs font-medium text-red-500 hover:underline">
          Sair
        </button>
      </div>
    </aside>
  );
}
