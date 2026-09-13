import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';

interface Session {
  id: string;
  name: string;
  status: 'DISCONNECTED' | 'QR_PENDING' | 'CONNECTED';
  qrCode: string | null;
}

export function WhatsAppPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState('atendimento-principal');

  async function refresh() {
    const { data } = await api.get('/whatsapp/sessions');
    setSessions(data);
  }

  useEffect(() => {
    refresh();
    socket.connect();
    socket.on('whatsapp:qr', refresh);
    socket.on('whatsapp:status', refresh);
    return () => {
      socket.off('whatsapp:qr', refresh);
      socket.off('whatsapp:status', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await api.post('/whatsapp/sessions', { name });
    refresh();
  }

  async function handleDisconnect(sessionName: string) {
    await api.post(`/whatsapp/sessions/${sessionName}/disconnect`);
    refresh();
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-800">Conexão com WhatsApp</h1>
      <p className="mb-6 text-sm text-slate-500">
        Conecte um número via QR Code (Baileys) para começar a receber e responder mensagens.
      </p>

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nome da sessão"
        />
        <button className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          Nova conexão
        </button>
      </form>

      <div className="space-y-4">
        {sessions.map((s) => (
          <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-800">{s.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  s.status === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : s.status === 'QR_PENDING'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {s.status === 'CONNECTED' ? 'Conectado' : s.status === 'QR_PENDING' ? 'Aguardando QR' : 'Desconectado'}
              </span>
            </div>
            {s.status === 'QR_PENDING' && s.qrCode && (
              <img src={s.qrCode} alt="QR Code de conexão do WhatsApp" className="mx-auto h-48 w-48" />
            )}
            {s.status === 'CONNECTED' && (
              <button
                onClick={() => handleDisconnect(s.name)}
                className="text-xs font-medium text-red-500 hover:underline"
              >
                Desconectar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
