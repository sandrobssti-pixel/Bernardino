import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Topbar } from '../components/Topbar';
import { StatusPill } from '../components/StatusPill';
import { UsersIcon, GearIcon } from '../components/icons';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface QueueRow {
  id: string;
  name: string;
  description: string | null;
}

export function SettingsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [queueName, setQueueName] = useState('');

  useEffect(() => {
    api.get('/users').then((res) => setUsers(res.data));
    api.get('/queues').then((res) => setQueues(res.data));
  }, []);

  async function handleCreateQueue(e: FormEvent) {
    e.preventDefault();
    if (!queueName.trim()) return;
    const { data } = await api.post('/queues', { name: queueName.trim() });
    setQueues((prev) => [...prev, data]);
    setQueueName('');
  }

  function initials(name: string) {
    return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <Topbar title="Configurações" description="Gerencie os atendentes e as filas de atendimento do time." />

      <div className="mx-auto w-full max-w-3xl space-y-8 p-6">
        <section className="glass rounded-2xl p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-brand-400" />
            <h2 className="font-display text-sm font-semibold text-slate-100">Atendentes</h2>
          </div>
          <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 font-display text-xs font-semibold text-slate-300 ring-1 ring-white/10">
                    {initials(u.name)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-100">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={u.status === 'ONLINE' ? 'success' : 'neutral'}>
                    {u.status === 'ONLINE' ? 'Online' : 'Offline'}
                  </StatusPill>
                  <span className="text-xs font-medium text-slate-500">
                    {u.role === 'ADMIN' ? 'Administrador' : 'Atendente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <GearIcon className="h-4 w-4 text-brand-400" />
            <h2 className="font-display text-sm font-semibold text-slate-100">Filas de atendimento</h2>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Filas ajudam a organizar as conversas por departamento (ex: Suporte, Vendas, Financeiro).
          </p>
          <form onSubmit={handleCreateQueue} className="mb-4 flex gap-2">
            <input
              value={queueName}
              onChange={(e) => setQueueName(e.target.value)}
              placeholder="Nome da fila (ex: Suporte)"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400/60 focus:ring-2 focus:ring-brand-400/20"
            />
            <button className="rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:opacity-90">
              Adicionar
            </button>
          </form>
          {queues.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">
              Nenhuma fila cadastrada ainda.
            </p>
          ) : (
            <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
              {queues.map((q) => (
                <div key={q.id} className="px-4 py-3 text-sm font-medium text-slate-100">
                  {q.name}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
