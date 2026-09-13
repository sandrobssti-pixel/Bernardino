import { FormEvent, useEffect, useRef, useState } from 'react';
import { Conversation, Message } from '../types';
import { api } from '../services/api';

export function ChatWindow({ conversation, messages }: { conversation: Conversation | null; messages: Message[] }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">Selecione uma conversa</div>
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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-5 py-3">
        <p className="font-medium text-slate-800">{conversation.contact.name || conversation.contact.phone}</p>
        <p className="text-xs text-slate-500">{conversation.contact.phone}</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                m.direction === 'OUTBOUND' ? 'bg-brand-500 text-white' : 'bg-white text-slate-800'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
