import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { Topbar } from '../components/Topbar';
import { StatusPill } from '../components/StatusPill';
import { EmptyState } from '../components/EmptyState';
import { WhatsappIcon, PlugIcon } from '../components/icons';

interface Session {
  id: string;
  name: string;
  status: 'DISCONNECTED' | 'QR_PENDING' | 'CONNECTED';
  qrCode: string | null;
}

const steps = [
  { title: 'Nomeie a sessão', description: 'Dê um nome para identificar este número (ex: comercial, suporte).' },
  { title: 'Escaneie o QR Code', description: 'Abra o WhatsApp no celular e escaneie o código gerado.' },
  { title: 'Pronto para atender', description: 'Mensagens recebidas nesse número aparecem na caixa de entrada.' },
];

export function WhatsAppPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState('atendimento-principal');
  const [creating, setCreating] = useState(false);

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
    setCreating(true);
    try {
      await api.post('/whatsapp/sessions', { name });
      refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleDisconnect(sessionName: string) {
    await api.post(`/whatsapp/sessions/${sessionName}/disconnect`);
    refresh();
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <Topbar
        title="Conexão WhatsApp"
        description="Conecte um número via QR Code (Baileys) para começar a receber e responder mensagens."
      />

      <div className="mx-auto w-full max-w-3xl space-y-8 p-6">
        {/* Passo a passo */}
        <div className="glass grid grid-cols-1 gap-4 rounded-2xl p-5 shadow-card sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-display text-xs font-semibold text-white">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-100">{step.title}</p>
                <p className="text-xs text-slate-400">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Nova conexão */}
        <form onSubmit={handleCreate} className="glass flex flex-col gap-3 rounded-2xl p-5 shadow-card sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Nome da sessão</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400/60 focus:ring-2 focus:ring-brand-400/20"
              placeholder="ex: comercial"
            />
          </label>
          <button
            disabled={creating || !name.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:opacity-90 disabled:opacity-50"
          >
            <PlugIcon className="h-4 w-4" />
            {creating ? 'Gerando QR...' : 'Nova conexão'}
          </button>
        </form>

        {/* Sessões */}
        {sessions.length === 0 ? (
          <div className="glass rounded-2xl p-10 shadow-card">
            <EmptyState
              icon={<WhatsappIcon className="h-6 w-6" />}
              title="Nenhuma sessão criada"
              description="Crie sua primeira conexão acima para gerar um QR Code e vincular um número de WhatsApp."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((s) => (
              <div key={s.id} className="glass rounded-2xl p-5 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-slate-100">{s.name}</span>
                  <StatusPill
                    tone={s.status === 'CONNECTED' ? 'success' : s.status === 'QR_PENDING' ? 'warning' : 'neutral'}
                    pulse={s.status === 'QR_PENDING'}
                  >
                    {s.status === 'CONNECTED' ? 'Conectado' : s.status === 'QR_PENDING' ? 'Aguardando QR' : 'Desconectado'}
                  </StatusPill>
                </div>

                {s.status === 'QR_PENDING' && s.qrCode && (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/5 p-6">
                    <img src={s.qrCode} alt="QR Code de conexão do WhatsApp" className="h-48 w-48 rounded-lg bg-white p-2" />
                    <p className="text-center text-xs text-slate-400">
                      WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho
                    </p>
                  </div>
                )}

                {s.status === 'CONNECTED' && (
                  <button
                    onClick={() => handleDisconnect(s.name)}
                    className="text-xs font-medium text-rose-300 hover:underline"
                  >
                    Desconectar este número
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
