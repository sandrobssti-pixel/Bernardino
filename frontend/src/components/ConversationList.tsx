import { Conversation } from '../types';
import { StatusPill } from './StatusPill';
import { EmptyState } from './EmptyState';
import { InboxIcon } from './icons';

const statusLabel: Record<string, string> = { OPEN: 'Em atendimento', PENDING: 'Aguardando', CLOSED: 'Encerrada' };
const statusTone: Record<string, 'success' | 'warning' | 'neutral'> = {
  OPEN: 'success',
  PENDING: 'warning',
  CLOSED: 'neutral',
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<InboxIcon className="h-6 w-6" />}
        title="Nenhuma conversa ainda"
        description="Assim que alguém escrever para o número conectado no WhatsApp, a conversa aparece aqui automaticamente."
      />
    );
  }

  return (
    <div className="flex h-full flex-col divide-y divide-white/5 overflow-y-auto">
      {conversations.map((c) => {
        const name = c.contact.name || c.contact.phone;
        const isSelected = selectedId === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`flex items-start gap-3 px-4 py-3 text-left text-sm transition ${
              isSelected ? 'bg-brand-500/10' : 'hover:bg-white/[0.04]'
            }`}
          >
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold ${
                isSelected ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-300 ring-1 ring-white/10'
              }`}
            >
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-slate-100">{name}</span>
                <StatusPill tone={statusTone[c.status]}>{statusLabel[c.status]}</StatusPill>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-400">{c.messages?.[0]?.content || 'Sem mensagens'}</p>
              <p className="mt-1 truncate text-[11px] text-slate-500">
                {c.assignedAgent ? `Com ${c.assignedAgent.name}` : 'Não atribuída'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
