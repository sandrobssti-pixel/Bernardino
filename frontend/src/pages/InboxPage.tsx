import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { useInboxStore } from '../store/inboxStore';
import { ConversationList } from '../components/ConversationList';
import { ChatWindow } from '../components/ChatWindow';
import { Topbar } from '../components/Topbar';
import { StatCard } from '../components/StatCard';
import { InboxIcon, ClockIcon, WhatsappIcon, UsersIcon } from '../components/icons';

export function InboxPage() {
  const { conversations, selectedId, messages, setConversations, upsertConversation, select, setMessages, appendMessage } =
    useInboxStore();
  const [connectedSessions, setConnectedSessions] = useState(0);
  const [onlineAgents, setOnlineAgents] = useState(0);

  useEffect(() => {
    api.get('/conversations').then((res) => setConversations(res.data));
    api.get('/whatsapp/sessions').then((res) => setConnectedSessions(res.data.filter((s: any) => s.status === 'CONNECTED').length));
    api.get('/users').then((res) => setOnlineAgents(res.data.filter((u: any) => u.status === 'ONLINE').length));

    socket.connect();
    socket.on('conversation:updated', upsertConversation);
    socket.on('message:new', (payload) => {
      upsertConversation(payload.conversation);
      appendMessage(payload);
    });
    socket.on('whatsapp:status', () => {
      api.get('/whatsapp/sessions').then((res) => setConnectedSessions(res.data.filter((s: any) => s.status === 'CONNECTED').length));
    });

    return () => {
      socket.off('conversation:updated', upsertConversation);
      socket.off('message:new');
      socket.off('whatsapp:status');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.get(`/conversations/${selectedId}/messages`).then((res) => setMessages(res.data));
  }, [selectedId, setMessages]);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  const counts = useMemo(() => {
    const open = conversations.filter((c) => c.status === 'OPEN').length;
    const pending = conversations.filter((c) => c.status === 'PENDING').length;
    return { open, pending, total: conversations.length };
  }, [conversations]);

  return (
    <div className="flex h-full flex-col">
      <Topbar title="Caixa de entrada" description="Converse com seus clientes em tempo real, tudo em um só lugar." />

      <div className="grid grid-cols-2 gap-3 border-b border-white/5 px-6 py-4 sm:grid-cols-4">
        <StatCard label="Conversas" value={counts.total} hint="no total" icon={<InboxIcon className="h-5 w-5" />} tone="brand" />
        <StatCard label="Aguardando" value={counts.pending} hint="sem atendente" icon={<ClockIcon className="h-5 w-5" />} tone="amber" />
        <StatCard
          label="WhatsApp"
          value={connectedSessions}
          hint="sessões conectadas"
          icon={<WhatsappIcon className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard label="Atendentes" value={onlineAgents} hint="online agora" icon={<UsersIcon className="h-5 w-5" />} tone="cyan" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 border-r border-white/5">
          <ConversationList conversations={conversations} selectedId={selectedId} onSelect={select} />
        </div>
        <div className="flex-1">
          <ChatWindow conversation={selected} messages={messages} />
        </div>
      </div>
    </div>
  );
}
