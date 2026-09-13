import { useEffect, useState } from 'react';
import { api } from '../services/api';

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

  async function handleCreateQueue() {
    if (!queueName.trim()) return;
    const { data } = await api.post('/queues', { name: queueName.trim() });
    setQueues((prev) => [...prev, data]);
    setQueueName('');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Atendentes</h2>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{u.name}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {u.role === 'ADMIN' ? 'Administrador' : 'Atendente'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Filas de atendimento</h2>
        <div className="mb-3 flex gap-2">
          <input
            value={queueName}
            onChange={(e) => setQueueName(e.target.value)}
            placeholder="Nome da fila (ex: Suporte, Vendas)"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreateQueue}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Adicionar
          </button>
        </div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {queues.map((q) => (
            <div key={q.id} className="px-4 py-3 text-sm font-medium text-slate-800">
              {q.name}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
