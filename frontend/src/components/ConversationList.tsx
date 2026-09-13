import { Conversation } from '../types';

const statusLabel: Record<string, string> = { OPEN: 'Em atendimento', PENDING: 'Aguardando', CLOSED: 'Encerrada' };
const statusColor: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-slate-100 text-slate-500',
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col divide-y divide-slate-100 overflow-y-auto">
      {conversations.length === 0 && <p className="p-4 text-sm text-slate-400">Nenhuma conversa por aqui ainda.</p>}
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`flex flex-col gap-1 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${
            selectedId === c.id ? 'bg-brand-50' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-800">{c.contact.name || c.contact.phone}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor[c.status]}`}>
              {statusLabel[c.status]}
            </span>
          </div>
          <span className="truncate text-xs text-slate-500">{c.messages?.[0]?.content || 'Sem mensagens'}</span>
          <span className="text-[11px] text-slate-400">
            {c.assignedAgent ? `Com ${c.assignedAgent.name}` : 'Não atribuída'}
          </span>
        </button>
      ))}
    </div>
  );
}
