import { FormEvent, useEffect, useRef, useState } from 'react';
import { Conversation, Message } from '../types';
import { api } from '../services/api';
import { EmptyState } from './EmptyState';
import { SendIcon, WhatsappIcon, ClockIcon, DoubleCheckIcon } from './icons';

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function MessageStatusIcon({ status }: { status: string }) {
  if (status === 'PENDING') return <ClockIcon className="h-3 w-3 text-white/60" />;
  if (status === 'FAILED') return <span className="text-[10px] text-rose-300">falhou</span>;
  return <DoubleCheckIcon className="h-3.5 w-3.5 text-white/70" />;
}

export function ChatWindow({ conversation, messages }: { conversation: Conversation | null; messages: Message[] }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <EmptyState
        icon={<WhatsappIcon className="h-6 w-6" />}
        title="Selecione uma conversa"
        description="Escolha uma conversa na lista ao lado para ver o histórico e responder ao cliente."
      />
    );
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !conversation) return;
    setSending(true);
    try {
      await api.post('/messages', { conversationId: conversation.id, content: text.trim() });
      setText('');
    } finally {
      setSending(false);
    }
  }

  const name = conversation.contact.name || conversation.contact.phone;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 font-display text-xs font-semibold text-slate-300 ring-1 ring-white/10">
          {initials(name)}
        </div>
        <div>
          <p className="font-medium text-slate-100">{name}</p>
          <p className="font-mono text-xs text-slate-500">{conversation.contact.phone}</p>
        </div>
      </div>

      <div className="tech-grid flex-1 space-y-2 overflow-y-auto bg-ink-950/40 p-4">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-xs text-slate-500">Ainda não há mensagens nesta conversa.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-card ${
                m.direction === 'OUTBOUND'
                  ? 'rounded-br-sm bg-brand-gradient text-white'
                  : 'rounded-bl-sm border border-white/5 bg-ink-800 text-slate-100'
              }`}
            >
              <p>{m.content}</p>
              {m.direction === 'OUTBOUND' && (
                <div className="mt-1 flex items-center justify-end gap-1 opacity-80">
                  <MessageStatusIcon status={m.status} />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-white/5 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand-400/60 focus:ring-2 focus:ring-brand-400/20"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon className="h-4 w-4" />
          Enviar
        </button>
      </form>
    </div>
  );
}
